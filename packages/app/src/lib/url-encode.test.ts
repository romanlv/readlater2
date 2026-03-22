import { describe, test, expect } from 'vitest';
import { encodeBase64Url, decodeBase64Url, encodeArticleUrl, decodeArticleUrl } from './url-encode';

describe('encodeBase64Url', () => {
  test('encodes a simple string', () => {
    const encoded = encodeBase64Url('hello');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  test('round-trips a simple string', () => {
    const original = 'hello world';
    expect(decodeBase64Url(encodeBase64Url(original))).toBe(original);
  });

  test('round-trips a URL with special characters', () => {
    const original = 'https://example.com/path?q=test&page=2#section';
    expect(decodeBase64Url(encodeBase64Url(original))).toBe(original);
  });
});

describe('decodeBase64Url', () => {
  test('restores padding and decodes', () => {
    const encoded = encodeBase64Url('test');
    const decoded = decodeBase64Url(encoded);
    expect(decoded).toBe('test');
  });
});

describe('encodeArticleUrl / decodeArticleUrl', () => {
  test('round-trips article URLs', () => {
    const url = 'https://example.com/article/some-title?ref=homepage';
    const encoded = encodeArticleUrl(url);
    expect(decodeArticleUrl(encoded)).toBe(url);
  });

  test('handles YouTube URLs', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest';
    const encoded = encodeArticleUrl(url);
    expect(decodeArticleUrl(encoded)).toBe(url);
  });

  test('decodeArticleUrl returns empty string for invalid input', () => {
    expect(decodeArticleUrl('!!!invalid!!!')).toBe('');
  });

  test('encoded URL is URL-safe', () => {
    const encoded = encodeArticleUrl('https://example.com/path?a=1&b=2');
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
