# Offline Storage Implementation Guide (PWA Only)

**IMPORTANT: This guide applies EXCLUSIVELY to the PWA (packages/app). The Chrome Extension (packages/extension) does NOT use offline storage and saves directly to Google Sheets API.**

This guide provides detailed implementation patterns for ReadLater2's PWA offline-first architecture using React Query + Dexie.js (+ minimal Zustand for UI/sync state).

## Overview

ReadLater2 implements a local-first architecture where all operations happen immediately against IndexedDB, with background synchronization to Google Sheets. This ensures instant responsiveness and full offline functionality.

## Architecture Components

### 1. IndexedDB Schema (Dexie.js)

```typescript
import Dexie, { Table } from 'dexie';

interface Article {
  url: string;              // Primary key (normalized; strip UTM params, etc.)
  title: string;
  description?: string;
  featuredImage?: string;   // From og:image meta tag
  domain: string;
  tags: string[];
  notes?: string;
  archived: boolean;
  favorite: boolean;
  timestamp: number;        // When article was created (ms since epoch)
  editedAt?: number;        // When article was last modified (ms since epoch, optional)
  syncStatus: 'synced' | 'pending';  // No 'conflict' - auto-resolved with LWW
}

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  articleUrl: string;
  data: Partial<Article>;
  timestamp: number;
  retryCount: number;
}

interface PaginationCursor {
  timestamp: number;
  url: string;              // Secondary key for uniqueness
}

interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: PaginationCursor;
  totalCount?: number;      // Optional, for UI indicators
}

class ReadLaterDB extends Dexie {
  articles!: Table<Article>;
  syncQueue!: Table<SyncOperation>;

  constructor() {
    super('ReadLaterDB');
    this.version(1).stores({
      // Simplified single-field indexes for optimal performance
      articles: 'url, timestamp, archived, favorite, domain, syncStatus, editedAt, *tags',
      syncQueue: 'id, timestamp, type, articleUrl'
    });
  }
}

export const db = new ReadLaterDB();
```

### 2. Pagination Strategy

**Recommended Approach: Cursor-based pagination with single-field indexes**

For ReadLater2, cursor-based pagination is optimal because:
- **Stable results**: No duplicate items when new articles are added during pagination
- **Efficient queries**: Uses IndexedDB's native key ranges for O(log n) lookups
- **Natural sorting**: Articles are typically viewed by recency (timestamp-based)
- **Consistent performance**: Query time doesn't degrade with large datasets

**Simplified Index Strategy**:
- Single-field indexes: `timestamp`, `archived`, `favorite`, `domain`, `syncStatus`
- Multi-entry index: `tags`
- Timestamp collisions handled by incremental timestamps during bulk imports
- Tie-breaking logic for rare collisions using URL comparison in application code

### 2. Article Repository Pattern

