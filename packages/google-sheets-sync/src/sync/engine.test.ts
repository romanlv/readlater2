import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ArticleData } from '@readlater/core';
import { GoogleSheetsSyncEngine } from './engine.js';
import { MockGoogleSheetsServer } from '../testing/mock-google-sheets-server.js';
import { LocalStorageSpreadsheetStorage } from '../spreadsheet/manager.js';
import { articleToSheetRow } from '../spreadsheet/schema.js';
import { PwaAuthProvider } from '../auth/pwa-auth.js';

// ─── helpers ───

function makeArticle(overrides: Partial<ArticleData> = {}): ArticleData {
  const url = overrides.url || `https://example.com/${Math.random().toString(36).slice(2)}`;
  return {
    url,
    title: overrides.title || 'Test Article',
    description: overrides.description || 'A test article',
    featuredImage: overrides.featuredImage || '',
    timestamp: overrides.timestamp || new Date('2025-06-01').toISOString(),
    domain: overrides.domain || 'example.com',
    tags: overrides.tags || [],
    notes: overrides.notes || '',
    archived: overrides.archived || false,
    favorite: overrides.favorite || false,
    editedAt: overrides.editedAt,
    deletedAt: overrides.deletedAt,
  };
}

function createEngine(server: MockGoogleSheetsServer): {
  engine: GoogleSheetsSyncEngine;
  spreadsheetId: string;
} {
  const spreadsheetId = server.createSpreadsheet('ReadLater');
  server.setAppDataConfig(spreadsheetId);

  const authProvider = new PwaAuthProvider({ clientId: 'test', apiKey: 'test' });
  authProvider.getAuthToken = async () => 'fake-token';
  authProvider.isAuthenticated = async () => true;

  const storage = new LocalStorageSpreadsheetStorage();
  const engine = new GoogleSheetsSyncEngine(authProvider, storage);

  return { engine, spreadsheetId };
}

// ─── test suite ───

