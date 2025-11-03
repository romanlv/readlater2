import { vi } from 'vitest';
import type { Article, PaginatedResult } from '../../../../lib/db';

/**
 * Creates a mock ArticleRepository for testing.
 * All methods are mocked with default implementations that return empty results.
 *
 * You can override specific methods after creation:
 * ```ts
 * const mockRepo = createMockArticleRepository();
 * mockRepo.getByUrl.mockResolvedValue(someArticle);
 * ```
 */
export function createMockArticleRepository() {
  return {
    // Pagination methods
    getPaginated: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: undefined,
      hasMore: false,
    } as PaginatedResult<Article>),

    getCount: vi.fn().mockResolvedValue(0),

    searchPaginated: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: undefined,
      hasMore: false,
    } as PaginatedResult<Article>),

    // CRUD methods
    getByUrl: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteLocalOnly: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),

    // Sync methods
    markAsSynced: vi.fn().mockResolvedValue(undefined),
    bulkUpdate: vi.fn().mockResolvedValue(undefined),

    // Query methods
    getArticlesByDomain: vi.fn().mockResolvedValue([]),
    getAllArticles: vi.fn().mockResolvedValue([]),
    getAllArticlesIncludingDeleted: vi.fn().mockResolvedValue([]),
    getDeletedArticles: vi.fn().mockResolvedValue([]),

    // Sync queue methods
    getPendingSyncOperations: vi.fn().mockResolvedValue([]),
    removeSyncOperation: vi.fn().mockResolvedValue(undefined),
    incrementSyncRetryCount: vi.fn().mockResolvedValue(undefined),
    clearSyncQueue: vi.fn().mockResolvedValue(undefined),
    getPendingArticlesCount: vi.fn().mockResolvedValue(0),

    // Cleanup methods
    cleanupDeletedArticles: vi.fn().mockResolvedValue(0),
  };
}
