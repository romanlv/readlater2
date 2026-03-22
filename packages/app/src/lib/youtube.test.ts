import { describe, test, expect } from 'vitest';
import { extractYouTubeVideoId, isYouTubeUrl } from './youtube';

describe('extractYouTubeVideoId', () => {
  test('extracts ID from standard watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from embed URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from /v/ URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID from shorts URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('extracts ID with extra query params', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('dQw4w9WgXcQ');
  });

  test('returns null for non-YouTube URLs', () => {
    expect(extractYouTubeVideoId('https://example.com/watch?v=abc')).toBeNull();
    expect(extractYouTubeVideoId('https://vimeo.com/123456')).toBeNull();
  });

  test('returns null for invalid URLs', () => {
    expect(extractYouTubeVideoId('not-a-url')).toBeNull();
    expect(extractYouTubeVideoId('')).toBeNull();
  });

  test('handles YouTube URL without video ID', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/')).toBeNull();
    expect(extractYouTubeVideoId('https://www.youtube.com/channel/UCxyz')).toBeNull();
  });
});

describe('isYouTubeUrl', () => {
  test('returns true for YouTube video URLs', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
    expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true);
  });

  test('returns false for non-YouTube URLs', () => {
    expect(isYouTubeUrl('https://example.com')).toBe(false);
    expect(isYouTubeUrl('not-a-url')).toBe(false);
  });
});