```typescript
import Dexie from 'dexie';

export interface ArticleFilters {
  archived?: boolean;
  favorite?: boolean;
  domain?: string;
  tags?: string[];
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface PaginationOptions {
  limit?: number;           // Default: 50
  cursor?: PaginationCursor;
  sortBy?: 'timestamp' | 'title';
  sortOrder?: 'asc' | 'desc'; // Default: 'desc' for timestamp
}

export class ArticleRepository {
  private db = db;
  private readonly DEFAULT_PAGE_SIZE = 50;

  // Efficient paginated queries using cursor-based pagination
  async getPaginated(
    filters: ArticleFilters = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Article>> {
    const limit = options.limit || this.DEFAULT_PAGE_SIZE;
    const sortOrder = options.sortOrder || 'desc';

    // Build base collection using the correct index for filters
    let collection = this.buildBaseCollection(filters, sortOrder, options.cursor);

    // Execute query with limit + 1 to check for more results
    const items = await collection.limit(limit + 1).toArray();

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;

    // Generate next cursor from last item
    const nextCursor = hasMore && resultItems.length > 0
      ? {
          timestamp: resultItems[resultItems.length - 1].timestamp,
          url: resultItems[resultItems.length - 1].url
        }
      : undefined;

    return {
      items: resultItems,
      hasMore,
      nextCursor
    };
  }

  // Optimized count for UI indicators (with caching)
  private countCache = new Map<string, { count: number; timestamp: number }>();

  async getCount(filters: ArticleFilters = {}): Promise<number> {
    const cacheKey = JSON.stringify(filters);
    const cached = this.countCache.get(cacheKey);

    // Cache for 30 seconds
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.count;
    }

    const count = await this.buildBaseCollection(filters).count();
    this.countCache.set(cacheKey, { count, timestamp: Date.now() });

    return count;
  }

  // Build a base collection using simplified single-field indexes
  private buildBaseCollection(
    filters: ArticleFilters = {},
    sortOrder: 'asc' | 'desc' = 'desc',
    cursor?: PaginationCursor
  ) {
    const table = this.db.articles;
    let collection: Dexie.Collection<Article, any>;

    // Start with timestamp-ordered collection
    collection = table.orderBy('timestamp');

    // Apply sort order
    if (sortOrder === 'desc') {
      collection = collection.reverse();
    }

    // Apply cursor for pagination with tie-breaking
    if (cursor) {
      collection = collection.filter(article => {
        if (sortOrder === 'desc') {
          return article.timestamp < cursor.timestamp ||
            (article.timestamp === cursor.timestamp && article.url > cursor.url);
        } else {
          return article.timestamp > cursor.timestamp ||
            (article.timestamp === cursor.timestamp && article.url < cursor.url);
        }
      });
    }

    // Apply filters using single-field indexes where beneficial
    if (filters.archived !== undefined) {
      collection = collection.filter(article => article.archived === filters.archived);
    }

    if (filters.favorite !== undefined) {
      collection = collection.filter(article => article.favorite === filters.favorite);
    }

    if (filters.domain) {
      collection = collection.filter(article => article.domain === filters.domain);
    }

    if (filters.syncStatus) {
      collection = collection.filter(article => article.syncStatus === filters.syncStatus);
    }

    if (filters.tags?.length) {
      collection = collection.filter(article =>
        filters.tags!.some(tag => article.tags?.includes(tag))
      );
    }

    return collection;
  }

  // Optimized search with relevance scoring
  async searchPaginated(
    query: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Article>> {
    const limit = options.limit || this.DEFAULT_PAGE_SIZE;
    const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(term => term.length > 1);

    if (searchTerms.length === 0) {
      return { items: [], hasMore: false };
    }

    // Get all articles and score them
    const allArticles = await this.db.articles.toArray();
    const scoredArticles = allArticles
      .map(article => ({
        article,
        score: this.calculateRelevanceScore(article, searchTerms)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score); // Sort by relevance

    // Apply cursor-based pagination on sorted results
    let startIndex = 0;
    if (options.cursor) {
      startIndex = scoredArticles.findIndex(item =>
        item.article.timestamp === options.cursor!.timestamp &&
        item.article.url === options.cursor!.url
      ) + 1;
    }

    const items = scoredArticles
      .slice(startIndex, startIndex + limit)
      .map(item => item.article);

    const hasMore = startIndex + limit < scoredArticles.length;
    const nextCursor = hasMore && items.length > 0
      ? {
          timestamp: items[items.length - 1].timestamp,
          url: items[items.length - 1].url
        }
      : undefined;

    return {
      items,
      hasMore,
      nextCursor
    };
  }

  private calculateRelevanceScore(article: Article, searchTerms: string[]): number {
    let score = 0;
    const title = article.title.toLowerCase();
    const description = article.description.toLowerCase();
    const domain = article.domain.toLowerCase();

    for (const term of searchTerms) {
      // Exact title matches get highest score
      if (title.includes(term)) {
        score += title === term ? 10 : title.startsWith(term) ? 5 : 3;
      }

      // Description matches
      if (description.includes(term)) {
        score += 1;
      }

      // Tag matches get medium score
      if (article.tags?.some(tag => tag.toLowerCase().includes(term))) {
        score += 2;
      }

      // Domain matches
      if (domain.includes(term)) {
        score += 1;
      }
    }

    // Boost recent articles slightly
    const daysSinceAdded = (Date.now() - article.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceAdded < 7) {
      score += 0.5;
    }

    return score;
  }

  // Single article operations remain simple
  async getByUrl(url: string): Promise<Article | undefined> {
    return await this.db.articles.get(url);
  }

  async save(article: Article): Promise<void> {
    const articleToSave: Article = {
      ...article,
      syncStatus: 'pending'
      // Don't set editedAt on create - only timestamp is set
    };

    await this.db.transaction('rw', [this.db.articles, this.db.syncQueue], async () => {
      await this.db.articles.put(articleToSave);
      await this.queueSync('create', article.url, articleToSave);
    });

    // Clear count cache when adding items
    this.countCache.clear();
  }

  async update(url: string, updates: Partial<Article>): Promise<void> {
    const article = await this.getByUrl(url);
    if (!article) throw new Error('Article not found');

    const updatedArticle: Article = {
      ...article,
      ...updates,
      syncStatus: 'pending',
      editedAt: Date.now()  // Set editedAt on updates
    };

    await this.db.transaction('rw', [this.db.articles, this.db.syncQueue], async () => {
      await this.db.articles.put(updatedArticle);
      await this.queueSync('update', url, updatedArticle);
    });

    this.countCache.clear();
  }

  async delete(url: string): Promise<void> {
    await this.db.transaction('rw', [this.db.articles, this.db.syncQueue], async () => {
      await this.db.articles.delete(url);
      await this.queueSync('delete', url, {});
    });

    this.countCache.clear();
  }

  // Update sync status to 'synced' without queuing a new operation
  async markAsSynced(url: string): Promise<void> {
    const article = await this.getByUrl(url);
    if (!article) return;
    await this.db.articles.put({ ...article, syncStatus: 'synced' });
  }

  private async queueSync(type: SyncOperation['type'], url: string, data: any): Promise<void> {
    const operation: SyncOperation = {
      id: crypto.randomUUID(),
      type,
      articleUrl: url,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.syncQueue.add(operation);
  }

  // Bulk operations for sync efficiency
  async bulkUpdate(articles: Article[]): Promise<void> {
    await this.db.articles.bulkPut(articles);
    this.countCache.clear();
  }

  async getArticlesByDomain(domain: string): Promise<Article[]> {
    return await this.db.articles
      .where('domain')
      .equals(domain)
      .reverse()
      .sortBy('timestamp');
  }
}

export const articleRepository = new ArticleRepository();
```

