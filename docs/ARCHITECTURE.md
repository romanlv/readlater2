# ReadLater2 Architecture

## Vision
A serverless, user-owned reading list system with offline-first PWA and Chrome extension. No backend infrastructure - users own their data through external storage providers (starting with Google Sheets).

## Core Principles
- **User Data Ownership**: Each user controls their data through their chosen storage provider
- **Serverless**: No backend infrastructure, minimal operational costs
- **Offline-First**: PWA works without internet, syncs when available
- **Modular Storage**: Pluggable sync engines for different storage providers

## System Architecture

### Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chrome Ext     │    │   PWA App       │    │ Storage Engines │
│                 │    │                 │    │                 │
│ - Save articles │    │ - Offline read  │    │ - Google Sheets │
│ - Page context  │◄──►│ - Local storage │◄──►│ - Future: DB,   │
│                 │    │ - Service worker│    │   Cloud Storage │
│                 │    │ - Background    │    │                 │
│                 │    │   sync          │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ packages/core   │
                    │                 │
                    │ - Data types    │
                    │ - Interfaces    │
                    │ - Shared utils  │
                    └─────────────────┘
```

### Service Worker Architecture (PWA)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ System Share    │    │ Service Worker  │    │   PWA UI        │
│                 │    │                 │    │                 │
│ - Share menu    │───►│ - Web Share API │───►│ - Article form  │
│ - Other apps    │    │ - Asset caching │    │ - Reading list  │
│                 │    │ - Offline nav   │    │ - Sync status   │
│                 │    │ - Debug logs    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Flow

### Article Storage Schema
```typescript
// Shared article model (packages/core)
interface ArticleData {
  url: string;                // Primary key (unique), normalized (strip UTM params, etc.)
  title: string;
  description: string;
  featuredImage: string;      // from og:image
  domain: string;             // derived from URL
  timestamp: string;          // creation time (ISO string in sheets, number in IndexedDB)
  tags?: string[];
  notes?: string;
  archived?: boolean;
  favorite?: boolean;
  editedAt?: string;          // modification time (ISO string in sheets, number in IndexedDB)
}

// Local PWA model (extends shared model with sync state)
interface Article extends ArticleData {
  // Timestamps as numbers for reliable storage/compare in IndexedDB
  timestamp: number;          // when saved (ms since epoch)
  editedAt?: number;          // when last modified (ms since epoch)

  // Sync state (PWA only)
  syncStatus: 'synced' | 'pending';  // No 'conflict' - auto-resolved
}
```

- URL normalization: URLs are canonicalized before storage (e.g., remove UTM parameters and similar trackers; can be extended later). Domain is derived from the normalized URL.

### Save Article Flow

#### Extension (Online-Only)
1. **Extension**: User clicks save → Extract page metadata → Direct save to Google Sheets → Show success/error
2. **No Offline Mode**: If offline, save fails with error message
3. **Stateless**: No local storage, no sync queue, no conflicts

#### PWA (Offline-First)
1. **PWA Mobile**: Share link → PWA opens → Save to local IndexedDB → Always succeeds
2. **Queued Sync (Main Thread)**: Changes are queued and synced from the main thread; Background Sync API is planned for a future release
3. **Full Offline**: Complete functionality without internet connection

### Sync Strategy

#### Extension
- **Direct save only**: Immediate save to Google Sheets API
- **No offline support**: Save fails if no internet connection
- **No sync needed**: No local state to synchronize

#### PWA
- **Local-first**: All operations save to IndexedDB immediately
- **Main-thread sync**: Periodic sync (configurable interval + user-triggered); Background Sync API planned
- **Conflict Resolution**: Automatic last-write-wins by `editedAt || timestamp`; no UI needed
- **Remote merge**: Fetch-all from Google Sheets, then apply LWW merge locally with automatic resolution

## Conflict Resolution Strategy

### Design Decisions
- **Approach**: Simple Last-Write-Wins (LWW) with automatic resolution
- **No UI**: Conflicts resolved silently, no user intervention required
- **Field**: Use `editedAt` for modification tracking (semantic and clear)
- **Fallback**: Use `timestamp` (creation time) if `editedAt` is not set

### Data Format Strategy

#### Google Sheets (Human-Readable)
- **Date Format**: ISO 8601 strings (`2025-01-20T12:00:00.000Z`)
- **Benefits**: Human-readable, chronologically sortable, Google Sheets compatible
- **Storage**: All dates stored as ISO strings in spreadsheet

#### IndexedDB (Performance-Optimized)
- **Date Format**: Unix timestamps in milliseconds (`1737384000000`)
- **Benefits**: Efficient for queries, comparisons, and storage
- **Storage**: All dates stored as numbers in local database

#### Conversion Strategy
```typescript
// To Sheet (number → ISO string)
new Date(timestamp).toISOString()

