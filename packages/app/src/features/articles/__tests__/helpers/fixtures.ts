import type { Article, SyncOperation } from '../../../../lib/db';
import type { ArticleData } from '../../types';

/**
 * Creates a test Article with sensible defaults.
 * Override any fields by passing them in the overrides parameter.
 *
 * @example
 * const article = createTestArticle({ title: 'Custom Title', favorite: true });
 */
export function createTestArticle(overrides?: Partial<Article>): Article {
  const timestamp = Date.now();
  return {
    url: 'https://example.com/test-article',
    title: 'Test Article',
    description: 'This is a test article description',
    featuredImage: 'https://example.com/image.jpg',
    domain: 'example.com',
    tags: ['test'],
    notes: '',
    archived: false,
    favorite: false,
    timestamp,
    syncStatus: 'pending',
    ...overrides,
  };
}

/**
 * Creates a test ArticleData (Google Sheets format) with sensible defaults.
 * Override any fields by passing them in the overrides parameter.
 *
 * @example
 * const articleData = createTestArticleData({ url: 'https://custom.com' });
 */
export function createTestArticleData(overrides?: Partial<ArticleData>): ArticleData {
  return {
    url: 'https://example.com/test-article',
    title: 'Test Article',
    description: 'This is a test article description',
    featuredImage: 'https://example.com/image.jpg',
    domain: 'example.com',
    tags: ['test'],
    notes: '',
    archived: false,
    favorite: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a test SyncOperation with sensible defaults.
 * Override any fields by passing them in the overrides parameter.
 *
 * @example
 * const operation = createTestSyncOperation({ type: 'delete', retryCount: 2 });
 */
export function createTestSyncOperation(overrides?: Partial<SyncOperation>): SyncOperation {
  const timestamp = Date.now();
  const article = createTestArticle({ timestamp });

  return {
    id: `test-operation-${Math.random().toString(36).substring(7)}`,
    type: 'create',
    articleUrl: article.url,
    data: article,
    timestamp,
    retryCount: 0,
    ...overrides,
  };
}

/**
 * Creates multiple test articles with sequential URLs.
 * Useful for testing pagination and bulk operations.
 *
 * @param count - Number of articles to create
 * @param baseOverrides - Base overrides applied to all articles
 * @example
 * const articles = createTestArticles(5, { archived: true });
 */
export function createTestArticles(
  count: number,
  baseOverrides?: Partial<Article>
): Article[] {
  return Array.from({ length: count }, (_, i) =>
    createTestArticle({
      url: `https://example.com/article-${i + 1}`,
      title: `Test Article ${i + 1}`,
      timestamp: Date.now() - i * 1000, // Earlier articles have older timestamps
      ...baseOverrides,
    })
  );
}

/**
 * Creates multiple test sync operations with sequential IDs.
 *
 * @param count - Number of operations to create
 * @param baseOverrides - Base overrides applied to all operations
 * @example
 * const operations = createTestSyncOperations(3, { type: 'update' });
 */
export function createTestSyncOperations(
  count: number,
  baseOverrides?: Partial<SyncOperation>
): SyncOperation[] {
  return Array.from({ length: count }, (_, i) =>
    createTestSyncOperation({
      id: `test-operation-${i + 1}`,
      articleUrl: `https://example.com/article-${i + 1}`,
      timestamp: Date.now() - i * 1000,
      ...baseOverrides,
    })
  );
}

/**
 * Creates a test Google Sheets config for testing.
 */
export function createTestConfig() {
  return {
    CLIENT_ID: 'test-client-id',
    API_KEY: 'test-api-key',
    SPREADSHEET_NAME: 'Test ReadLater',
  };
}