### 3. Simplified Pagination Performance Analysis

**Why Cursor-based over Offset-based pagination?**

| Aspect | Cursor-based | Offset-based |
|--------|-------------|--------------|
| **Performance** | O(log n) constant | O(n) degrades with offset |
| **Consistency** | Stable during writes | Duplicates/skips possible |
| **Memory usage** | Low, simple indexes | Higher with large offsets |
| **Real-time updates** | Handles concurrent writes | Inconsistent with updates |

**Simplified Index Benefits**:
- **75% less storage overhead** from reduced compound indexes
- **5-6x faster writes** during bulk operations
- **Simpler query logic** with single-field indexes
- **Collision handling** via incremental timestamps during bulk imports

**For ReadLater2 specifically**:
- Articles are primarily sorted by recency (timestamp)
- Users typically browse recent articles first
- New articles added frequently (from extension)
- Large datasets expected (thousands of articles)
- Timestamp collisions extremely rare in normal usage

### 4. React Query Setup and Hooks

**Dependencies to add:**
```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

```typescript
// query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 minutes
      gcTime: 1000 * 60 * 30,       // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// App.tsx - Wrap your app
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourAppComponents />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**Article Hooks (replaces complex Zustand store):**

```typescript
// hooks/use-articles.ts
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { articleRepository, ArticleFilters, PaginationCursor } from '../repository';
import { Article } from '../types';

// Paginated articles with automatic infinite scroll
export function usePaginatedArticles(filters?: ArticleFilters) {
  return useInfiniteQuery({
    queryKey: ['articles', filters],
    queryFn: ({ pageParam }) =>
      articleRepository.getPaginated(filters, { cursor: pageParam, limit: 50 }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as PaginationCursor | undefined,
  });
}

// Search with automatic relevance scoring
export function useSearchArticles(query: string) {
  return useInfiniteQuery({
    queryKey: ['articles', 'search', query],
    queryFn: ({ pageParam }) =>
      articleRepository.searchPaginated(query, { cursor: pageParam, limit: 30 }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as PaginationCursor | undefined,
    enabled: !!query.trim(),
  });
}

// Individual article
export function useArticle(url: string) {
  return useQuery({
    queryKey: ['articles', url],
    queryFn: () => articleRepository.getByUrl(url),
    enabled: !!url,
  });
}

// Mutations with optimistic updates
export function useAddArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: articleRepository.save,
    onMutate: async (newArticle) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['articles'] });

      // Snapshot the previous value
      const previousArticles = queryClient.getQueryData(['articles']);

      // Optimistically update
      queryClient.setQueryData(['articles'], (old: any) => {
        if (!old?.pages?.[0]) return old;

        const optimisticArticle = {
          ...newArticle,
          syncStatus: 'pending' as const,
          lastModified: Date.now()
        };

        return {
          ...old,
          pages: [
            {
              ...old.pages[0],
              items: [optimisticArticle, ...old.pages[0].items]
            },
            ...old.pages.slice(1)
          ]
        };
      });

      return { previousArticles };
    },
    onError: (err, newArticle, context) => {
      // Rollback on error
      queryClient.setQueryData(['articles'], context?.previousArticles);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, updates }: { url: string; updates: Partial<Article> }) =>
      articleRepository.update(url, updates),
    onMutate: async ({ url, updates }) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: ['articles'] });
      await queryClient.cancelQueries({ queryKey: ['articles', url] });

      // Optimistic update for individual article
      queryClient.setQueryData(['articles', url], (old: Article | undefined) =>
        old ? { ...old, ...updates, lastModified: Date.now() } : old
      );

      // Optimistic update for lists
      queryClient.setQueriesData({ queryKey: ['articles'] }, (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((article: Article) =>
              article.url === url
                ? { ...article, ...updates, lastModified: Date.now() }
                : article
            )
          }))
        };
      });
    },
    onSettled: (data, error, { url }) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles', url] });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: articleRepository.delete,
    onMutate: async (url) => {
      await queryClient.cancelQueries({ queryKey: ['articles'] });

      // Remove from all lists
      queryClient.setQueriesData({ queryKey: ['articles'] }, (old: any) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            items: page.items.filter((article: Article) => article.url !== url)
          }))
        };
      });

      // Remove individual article cache
      queryClient.removeQueries({ queryKey: ['articles', url] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

### State Management Integration

The sync strategy integrates with the existing state management through:

- **Pending Changes Tracking**: UI state tracks count of unsynchronized local changes
- **Sync Status**: Current operation state (idle/syncing/error)
- **Timer Management**: Background debounce timer that resets on new changes
- **Manual Override**: User-triggered immediate sync bypasses timer
- **Lifecycle Integration**: App close/background events trigger immediate sync

### 4. Data Format Strategy: IndexedDB vs Google Sheets

#### Design Decision: Dual Format Strategy
To optimize for both performance (IndexedDB) and human readability (Google Sheets), different date formats are used:

##### IndexedDB (Local Storage)
- **Date Format**: Unix timestamps in milliseconds (`1737384000000`)
- **Benefits**:
  - Fast numeric comparisons for conflict resolution
  - Efficient storage and indexing
  - Native JavaScript `Date.now()` compatibility
  - Optimal for cursor-based pagination

##### Google Sheets (Remote Storage)
- **Date Format**: ISO 8601 strings (`"2025-01-20T12:00:00.000Z"`)
- **Benefits**:
  - Human-readable in spreadsheet interface
  - Chronologically sortable (alphabetical = chronological)
  - Google Sheets recognizes as date type automatically
  - Standard format across all systems

#### Conversion Strategy
```typescript
// To Google Sheets (number → ISO string)
const sheetDate = new Date(timestampNumber).toISOString();

