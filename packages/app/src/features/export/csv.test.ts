import { describe, test, expect } from 'vitest';
import { articlesToCsv, parseCsvToArticles, parseCsvRows } from './csv';
import { Article } from '@/lib/db';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    url: 'https://example.com/article',
    title: 'Test Article',
    description: 'A description',
    featuredImage: '',
    domain: 'example.com',
    tags: ['tag1', 'tag2'],
    notes: 'Some notes',
    archived: false,
    favorite: true,
    timestamp: new Date('2024-06-15T12:00:00Z').getTime(),
    syncStatus: 'synced',
    ...overrides,
  };
}

describe('articlesToCsv', () => {
  test('produces correct header and row', () => {
    const csv = articlesToCsv([makeArticle()]);
    const lines = csv.replace(/^\uFEFF/, '').split('\n');

    expect(lines[0]).toBe('"url","title","description","domain","tags","notes","archived","favorite","timestamp"');
    expect(lines[1]).toContain('"https://example.com/article"');
    expect(lines[1]).toContain('"tag1|tag2"');
    expect(lines[1]).toContain('"false"');
    expect(lines[1]).toContain('"true"');
    expect(lines[1]).toContain('"2024-06-15T12:00:00.000Z"');
  });

  test('escapes double quotes in fields', () => {
    const csv = articlesToCsv([makeArticle({ title: 'Article with "quotes"' })]);
    expect(csv).toContain('"Article with ""quotes"""');
  });

  test('handles empty tags and missing optional fields', () => {
    const csv = articlesToCsv([makeArticle({ tags: [], description: undefined, notes: undefined })]);
    const lines = csv.replace(/^\uFEFF/, '').split('\n');
    // tags field should be empty, description and notes empty strings
    expect(lines[1]).toContain(',"",');
  });

  test('starts with UTF-8 BOM', () => {
    const csv = articlesToCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });
});

describe('parseCsvRows', () => {
  test('parses simple rows', () => {
    const rows = parseCsvRows('"a","b","c"\n"1","2","3"');
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  test('handles commas inside quoted fields', () => {
    const rows = parseCsvRows('"hello, world","test"');
    expect(rows[0][0]).toBe('hello, world');
  });

  test('handles escaped quotes', () => {
    const rows = parseCsvRows('"say ""hello""","ok"');
    expect(rows[0][0]).toBe('say "hello"');
  });

  test('handles newlines inside quoted fields', () => {
    const rows = parseCsvRows('"line1\nline2","val"\n"a","b"');
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe('line1\nline2');
  });

  test('skips empty rows', () => {
    const rows = parseCsvRows('"a"\n\n"b"');
    expect(rows).toHaveLength(2);
  });
});

describe('parseCsvToArticles', () => {
  test('parses exported CSV back to articles (round-trip)', () => {
    const original = [makeArticle(), makeArticle({ url: 'https://other.com', domain: 'other.com', tags: [] })];
    const csv = articlesToCsv(original);
    const { articles, errors } = parseCsvToArticles(csv);

    expect(errors).toHaveLength(0);
    expect(articles).toHaveLength(2);
    expect(articles[0].url).toBe('https://example.com/article');
    expect(articles[0].title).toBe('Test Article');
    expect(articles[0].tags).toEqual(['tag1', 'tag2']);
    expect(articles[0].favorite).toBe(true);
    expect(articles[0].archived).toBe(false);
    expect(articles[0].syncStatus).toBe('pending');
    expect(articles[1].tags).toEqual([]);
  });

  test('returns error for empty CSV', () => {
    const { articles, errors } = parseCsvToArticles('');
    expect(articles).toHaveLength(0);
    expect(errors[0]).toContain('Empty');
  });

  test('returns error when url column is missing', () => {
    const { errors } = parseCsvToArticles('"title","domain"\n"Test","example.com"');
    expect(errors[0]).toContain('url');
  });

  test('skips rows with missing URL value', () => {
    const csv = '"url","title"\n"","No URL"\n"https://valid.com","Valid"';
    const { articles, errors } = parseCsvToArticles(csv);
    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe('https://valid.com');
    expect(errors).toHaveLength(1);
  });

  test('derives domain from URL when not provided', () => {
    const csv = '"url","title"\n"https://example.com/page","A Page"';
    const { articles } = parseCsvToArticles(csv);
    expect(articles[0].domain).toBe('example.com');
  });

  test('defaults missing fields', () => {
    const csv = '"url"\n"https://example.com"';
    const { articles } = parseCsvToArticles(csv);
    expect(articles[0].title).toBe('https://example.com');
    expect(articles[0].archived).toBe(false);
    expect(articles[0].favorite).toBe(false);
    expect(articles[0].tags).toEqual([]);
  });

  test('handles fields with commas and quotes', () => {
    const original = [makeArticle({ description: 'Has "quotes" and, commas' })];
    const csv = articlesToCsv(original);
    const { articles } = parseCsvToArticles(csv);
    expect(articles[0].description).toBe('Has "quotes" and, commas');
  });
});
