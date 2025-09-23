
## Tasks

### Phase 1: Offline Storage Foundation ✅ COMPLETED
- [x] Set up IndexedDB schema with Dexie.js (Article, SyncOperation tables)
- [x] Create basic ArticleRepository with CRUD operations
- [x] Set up React Query + QueryClient infrastructure
- [x] Add required dependencies (@tanstack/react-query, dexie)

### Phase 2: Local-First CRUD Operations
- [x] Implement local article save/get/update/delete in repository
- [x] Create useArticles hook with React Query integration
- [ ] Update article list UI to read from IndexedDB instead of Google Sheets
- [x] Add optimistic updates for instant UI feedback
- [ ] Basic offline article viewing (no sync yet)

### Phase 3: Manual Sync Foundation ✅ COMPLETED
- [x] Implement sync queue in IndexedDB (pending operations)
- [x] Create SyncService with manual sync to Google Sheets
- [x] Add "Sync Now" button to manually trigger sync
- [x] Show sync status (pending/syncing/synced) in UI
- [x] Handle sync errors with retry mechanism
- [x] OAuth authentication flow with Google Sheets
- [x] Last-Write-Wins conflict resolution with editedAt timestamps
- [x] Full CRUD operations (Create, Read, Update, Delete) on Google Sheets
- [x] Fix Google Sheets schema column range (11 columns A-K)
- [x] Prevent duplicate records on updates
- [x] Fix deletion sync issues (prevent deleted articles from coming back)
- [x] Comprehensive error handling and retry logic

### Phase 4: Production Sync System
- [ ] Implement debounced auto-sync (60s delay after changes)
- [x] Add Last-Write-Wins conflict resolution with editedAt timestamps (✓ completed in Phase 3)
- [ ] Sync on app lifecycle events (close/background)
- [ ] Network reconnection auto-sync
- [x] Bulk sync operations for efficiency (✓ basic implementation completed)

### Phase 5: Advanced Offline Features
- [x] Cursor-based pagination for large datasets
- [ ] load more functionality on UI
- [x] Local search with relevance scoring
- [x] Advanced filtering (tags, domain, archived, favorite)
- [ ] Sync progress indicators and pending change counts
- [ ] integrate filtering on UI
- [x] Performance optimizations (caching, indexing)

### Phase 6: Service Worker Integration (Future)
- [ ] Background Sync API integration
- [ ] Offline navigation and asset caching improvements
- [ ] Push notifications for sync conflicts

### Other Features
- [ ] multiple spaces/sheets
- [ ] dark mode
- [ ] prod deployment
- [x] delete articles (✓ implemented in Phase 1)
- [x] update notes (✓ implemented in Phase 1)