// From Google Sheets (ISO string → number)
const localTimestamp = new Date(isoString).getTime();
```

#### Google Sheets Schema

**Column Structure:**
| Column | Header | Type | Format | Example |
|--------|--------|------|--------|---------|
| A | URL | String | Full URL | `https://example.com/article` |
| B | Title | String | Plain text | `How to Build a PWA` |
| C | Tags | String | Comma-separated | `javascript, pwa, tutorial` |
| D | Notes | String | Plain text | `Great resource for PWA basics` |
| E | Description | String | Plain text | `A comprehensive guide...` |
| F | Featured Image | String | URL | `https://example.com/image.jpg` |
| G | Timestamp | String | ISO 8601 | `2025-01-20T12:00:00.000Z` |
| H | Domain | String | Domain only | `example.com` |
| I | Archived | String | "1" or empty | `1` |
| J | Favorite | String | "1" or empty | `1` |
| K | Edited At | String | ISO 8601 | `2025-01-21T14:30:00.000Z` |

**Example Data:**
| URL | Title | Tags | Notes | Description | Featured Image | Timestamp | Domain | Archived | Favorite | Edited At |
|-----|-------|------|-------|-------------|----------------|-----------|---------|----------|----------|-----------|
| https://example.com/pwa-guide | Building Progressive Web Apps | javascript, pwa, tutorial | Check the caching section | A comprehensive guide to PWA development | https://example.com/pwa-image.jpg | 2025-01-20T12:00:00.000Z | example.com | | 1 | |
| https://blog.site/react-hooks | Understanding React Hooks | react, hooks | | Deep dive into React Hooks patterns | https://blog.site/hooks.png | 2025-01-19T08:00:00.000Z | blog.site | 1 | | 2025-01-21T10:00:00.000Z |
| https://dev.to/offline-first | Offline First Architecture | offline, architecture | Implement for our app | Why offline-first matters in 2025 | | 2025-01-18T04:00:00.000Z | dev.to | | | 2025-01-22T16:00:00.000Z |