// From Sheet (ISO string → number)
new Date(isoString).getTime()
```

### Google Sheets Schema

#### Column Structure
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

#### Example Data
| URL | Title | Tags | Notes | Description | Featured Image | Timestamp | Domain | Archived | Favorite | Edited At |
|-----|-------|------|-------|-------------|----------------|-----------|---------|----------|----------|-----------|
| https://example.com/pwa-guide | Building Progressive Web Apps | javascript, pwa, tutorial | Check the caching section | A comprehensive guide to PWA development | https://example.com/pwa-image.jpg | 2025-01-20T12:00:00.000Z | example.com | | 1 | |
| https://blog.site/react-hooks | Understanding React Hooks | react, hooks | | Deep dive into React Hooks patterns | https://blog.site/hooks.png | 2025-01-19T08:00:00.000Z | blog.site | 1 | | 2025-01-21T10:00:00.000Z |
| https://dev.to/offline-first | Offline First Architecture | offline, architecture | Implement for our app | Why offline-first matters in 2025 | | 2025-01-18T04:00:00.000Z | dev.to | | | 2025-01-22T16:00:00.000Z |

### Conflict Resolution Logic

#### Timestamp Precedence
1. **Compare**: Use `editedAt` if present, otherwise use `timestamp`
2. **Resolution**: Higher/later timestamp wins automatically
3. **Ties**: Prefer remote version for consistency (rare edge case)
4. **Missing Data**: Treat missing `editedAt` as using `timestamp` only

#### Implementation Flow
```typescript
function resolveConflict(local: Article, remote: Article): Article {
  const localTime = local.editedAt || local.timestamp;
  const remoteTime = remote.editedAt || remote.timestamp;

  // Convert ISO strings to numbers if needed for comparison
  const localTimestamp = typeof localTime === 'string' ?
    new Date(localTime).getTime() : localTime;
  const remoteTimestamp = typeof remoteTime === 'string' ?
    new Date(remoteTime).getTime() : remoteTime;

  // Later timestamp wins; ties go to remote
  return remoteTimestamp >= localTimestamp ? remote : local;
}
```

#### Update Operations
- **On Create**: Set `timestamp` only, leave `editedAt` undefined
- **On Edit**: Update `editedAt = new Date().toISOString()` (sheets) or `Date.now()` (IndexedDB)
- **On Sync**: Apply conflict resolution, then mark as 'synced'

### Benefits of This Approach
1. **Simplicity**: No complex UI or user decisions required
2. **Deterministic**: Same result regardless of sync order
3. **Semantic**: Clear distinction between creation and modification
4. **Efficient**: Minimal storage overhead (optional `editedAt` field)
5. **Readable**: Human-friendly dates in spreadsheet
6. **Performance**: Fast numeric comparisons in IndexedDB

## Service Worker Features

The PWA service worker (`packages/app/src/sw.ts`) provides essential offline and integration capabilities:

### Web Share Target API
- **Purpose**: Enables system-level sharing from other apps to ReadLater2
- **Implementation**: Intercepts POST requests to `/` with form data
- **Data Handling**: Extracts `title`, `text`, and `url` from shared content
- **Flow**: Share action → Service worker → Redirect to app with parsed data

### Asset Caching & Offline Support
- **Technology**: Workbox precaching and routing
- **Strategy**: Precaches app shell and essential assets for offline access
- **Navigation**: Serves cached `index.html` for offline navigation
- **Development**: Disables precaching in dev mode to avoid caching issues

### Debug Communication
- **Logging**: Service worker sends debug logs to all open app tabs
- **Client Communication**: Uses `postMessage` for real-time debugging
- **Request Monitoring**: Logs relevant fetch events for troubleshooting

### Background Sync (Future)
- **Planned**: Background Sync API integration via the service worker
- **Current**: Sync is performed from the main thread with debounced and manual triggers

## Package Structure

### packages/app (PWA)
- **Technology**: React 19, Vite, TypeScript, Tailwind CSS 4.x, PWA features
- **Storage**: IndexedDB for offline data
- **Features**: Article reading, note-taking, tagging, offline support
- **Service Worker**: Web Share Target API, asset caching, offline navigation
- **Sync**: Main-thread synchronization with the storage engine; Background Sync planned

### packages/extension (Chrome Extension)
- **Technology**: Manifest V3, React, Vite, @crxjs/vite-plugin
- **Features**: One-click article saving, page context awareness
- **Integration**: Direct Google Sheets API communication
- **Online-Only**: No offline support - save fails if no internet
- **Simple Architecture**: Stateless, no local storage, no sync complexity
- **Phase 2**: Show existing notes/saved status for current page

### packages/google-sheets-sync (Storage Engine)
- **Purpose**: Google Sheets integration with OAuth 2.0
- **Features**: Auto-create "ReadLater" spreadsheet, CRUD operations
- **Schema**: Maps Article interface to spreadsheet columns
- **Reusability**: Shared by both extension and PWA

### packages/core (Shared Library)
- **Data Types**: Article interface, sync interfaces
- **Utilities**: URL validation, metadata extraction
- **Interfaces**: Storage engine contracts, sync protocols

## Error Handling Strategy

### Extension (Online-Only)
- **Blocking Errors**: All save failures prevent operation (no offline fallback)
- **Direct Feedback**: Immediate success/error response from Google Sheets API
- **User Messaging**: Clear error messages with manual retry options
- **Authentication**: Handle OAuth expiration gracefully with re-auth flow
- **Network Errors**: Show "Cannot save while offline" message

### PWA (Offline-First)
- **Non-Blocking Local**: All local operations (save/edit/delete) always succeed
- **Background Sync Errors**: Visible in UI with manual resolution options
- **Offline Mode**: Full functionality without external connectivity
- **Conflict Resolution**: UI for choosing between local and remote versions
- **Sync Status**: Clear indicators for synced/pending/conflict states

## Development Phases

### Phase 1: MVP
- PWA with offline reading lists
- Chrome extension for article saving
- Google Sheets sync engine
- Basic conflict resolution (LWW + conflict status, no duplicates)

### Phase 2: Enhanced Features
- Extension shows saved articles on page visit
- Multiple spreadsheet/list support
- Advanced conflict resolution UI
- Additional storage engines
 - Background Sync API integration via service worker (planned)

### Phase 3: Advanced Features
- Full article content caching for offline reading
- Text highlighting and annotations
- Article preview and reading mode
- Enhanced tagging and search

## Offline Storage Architecture

### Local-First Data Strategy
The PWA implements a local-first approach where all data operations happen immediately against local storage, with background synchronization to Google Sheets. This ensures:
- **Instant responsiveness**: No waiting for network requests
- **Offline functionality**: Full app features without internet
- **Reliable saves**: Data is never lost due to network issues

### Storage Technology Stack

#### Primary Storage: IndexedDB (via Dexie.js)
- **Capacity**: Up to 50% of available disk space vs localStorage's ~5MB limit
- **Performance**: Asynchronous operations prevent UI blocking
- **Structured Data**: Native object storage for articles, metadata, and progress
- **Service Worker Compatible**: Compatible with service worker contexts; used for offline caching (Background Sync planned)

#### State Management: React Query + minimal Zustand
- **React Query (server-state)**: Treat IndexedDB as the data source; handles caching, pagination, optimistic updates
- **Zustand (UI/local state)**: Minimal store for sync status and small UI flags
- **Best of both**: Instant local writes to Dexie + React Query cache updates + background sync

### Data Flow Architecture

```
User Action → Repository → Dexie (IndexedDB) → React Query Cache → Sync Queue → Google Sheets
                                   ↑                                      ↓
                         Periodic/On‑Demand Sync                Remote updates (LWW)
