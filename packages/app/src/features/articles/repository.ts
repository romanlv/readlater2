import Dexie from 'dexie';
import { db, Article, SyncOperation, PaginationCursor, PaginatedResult } from '../../lib/db.js';

// Re-export types for external use
export type { PaginationCursor, PaginatedResult } from '../../lib/db.js';

export interface ArticleFilters {
  archived?: boolean;
  favorite?: boolean;
  domain?: string;
  tags?: string[];
  syncStatus?: 'synced' | 'pending';
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
    const collection = this.buildBaseCollection(filters, sortOrder, options.cursor);

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
    let collection: Dexie.Collection<Article, string>;

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
    const description = (article.description || '').toLowerCase();
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

    // Only boost recent articles if they already have a match
    if (score > 0) {
      const daysSinceAdded = (Date.now() - article.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceAdded < 7) {
        score += 0.5;
      }
    }

    return score;
  }

  // Single article operations remain simple
  async getByUrl(url: string): Promise<Article | undefined> {
    return await this.db.articles.get(url);
  }

  async save(article: Article): Promise<void> {
    const existingArticle = await this.getByUrl(article.url);

    const articleToSave: Article = {
      ...article,
      syncStatus: 'pending'
      // Don't set editedAt on create - only timestamp is set
    };

    await this.db.transaction('rw', [this.db.articles, this.db.syncQueue], async () => {
      await this.db.articles.put(articleToSave);

      // Queue appropriate operation type based on whether article exists
      const operationType = existingArticle ? 'update' : 'create';
      await this.queueSync(operationType, article.url, articleToSave);
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

  // Delete locally without queueing sync operation (for cleaning up after remote sync)
  async deleteLocalOnly(url: string): Promise<void> {
    await this.db.articles.delete(url);
    this.countCache.clear();
  }

  // Update sync status to 'synced' without queuing a new operation
  async markAsSynced(url: string): Promise<void> {
    const article = await this.getByUrl(url);
    if (!article) return;
    await this.db.articles.put({ ...article, syncStatus: 'synced' });
  }

  private async queueSync(type: SyncOperation['type'], url: string, data: Partial<Article>): Promise<void> {
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

  // Sync queue operations
  async getPendingSyncOperations(): Promise<SyncOperation[]> {
    return await this.db.syncQueue
      .orderBy('timestamp')
      .toArray();
  }

  async removeSyncOperation(id: string): Promise<void> {
    await this.db.syncQueue.delete(id);
  }

  async incrementSyncRetryCount(id: string): Promise<void> {
    const operation = await this.db.syncQueue.get(id);
    if (operation) {
      await this.db.syncQueue.put({
        ...operation,
        retryCount: operation.retryCount + 1
      });
    }
  }

  async clearSyncQueue(): Promise<void> {
    await this.db.syncQueue.clear();
  }

  async getPendingArticlesCount(): Promise<number> {
    return await this.db.articles
      .where('syncStatus')
      .equals('pending')
      .count();
  }

  // Get all articles (for sync operations that need to check everything)
  async getAllArticles(): Promise<Article[]> {
    return await this.db.articles.toArray();
  }
}

export const articleRepository = new ArticleRepository();