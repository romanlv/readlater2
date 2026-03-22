import { describe, test, expect } from 'vitest';
import { isValidArticle, isHttpUrl, sanitizeDisplayString, sanitizeTags } from './validators';

describe('isValidArticle', () => {
  const validArticle = {
    url: 'https://example.com',
    title: 'Test',
    description: 'A description',
    featuredImage: '',
    timestamp: '2023-01-01T00:00:00.000Z',
    domain: 'example.com',
  };

  test('returns true for a valid article', () => {
    expect(isValidArticle(validArticle)).toBe(true);
  });

  test('returns true with optional fields', () => {
    expect(isValidArticle({ ...validArticle, tags: ['test'], notes: 'note' })).toBe(true);
  });

  test('returns false when url is missing', () => {
    expect(isValidArticle({ ...validArticle, url: undefined })).toBe(false);
  });

  test('returns false when url is empty', () => {
    expect(isValidArticle({ ...validArticle, url: '' })).toBe(false);
  });

  test('returns false when title is missing', () => {
    expect(isValidArticle({ ...validArticle, title: undefined })).toBe(false);
  });

  test('returns false when timestamp is missing', () => {
    expect(isValidArticle({ ...validArticle, timestamp: undefined })).toBe(false);
  });

  test('returns false for empty object', () => {
    expect(isValidArticle({})).toBe(false);
  });
});

describe('isHttpUrl', () => {
  test('returns true for https URLs', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('https://example.com/path?q=1')).toBe(true);
  });

  test('returns true for http URLs', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  test('returns false for non-http protocols', () => {
    expect(isHttpUrl('ftp://files.example.com')).toBe(false);
    expect(isHttpUrl('file:///local/path')).toBe(false);
  });

  test('returns false for invalid strings', () => {
    expect(isHttpUrl('not-a-url')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('sanitizeDisplayString', () => {
  test('removes control characters', () => {
    expect(sanitizeDisplayString('hello\x00world')).toBe('helloworld');
    expect(sanitizeDisplayString('\x01\x02test\x7F')).toBe('test');
  });

  test('preserves newlines and tabs', () => {
    expect(sanitizeDisplayString('line1\nline2\ttab')).toBe('line1\nline2\ttab');
  });

  test('preserves normal text', () => {
    expect(sanitizeDisplayString('Hello, World!')).toBe('Hello, World!');
  });

  test('preserves unicode characters', () => {
    expect(sanitizeDisplayString('Héllo Wörld 🌍')).toBe('Héllo Wörld 🌍');
  });
});

describe('sanitizeTags', () => {
  test('trims whitespace from tags', () => {
    expect(sanitizeTags([' tech ', ' ai '])).toEqual(['tech', 'ai']);
  });

  test('removes empty tags', () => {
    expect(sanitizeTags(['tech', '', '  ', 'ai'])).toEqual(['tech', 'ai']);
  });

  test('deduplicates tags', () => {
    expect(sanitizeTags(['tech', 'ai', 'tech', 'AI'])).toEqual(['tech', 'ai', 'AI']);
  });

  test('handles empty array', () => {
    expect(sanitizeTags([])).toEqual([]);
  });

  test('combines trimming, filtering, and deduplication', () => {
    expect(sanitizeTags([' tech ', '', ' tech', 'ai', '  ', 'ai '])).toEqual(['tech', 'ai']);
  });
});