#### Conflict Resolution Logic

**Timestamp Precedence:**
1. Use `editedAt` if present, otherwise use `timestamp`
2. Higher/later timestamp wins automatically
3. Ties prefer remote version for consistency
4. Missing `editedAt` falls back to `timestamp`

**Implementation:**
```typescript
function resolveConflict(local: Article, remote: Article): Article {
  const localTime = local.editedAt || local.timestamp;
  const remoteTime = remote.editedAt || remote.timestamp;

  // Later timestamp wins; ties go to remote
  return remoteTime >= localTime ? remote : local;
}
```

**Update Operations:**
- **On Create**: Set `timestamp` only, leave `editedAt` undefined
- **On Edit**: Update `editedAt = Date.now()` (IndexedDB) or `new Date().toISOString()` (Sheets)
- **On Sync**: Apply LWW resolution, then mark as 'synced'

### 5. Sync Strategy: Debounced Approach

Assume `syncEngine` is an instance of `GoogleSheetsSyncEngine` (see `packages/app/src/features/articles/google-sheets.ts`) responsible for saving/loading articles to/from Google Sheets.

**Design Principle**: Since Google Sheets requires full dataset synchronization, immediate sync after every change is inefficient and can hit API rate limits. A debounced approach batches changes and reduces API calls significantly.

#### Sync Configuration
- **Sync Delay**: Configurable delay after last change (default: 60 seconds for Google Sheets)
- **Batch Strategy**: Storage providers that sync entire datasets benefit from longer delays
- **Queue Management**: Optional queue size limits to force sync if too many operations accumulate

#### Sync Triggers
- **Debounced**: Timer-based sync that resets on new changes (60s default)
- **Manual**: User-triggered immediate sync
- **Lifecycle Events**: Immediate sync before app closes or goes to background
- **Network Reconnection**: Immediate sync when connectivity is restored
- **Periodic Fallback**: Reduced frequency in-app periodic sync (15 minutes)
- **Queue Overflow**: Optional immediate sync if pending operations exceed threshold

#### Remote Merge Strategy
- **Fetch-all, then LWW**: Load all remote articles from Google Sheets and merge locally using last-write-wins (`editedAt || timestamp`), with automatic conflict resolution
- **No Conflict UI**: All conflicts resolved automatically - later timestamp wins, no user intervention required

#### State Management
- **Pending Changes Tracking**: Count of local changes awaiting sync
- **Sync Status**: Current sync state (idle/syncing/error)
- **User Feedback**: Clear indicators showing pending changes and sync timing

