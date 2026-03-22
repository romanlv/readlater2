import { describe, test, expect } from 'vitest';
import { extractPageData, isValidUrl, extractDomain } from './page-extractor';

describe('extractPageData', () => {
  test('extracts data from a tab with all fields', () => {
    const tab = {
      url: 'https://example.com/article',
      title: 'Test Article',
      favIconUrl: 'https://example.com/favicon.ico',
    };

    const result = extractPageData(tab);

    expect(result.url).toBe('https://example.com/article');
    expect(result.title).toBe('Test Article');
    expect(result.domain).toBe('example.com');
    expect(result.featuredImage).toBe('https://example.com/favicon.ico');
    expect(result.description).toBe('');
    expect(result.archived).toBe(false);
    expect(result.favorite).toBe(false);
    expect(result.tags).toEqual([]);
    expect(result.notes).toBe('');
  });

  test('generates ISO timestamp', () => {
    const result = extractPageData({ url: 'https://example.com' });
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('handles missing fields gracefully', () => {
    const result = extractPageData({});

    expect(result.url).toBe('');
    expect(result.title).toBe('');
    expect(result.domain).toBe('');
    expect(result.featuredImage).toBe('');
  });

  test('handles undefined favIconUrl', () => {
    const result = extractPageData({
      url: 'https://example.com',
      title: 'Title',
    });

    expect(result.featuredImage).toBe('');
  });
});

describe('isValidUrl', () => {
  test('returns true for valid http URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path')).toBe(true);
  });

  test('returns true for URLs with query params and hash', () => {
    expect(isValidUrl('https://example.com/path?q=test#section')).toBe(true);
  });

  test('returns false for invalid strings', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });

  test('returns true for non-http protocols', () => {
    expect(isValidUrl('ftp://files.example.com')).toBe(true);
  });
});

describe('extractDomain', () => {
  test('extracts hostname from URL', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
    expect(extractDomain('https://example.com')).toBe('example.com');
  });

  test('returns empty string for invalid URLs', () => {
    expect(extractDomain('not-a-url')).toBe('');
    expect(extractDomain('')).toBe('');
  });

  test('handles URLs with ports', () => {
    expect(extractDomain('http://localhost:3000/path')).toBe('localhost');
  });
});