```

#### Core Operations
1. **Save Article**: Immediate local write → Queue for sync (main thread) → UI update
2. **Read Articles**: Serve from IndexedDB → Sync check → Update if needed
3. **Sync Process**: Batch upload pending changes → Download remote updates → Resolve conflicts

### Sync Strategy

#### Conflict Resolution: Last Write Wins
- **Timestamp-based**: Most recent modification takes precedence
- **Article-level**: Conflicts resolved per article, not field-level
- **Simple & Reliable**: Appropriate for single-user reading list use case
- **User Override**: Manual conflict resolution UI for important changes

#### Sync Triggers
- **Periodic**: Every 5 minutes when online and app is active
- **On Demand**: User-triggered refresh/sync button
- **Background (planned)**: Service Worker handles sync when app is closed
- **Reconnection**: Automatic sync when network is restored

### Storage Schema

```typescript
// Same Article interface as above (local model with sync fields)

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  articleUrl: string;
  data: Partial<Article>;
  timestamp: number;
  retryCount: number;
}
```

## Technology Decisions

### Why Serverless?
- **Cost**: No server infrastructure costs
- **Scalability**: Inherently scales with user base
- **Privacy**: Users control their data storage
- **Simplicity**: Reduced operational complexity

### Why Google Sheets First?
- **Accessibility**: Users can view/edit data directly
- **Sharing**: Easy collaboration through existing Google features
- **Familiarity**: Users understand spreadsheet paradigm
- **API Maturity**: Well-documented Google Sheets API

### Why Local-First with Dexie + React Query (+ Zustand)?
- **Performance**: Instant UI with local Dexie writes + optimistic cache updates
- **Reliability**: Data persists through network failures and app restarts
- **Simplicity**: Repository pattern + React Query reduces custom cache code
- **Scalability**: Efficient querying with single-field indexes and multi-entry tags; handles thousands of items

### Remote Schema Notes (Google Sheets)
- Include `lastModified` and `deleted` columns for deterministic sync and deletions
- Enforce uniqueness by URL on writes; dedupe by URL during reads before sync
- Prefer incremental sync by tracking last sync time or using a timestamp column

### Why Monorepo?
- **Code Sharing**: Common types and utilities across packages
- **Consistency**: Unified build and development processes
- **Modularity**: Clear separation of concerns with reusable components