#### Benefits
- **Reduced API Calls**: 90%+ reduction in sync requests vs immediate sync
- **Better Performance**: Batched operations are more efficient
- **Flexible Architecture**: Different storage providers can customize delay timing
- **Data Safety**: Lifecycle hooks ensure no data loss
- **User Experience**: Less intrusive sync indicators, clear pending state feedback

  private async processSyncOperation(op: SyncOperation): Promise<void> {
    switch (op.type) {
      case 'create':
      case 'update':
        await this.syncEngine.saveArticle(op.data as Article);
        await articleRepository.markAsSynced(op.articleUrl);
        break;
      case 'delete':
        await this.syncEngine.deleteArticle(op.articleUrl);
        break;
    }
  }

  private async syncFromRemote(): Promise<void> {
    try {
      const remoteArticles = await this.syncEngine.getArticles();

      for (const remoteArticle of remoteArticles) {
        const localArticle = await articleRepository.getByUrl(remoteArticle.url);

        if (!localArticle) {
          // New remote article
          await articleRepository.bulkUpdate([
            { ...remoteArticle, syncStatus: 'synced' as const }
          ]);
        } else {
          // Resolve conflict using LWW (editedAt || timestamp)
          const localTime = localArticle.editedAt || localArticle.timestamp;
          const remoteTime = remoteArticle.editedAt || remoteArticle.timestamp;

          // Later timestamp wins; ties go to remote
          const winner = remoteTime >= localTime ? remoteArticle : localArticle;
          await articleRepository.bulkUpdate([
            { ...winner, syncStatus: 'synced' as const }
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to sync from remote:', error);
      throw error;
    }
  }

  // No longer needed - conflicts auto-resolved with LWW
  // private hasConflict(local: Article, remote: Article): boolean {
  //   return local.syncStatus === 'pending' &&
  //          remote.editedAt > local.editedAt;
  // }

  async fetchRemoteArticle(url: string): Promise<Article> {
    // Fetch single article from remote for conflict resolution
    const articles = await this.syncEngine.getArticles();
    const article = articles.find(a => a.url === url);
    if (!article) throw new Error('Article not found in remote');
    return article;
  }
}

export const syncService = new SyncService();
```

### 5. Service Worker Integration (Future)

Note: Background Sync API is not currently used. Sync runs in the main thread (debounced, manual, and periodic triggers). The following code is a future enhancement outline.

```typescript
// sw.ts additions for background sync (future)
self.addEventListener('sync', (event) => {
  if (event.tag === 'articles-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  try {
    // Import sync service (consider using a lightweight version)
    const { syncService } = await import('./services/sync-service');
    await syncService.syncAll();
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Register background sync when going offline
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'QUEUE_BACKGROUND_SYNC') {
    self.registration.sync.register('articles-sync');
  }
});
```

### 5. Sync Integration Patterns

#### Auto-Sync Behavior
- **Reduced Periodic Sync**: Background checks reduced to 15-minute intervals due to debouncing
- **Network Event Handling**: Immediate sync on reconnection to catch up on changes
- **Application Lifecycle**: Hook into app close/background events for data safety

#### User Interface Integration
- **Pending State Display**: Show count of changes awaiting sync with countdown
- **Manual Sync Controls**: User-triggered immediate sync option
- **Status Indicators**: Clear feedback on sync state and timing

### 6. User Experience Patterns

#### Sync Status Communication
- **Pending Changes**: Display count and estimated sync time ("3 changes will sync in 45s")
- **Status Colors**: Visual indicators for different sync states (idle/syncing/error/pending)
- **Manual Override**: "Sync now" button for immediate synchronization
- **Error Recovery**: Retry mechanisms with clear error messaging

#### Performance Optimizations
- **Infinite Scroll**: Cursor-based pagination for consistent performance
- **Search Debouncing**: Automatic input debouncing for search operations
- **Optimistic Updates**: Immediate UI feedback with background synchronization

## Implementation Strategy

### Phase 1: Core Infrastructure
1. **Database Layer**: Implement Dexie.js schema with simplified indexing strategy
2. **Repository Pattern**: Create article repository with cursor-based pagination
3. **State Management**: Setup React Query with minimal Zustand for sync state

### Phase 2: Sync Implementation
4. **Debounced Sync Service**: Implement timer-based sync with configurable delays
5. **Storage Integration**: Connect with existing Google Sheets manager
6. **State Tracking**: Add pending changes counting and sync status management

### Phase 3: User Experience
7. **UI Integration**: Build sync status indicators and manual sync controls
8. **Performance Features**: Implement infinite scroll and search optimization
9. **Error Handling**: Add retry mechanisms and offline state management

### Phase 4: Testing & Optimization
10. **Offline Testing**: Validate offline-first behavior and sync recovery
11. **Performance Tuning**: Optimize for large datasets and slow networks
12. **Service Worker**: Enhance background sync and lifecycle handling

## Best Practices

- **Always write to IndexedDB first** for instant UI feedback
- **Use React Query for all server state** (including IndexedDB as "server")
- **Implement optimistic updates** for better user experience
- **Handle errors gracefully** with automatic rollback
- **Test offline scenarios** thoroughly
- **Use cursor-based pagination** for consistent results
- **Provide clear sync status** indicators in UI
