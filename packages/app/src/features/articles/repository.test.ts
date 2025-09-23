import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArticleRepository } from './repository.js';
import { db, Article } from '../../lib/db.js';

// Mock crypto.randomUUID for consistent test results in browser environment
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-123'),
});

describe('ArticleRepository', () => {
  let repository: ArticleRepository;

  beforeEach(async () => {
    // Clean up before each test
    try {
      await db.transaction('rw', [db.articles, db.syncQueue], async () => {
        await db.articles.clear();
        await db.syncQueue.clear();
      });
    } catch {
      // If database is closed, reopen and try again
      if (!db.isOpen()) {
        await db.open();
        await db.transaction('rw', [db.articles, db.syncQueue], async () => {
          await db.articles.clear();
          await db.syncQueue.clear();
        });
      }
    }
    repository = new ArticleRepository();
  });

  const createSampleArticle = (overrides: Partial<Article> = {}): Article => ({
    url: 'https://example.com/article',
    title: 'Sample Article',
    description: 'A sample article for testing',
    featuredImage: 'https://example.com/image.jpg',
    domain: 'example.com',
    tags: ['javascript', 'testing'],
    notes: 'Test notes',
    archived: false,
    favorite: false,
    timestamp: Date.now(),
    syncStatus: 'pending',
    ...overrides,
  });

  describe('Basic CRUD Operations', () => {
    it('should save an article', async () => {
      const article = createSampleArticle();

      await repository.save(article);

      const saved = await repository.getByUrl(article.url);
      expect(saved).toEqual(expect.objectContaining({
        url: article.url,
        title: article.title,
        syncStatus: 'pending',
      }));
    });

    it('should get an article by URL', async () => {
      const article = createSampleArticle();
      await db.articles.add(article);

      const retrieved = await repository.getByUrl(article.url);

      expect(retrieved).toEqual(article);
    });

    it('should return undefined for non-existent article', async () => {
      const retrieved = await repository.getByUrl('https://nonexistent.com');

      expect(retrieved).toBeUndefined();
    });

    it('should update an article', async () => {
      const article = createSampleArticle();
      await db.articles.add(article);

      const updates = { title: 'Updated Title', favorite: true };
      await repository.update(article.url, updates);

      const updated = await repository.getByUrl(article.url);
      expect(updated).toEqual(expect.objectContaining({
        title: 'Updated Title',
        favorite: true,
        syncStatus: 'pending',
        editedAt: expect.any(Number),
      }));
    });

    it('should throw error when updating non-existent article', async () => {
      await expect(repository.update('https://nonexistent.com', { title: 'New Title' }))
        .rejects.toThrow('Article not found');
    });

    it('should delete an article', async () => {
      const article = createSampleArticle();
      await db.articles.add(article);

      await repository.delete(article.url);

      const deleted = await repository.getByUrl(article.url);
      expect(deleted).toBeUndefined();
    });

    it('should mark article as synced', async () => {
      const article = createSampleArticle({ syncStatus: 'pending' });
      await db.articles.add(article);

      await repository.markAsSynced(article.url);

      const updated = await repository.getByUrl(article.url);
      expect(updated?.syncStatus).toBe('synced');
    });
  });

  describe('Sync Queue Management', () => {
    it('should queue sync operation when saving article', async () => {
      const article = createSampleArticle();

      await repository.save(article);

      const operations = await db.syncQueue.toArray();
      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual(expect.objectContaining({
        id: 'test-uuid-123',
        type: 'create',
        articleUrl: article.url,
        retryCount: 0,
      }));
    });

    it('should queue sync operation when updating article', async () => {
      const article = createSampleArticle();
      await db.articles.add(article);

      await repository.update(article.url, { title: 'Updated' });

      const operations = await db.syncQueue.toArray();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('update');
    });

    it('should queue sync operation when deleting article', async () => {
      const article = createSampleArticle();
      await db.articles.add(article);

      await repository.delete(article.url);

      const operations = await db.syncQueue.toArray();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('delete');
    });
  });

  describe('Pagination', () => {
    beforeEach(async () => {
      // Create test articles with different timestamps
      const articles = Array.from({ length: 5 }, (_, i) =>
        createSampleArticle({
          url: `https://example.com/article-${i}`,
          title: `Article ${i}`,
          timestamp: Date.now() + i * 1000, // Different timestamps
        })
      );

      await db.articles.bulkAdd(articles);
    });

    it('should return paginated results', async () => {
      const result = await repository.getPaginated({}, { limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('should return all results when limit exceeds total', async () => {
      const result = await repository.getPaginated({}, { limit: 10 });

      expect(result.items).toHaveLength(5);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should sort by timestamp in descending order by default', async () => {
      const result = await repository.getPaginated({}, { limit: 5 });

      const timestamps = result.items.map(item => item.timestamp);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
    });

    it('should handle cursor-based pagination', async () => {
      const firstPage = await repository.getPaginated({}, { limit: 2 });
      const secondPage = await repository.getPaginated({}, {
        limit: 2,
        cursor: firstPage.nextCursor,
      });

      expect(firstPage.items).toHaveLength(2);
      expect(secondPage.items).toHaveLength(2);

      // Ensure no overlap between pages
      const firstUrls = firstPage.items.map(item => item.url);
      const secondUrls = secondPage.items.map(item => item.url);
      expect(firstUrls).not.toEqual(expect.arrayContaining(secondUrls));
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
      const articles = [
        createSampleArticle({
          url: 'https://example.com/archived',
          title: 'Archived Article',
          archived: true,
          domain: 'example.com',
          tags: ['archived'],
        }),
        createSampleArticle({
          url: 'https://test.com/favorite',
          title: 'Favorite Article',
          favorite: true,
          domain: 'test.com',
          tags: ['favorite'],
        }),
        createSampleArticle({
          url: 'https://example.com/pending',
          title: 'Pending Article',
          syncStatus: 'pending',
          domain: 'example.com',
          tags: ['pending'],
        }),
      ];

      await db.articles.bulkAdd(articles);
    });

    it('should filter by archived status', async () => {
      const result = await repository.getPaginated({ archived: true });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Archived Article');
    });

    it('should filter by favorite status', async () => {
      const result = await repository.getPaginated({ favorite: true });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Favorite Article');
    });

    it('should filter by domain', async () => {
      const result = await repository.getPaginated({ domain: 'test.com' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].domain).toBe('test.com');
    });

    it('should filter by sync status', async () => {
      const result = await repository.getPaginated({ syncStatus: 'pending' });

      expect(result.items).toHaveLength(3); // All test articles are pending by default
    });

    it('should filter by tags', async () => {
      const result = await repository.getPaginated({ tags: ['favorite'] });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].tags).toContain('favorite');
    });

    it('should apply multiple filters', async () => {
      const result = await repository.getPaginated({
        domain: 'example.com',
        archived: false,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Pending Article');
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      // Ensure database is clean before adding search test data
      await db.articles.clear();

      const articles = [
        createSampleArticle({
          url: 'https://example.com/javascript-guide',
          title: 'JavaScript Testing Guide',
          description: 'Complete guide to testing JavaScript applications',
          tags: ['javascript', 'testing', 'guide'],
        }),
        createSampleArticle({
          url: 'https://example.com/react-hooks',
          title: 'React Hooks Tutorial',
          description: 'Learn React hooks with practical examples',
          tags: ['react', 'hooks', 'tutorial'],
        }),
        createSampleArticle({
          url: 'https://test.dev/api-design',
          title: 'API Design Best Practices',
          description: 'How to design clean and maintainable APIs',
          domain: 'test.dev',
          tags: ['api', 'design'],
        }),
      ];

      await db.articles.bulkAdd(articles);
    });

    it('should search by title', async () => {
      const result = await repository.searchPaginated('JavaScript');

      expect(result.items.length).toBeGreaterThan(0);
      // Should rank JavaScript article highest
      expect(result.items[0].title).toBe('JavaScript Testing Guide');
    });

    it('should search by description', async () => {
      const result = await repository.searchPaginated('practical');

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].title).toBe('React Hooks Tutorial');
    });

    it('should search by tags', async () => {
      const result = await repository.searchPaginated('design');

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].title).toBe('API Design Best Practices');
    });

    it('should search by domain', async () => {
      const result = await repository.searchPaginated('test.dev');

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].domain).toBe('test.dev');
    });

    it('should handle multiple search terms', async () => {
      const result = await repository.searchPaginated('JavaScript complete');

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].title).toBe('JavaScript Testing Guide');
    });

    it('should return empty results for non-matching search', async () => {
      const result = await repository.searchPaginated('xyzzyx');

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should ignore very short search terms', async () => {
      const result = await repository.searchPaginated('a b');

      expect(result.items).toHaveLength(0);
    });

    it('should handle empty search query', async () => {
      const result = await repository.searchPaginated('');

      expect(result.items).toHaveLength(0);
    });
  });

  describe('Count and Caching', () => {
    beforeEach(async () => {
      const articles = Array.from({ length: 10 }, (_, i) =>
        createSampleArticle({
          url: `https://example.com/article-${i}`,
          archived: i % 2 === 0,
        })
      );

      await db.articles.bulkAdd(articles);
    });

    it('should return correct count', async () => {
      const count = await repository.getCount();

      expect(count).toBe(10);
    });

    it('should return filtered count', async () => {
      const count = await repository.getCount({ archived: true });

      expect(count).toBe(5);
    });

    it('should cache count results', async () => {
      const buildBaseCollectionSpy = vi.spyOn(repository as never, 'buildBaseCollection');

      // First call
      await repository.getCount();
      expect(buildBaseCollectionSpy).toHaveBeenCalledTimes(1);

      // Second call within cache window (should not call database)
      await repository.getCount();
      expect(buildBaseCollectionSpy).toHaveBeenCalledTimes(1);

      buildBaseCollectionSpy.mockRestore();
    });

    it('should clear cache after modifications', async () => {
      // Prime the cache
      await repository.getCount();

      // Modify data
      await repository.save(createSampleArticle({ url: 'https://new.com' }));

      // Cache should be cleared, new count should reflect changes
      const count = await repository.getCount();
      expect(count).toBe(11);
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk update articles', async () => {
      const articles = Array.from({ length: 5 }, (_, i) =>
        createSampleArticle({
          url: `https://example.com/article-${i}`,
          title: `Article ${i}`,
        })
      );

      await repository.bulkUpdate(articles);

      const count = await repository.getCount();
      expect(count).toBe(5);
    });

    it('should get articles by domain', async () => {
      const articles = [
        createSampleArticle({ url: 'https://example.com/1', domain: 'example.com' }),
        createSampleArticle({ url: 'https://test.com/1', domain: 'test.com' }),
        createSampleArticle({ url: 'https://example.com/2', domain: 'example.com' }),
      ];

      await db.articles.bulkAdd(articles);

      const results = await repository.getArticlesByDomain('example.com');
      expect(results).toHaveLength(2);
      expect(results.every(article => article.domain === 'example.com')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle articles with missing optional fields', async () => {
      const minimalArticle: Article = {
        url: 'https://minimal.com',
        title: 'Minimal Article',
        domain: 'minimal.com',
        tags: [],
        archived: false,
        favorite: false,
        timestamp: Date.now(),
        syncStatus: 'pending',
        // Missing: description, featuredImage, notes, editedAt
      };

      await repository.save(minimalArticle);

      const saved = await repository.getByUrl(minimalArticle.url);
      expect(saved).toEqual(expect.objectContaining(minimalArticle));
    });

    it('should preserve existing data when updating partial fields', async () => {
      const article = createSampleArticle({
        title: 'Original Title',
        notes: 'Original Notes'
      });
      await db.articles.add(article);

      // Update only the title, notes should remain
      await repository.update(article.url, { title: 'New Title' });

      const updated = await repository.getByUrl(article.url);
      expect(updated?.title).toBe('New Title');
      expect(updated?.notes).toBe('Original Notes');
      expect(updated?.editedAt).toBeDefined();
    });

    it('should handle timestamp collisions in pagination', async () => {
      const sameTimestamp = Date.now();
      const articles = Array.from({ length: 3 }, (_, i) =>
        createSampleArticle({
          url: `https://example.com/article-${i}`,
          timestamp: sameTimestamp, // Same timestamp
        })
      );

      await db.articles.bulkAdd(articles);

      const result = await repository.getPaginated({}, { limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });
  });
});