describe('GoogleSheetsSyncEngine', () => {
  let server: MockGoogleSheetsServer;

  beforeEach(() => {
    server = new MockGoogleSheetsServer();
    server.install();
  });

  afterEach(() => {
    server.onBeforeRequest = null;
    server.uninstall();
    server.reset();
  });

  describe('basic operations', () => {
    test('saveArticle appends a row and getArticles retrieves it', async () => {
      const { engine, spreadsheetId } = createEngine(server);
      const article = makeArticle({ url: 'https://example.com/a1', title: 'First' });

      const result = await engine.saveArticle(article);
      expect(result.success).toBe(true);

      const rows = server.getDataRows(spreadsheetId);
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe('https://example.com/a1');

      const fetched = await engine.getArticles();
      expect(fetched).toHaveLength(1);
      expect(fetched[0].url).toBe('https://example.com/a1');
    });

    test('updateArticle merges partial updates', async () => {
      const { engine, spreadsheetId } = createEngine(server);
      const article = makeArticle({ url: 'https://example.com/u1', title: 'Original' });
      await engine.saveArticle(article);

      const result = await engine.updateArticle('https://example.com/u1', { title: 'Updated', favorite: true });
      expect(result.success).toBe(true);

      const rows = server.getDataRows(spreadsheetId);
      expect(rows).toHaveLength(1);
      expect(rows[0][1]).toBe('Updated');
      expect(rows[0][9]).toBe('1');
      expect(rows[0][0]).toBe('https://example.com/u1');
    });

    test('deleteArticle removes the row', async () => {
      const { engine, spreadsheetId } = createEngine(server);
      await engine.saveArticle(makeArticle({ url: 'https://example.com/d1' }));
      await engine.saveArticle(makeArticle({ url: 'https://example.com/d2' }));

      const result = await engine.deleteArticle('https://example.com/d1');
      expect(result.success).toBe(true);

      const rows = server.getDataRows(spreadsheetId);
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe('https://example.com/d2');
    });
  });

  describe('BUG: saveArticles creates duplicates when URL already exists', () => {
    test('appending an article that already exists in the sheet creates a duplicate', async () => {
      const { engine, spreadsheetId } = createEngine(server);

      // Device B already saved this article
      const existingArticle = makeArticle({ url: 'https://example.com/dup', title: 'From Device B' });
      server.simulateExternalAppend(spreadsheetId, articleToSheetRow(existingArticle));

      // Device A tries to save the same URL (queued as "create")
      const localArticle = makeArticle({ url: 'https://example.com/dup', title: 'From Device A' });
      await engine.saveArticles([localArticle]);

      // After fix: should have exactly 1 row (upserted, not duplicated)
      const rows = server.getDataRows(spreadsheetId);
      const urlRows = rows.filter(r => r[0] === 'https://example.com/dup');
      expect(urlRows).toHaveLength(1);
      expect(urlRows[0][1]).toBe('From Device A');
    });

    test('batch save with mix of new and existing articles upserts correctly', async () => {
      const { engine, spreadsheetId } = createEngine(server);

      // Pre-existing article in the sheet
      server.simulateExternalAppend(
        spreadsheetId,
        articleToSheetRow(makeArticle({ url: 'https://example.com/existing', title: 'Old Title' }))
      );

      // Batch save: one existing, one new
      const results = await engine.saveArticles([
        makeArticle({ url: 'https://example.com/existing', title: 'New Title' }),
        makeArticle({ url: 'https://example.com/brand-new', title: 'Brand New' }),
      ]);

      expect(results.every(r => r.success)).toBe(true);

      const rows = server.getDataRows(spreadsheetId);
      expect(rows).toHaveLength(2);

      const existingRow = rows.find(r => r[0] === 'https://example.com/existing');
      expect(existingRow?.[1]).toBe('New Title');

      const newRow = rows.find(r => r[0] === 'https://example.com/brand-new');
      expect(newRow?.[1]).toBe('Brand New');
    });
  });

  describe('BUG: stale row indices after concurrent modification', () => {
    test('batchUpdateArticles uses fresh row lookup, not stale indices', async () => {
      const { engine, spreadsheetId } = createEngine(server);

      // Set up: 3 articles in sheet
      const a = makeArticle({ url: 'https://example.com/a', title: 'Article A' });
      const b = makeArticle({ url: 'https://example.com/b', title: 'Article B' });
      const c = makeArticle({ url: 'https://example.com/c', title: 'Article C' });
      await engine.saveArticle(a);
      await engine.saveArticle(b);
      await engine.saveArticle(c);

      expect(server.getDataRows(spreadsheetId)).toHaveLength(3);

      // Simulate: external device deletes Article A (row 2) BETWEEN the first read
      // (used for data merging) and the second read (used for fresh row numbers).
      // The engine does: getAllRows → merge data → invalidateCache → getAllRows → write.
      // We inject the delete before the SECOND getAllRows call.
      let readCount = 0;
      server.onBeforeRequest = (url, method) => {
        if (url.includes('/values/Sheet1') && method === 'GET') {
          readCount++;
          if (readCount === 2) {
            // Before the fresh re-fetch, simulate external delete of row 2 (Article A)
            server.simulateExternalDelete(spreadsheetId, 2);
            server.onBeforeRequest = null;
          }
        }
      };

      // Device A tries to update Article C
      const result = await engine.batchUpdateArticles([
        { url: 'https://example.com/c', updates: { title: 'Updated C' } }
      ]);

      expect(result[0].success).toBe(true);

      // After fix: Article B should be untouched, Article C should be updated
      const rows = server.getDataRows(spreadsheetId);
      const rowB = rows.find(r => r[0] === 'https://example.com/b');
      const rowC = rows.find(r => r[0] === 'https://example.com/c');

      expect(rowB?.[1]).toBe('Article B'); // B must NOT be overwritten
      expect(rowC?.[1]).toBe('Updated C'); // C should be updated
    });

    test('batchDeleteArticles uses URL-based lookup, not stale row numbers', async () => {
      const { engine, spreadsheetId } = createEngine(server);

      const a = makeArticle({ url: 'https://example.com/a', title: 'Article A' });
      const b = makeArticle({ url: 'https://example.com/b', title: 'Article B' });
      const c = makeArticle({ url: 'https://example.com/c', title: 'Article C' });
      await engine.saveArticle(a);
      await engine.saveArticle(b);
      await engine.saveArticle(c);

      // Inject external append BETWEEN the read and the delete write
      let readDone = false;
      server.onBeforeRequest = (url, method) => {
        if (url.includes('/values/Sheet1') && method === 'GET') {
          readDone = true;
        }
        if (readDone && method === 'POST' && url.includes(':batchUpdate') && !url.includes('values')) {
          // External device inserts a row at the beginning (shifts everything down)
          server.simulateExternalAppend(spreadsheetId, articleToSheetRow(
            makeArticle({ url: 'https://example.com/x', title: 'External X' })
          ));
          server.onBeforeRequest = null;
        }
      };

      // Device A tries to delete Article B
      const result = await engine.batchDeleteArticles(['https://example.com/b']);
      expect(result[0].success).toBe(true);

      // After fix: B should be deleted, all others should remain
      const rows = server.getDataRows(spreadsheetId);
      const urls = rows.map(r => r[0]);
      expect(urls).toContain('https://example.com/a');
      expect(urls).toContain('https://example.com/c');
      expect(urls).not.toContain('https://example.com/b');
    });
  });

  describe('BUG: multi-device sync scenarios', () => {
    test('Device A creates article that Device B already added — no duplicates after sync', async () => {
      const { engine, spreadsheetId } = createEngine(server);

      // Device B saved articles [X, Y] to the sheet
      const x = makeArticle({ url: 'https://example.com/x', title: 'X' });
      const y = makeArticle({ url: 'https://example.com/y', title: 'Y' });
      server.simulateExternalAppend(spreadsheetId, articleToSheetRow(x));
      server.simulateExternalAppend(spreadsheetId, articleToSheetRow(y));

      // Device A independently creates X and a new article Z
      const z = makeArticle({ url: 'https://example.com/z', title: 'Z' });
      await engine.saveArticles([
        makeArticle({ url: 'https://example.com/x', title: 'X from A' }),
        z,
      ]);

      // After fix: should have exactly 3 unique articles, no duplicates
      const rows = server.getDataRows(spreadsheetId);
      const urls = rows.map(r => r[0]);
      expect(urls).toHaveLength(3);
      expect(new Set(urls).size).toBe(3);
      expect(urls).toContain('https://example.com/x');
      expect(urls).toContain('https://example.com/y');
      expect(urls).toContain('https://example.com/z');
    });

    test('single saveArticle also deduplicates when URL already exists', async () => {
      const { engine, spreadsheetId } = createEngine(server);

      // Device B already saved this article
      server.simulateExternalAppend(
        spreadsheetId,
        articleToSheetRow(makeArticle({ url: 'https://example.com/s1', title: 'B version' }))
      );

      // Device A saves the same URL via single saveArticle
      const result = await engine.saveArticle(
        makeArticle({ url: 'https://example.com/s1', title: 'A version' })
      );
      expect(result.success).toBe(true);

      const rows = server.getDataRows(spreadsheetId);
      const urlRows = rows.filter(r => r[0] === 'https://example.com/s1');
      expect(urlRows).toHaveLength(1);
      expect(urlRows[0][1]).toBe('A version');
    });

    test('cleanupDeletedArticles does not affect non-deleted articles', async () => {
      const { engine, spreadsheetId } = createEngine(server);

      const alive = makeArticle({ url: 'https://example.com/alive', title: 'Alive' });
      const deleted = makeArticle({
        url: 'https://example.com/deleted',
        title: 'Deleted',
        deletedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      });
      await engine.saveArticle(alive);
      await engine.saveArticle(deleted);

      const cleaned = await engine.cleanupDeletedArticles(30);
      expect(cleaned).toBe(1);

      const rows = server.getDataRows(spreadsheetId);
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe('https://example.com/alive');
    });

    test('getArticles returns no duplicates when sheet has duplicate URLs', async () => {
      const { engine, spreadsheetId } = createEngine(server);

      // Simulate pre-existing duplicate (from prior bug)
      const row = articleToSheetRow(makeArticle({ url: 'https://example.com/dup', title: 'V1' }));
      server.simulateExternalAppend(spreadsheetId, row);
      const row2 = articleToSheetRow(makeArticle({ url: 'https://example.com/dup', title: 'V2' }));
      server.simulateExternalAppend(spreadsheetId, row2);

      const articles = await engine.getArticles();

      // Should deduplicate — return only the latest version
      const dupArticles = articles.filter(a => a.url === 'https://example.com/dup');
      expect(dupArticles).toHaveLength(1);
      expect(dupArticles[0].title).toBe('V2'); // last row wins
    });
  });
});
