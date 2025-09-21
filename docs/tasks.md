
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

### Phase 3: Manual Sync Foundation
- [x] Implement sync queue in IndexedDB (pending operations)
- [ ] Create SyncService with manual sync to Google Sheets
- [ ] Add "Sync Now" button to manually trigger sync
- [ ] Show sync status (pending/syncing/synced) in UI
- [ ] Handle sync errors with retry mechanism

### Phase 4: Production Sync System
- [ ] Implement debounced auto-sync (60s delay after changes)
- [ ] Add Last-Write-Wins conflict resolution with editedAt timestamps
- [ ] Sync on app lifecycle events (close/background)
- [ ] Network reconnection auto-sync
- [ ] Bulk sync operations for efficiency

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