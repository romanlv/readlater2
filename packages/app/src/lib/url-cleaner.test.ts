import { describe, test, expect } from 'vitest';
import { cleanUrl, isValidUrl } from './url-cleaner';

describe('cleanUrl', () => {
  test('removes UTM tracking parameters', () => {
    const url = 'https://example.com/article?utm_source=twitter&utm_medium=social&utm_campaign=2024';
    expect(cleanUrl(url)).toBe('https://example.com/article');
  });

  test('removes Facebook tracking (fbclid)', () => {
    const url = 'https://example.com/article?fbclid=IwAR123xyz';
    expect(cleanUrl(url)).toBe('https://example.com/article');
  });

  test('removes Google tracking (gclid, _ga)', () => {
    const url = 'https://example.com/article?gclid=CjwKCAjw&_ga=GA1.2.123';
    expect(cleanUrl(url)).toBe('https://example.com/article');
  });

  test('removes multiple tracking params together', () => {
    const url = 'https://example.com/article?utm_source=fb&fbclid=abc&gclid=xyz';
    expect(cleanUrl(url)).toBe('https://example.com/article');
  });

  test('keeps legitimate query parameters', () => {
    const url = 'https://example.com/search?q=test&page=2&utm_source=email';
    expect(cleanUrl(url)).toBe('https://example.com/search?q=test&page=2');
  });

  test('preserves ref and referrer parameters', () => {
    const url = 'https://example.com/article?ref=homepage&utm_source=test';
    expect(cleanUrl(url)).toBe('https://example.com/article?ref=homepage');
  });

  test('handles URL with no tracking params', () => {
    const url = 'https://example.com/article';
    expect(cleanUrl(url)).toBe('https://example.com/article');
  });

  test('returns original URL if invalid', () => {
    const url = 'not-a-valid-url';
    expect(cleanUrl(url)).toBe('not-a-valid-url');
  });
});

describe('isValidUrl', () => {
  test('returns true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path')).toBe(true);
  });

  test('returns false for invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});
