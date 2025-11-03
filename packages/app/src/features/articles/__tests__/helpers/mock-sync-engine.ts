import { vi } from 'vitest';
import type { ArticleData, SyncResult } from '@readlater/core';

/**
 * Creates a mock GoogleSheetsSyncEngine for testing.
 * All methods are mocked with default successful implementations.
 *
 * You can override specific methods after creation:
 * ```ts
 * const mockEngine = createMockSyncEngine();
 * mockEngine.getArticles.mockResolvedValue([article1, article2]);
 * mockEngine.saveArticle.mockRejectedValue(new Error('Network error'));
 * ```
 */
export function createMockSyncEngine() {
  return {
    saveArticle: vi.fn().mockResolvedValue({
      success: true,
      articleUrl: '',
    } as SyncResult),

    getArticles: vi.fn().mockResolvedValue([] as ArticleData[]),

    saveArticles: vi.fn().mockResolvedValue([] as SyncResult[]),

    deleteArticle: vi.fn().mockResolvedValue({
      success: true,
      articleUrl: '',
    } as SyncResult),

    updateArticle: vi.fn().mockResolvedValue({
      success: true,
      articleUrl: '',
    } as SyncResult),

    cleanupDeletedArticles: vi.fn().mockResolvedValue(0),

    batchUpdateArticles: vi.fn().mockResolvedValue([] as SyncResult[]),

    batchDeleteArticles: vi.fn().mockResolvedValue([] as SyncResult[]),
  };
}
