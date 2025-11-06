import { describe, it, expect } from 'vitest';
import { extractUrls, removeUrlsFromText, parseSharedData } from './share-parser';

describe('extractUrls', () => {
  it('should extract a single URL from text', () => {
    const text = 'Check out this article: https://example.com/article';
    const urls = extractUrls(text);
    expect(urls).toEqual(['https://example.com/article']);
  });

  it('should extract multiple URLs from text', () => {
    const text = 'Visit https://example.com and https://another.com';
    const urls = extractUrls(text);
    expect(urls).toEqual(['https://example.com', 'https://another.com']);
  });

  it('should extract URLs with paths and query parameters', () => {
    const text = 'Podcast: https://podcastaddict.com/episode/12345?utm_source=share';
    const urls = extractUrls(text);
    expect(urls).toEqual(['https://podcastaddict.com/episode/12345?utm_source=share']);
  });

  it('should return empty array when no URLs found', () => {
    const text = 'Just some regular text without URLs';
    const urls = extractUrls(text);
    expect(urls).toEqual([]);
  });

  it('should extract http URLs', () => {
    const text = 'Visit http://insecure.com';
    const urls = extractUrls(text);
    expect(urls).toEqual(['http://insecure.com']);
  });

  it('should extract URLs from multiline text', () => {
    const text = `Title here
https://example.com/path
via @app`;
    const urls = extractUrls(text);
    expect(urls).toEqual(['https://example.com/path']);
  });
});

describe('removeUrlsFromText', () => {
  it('should remove URLs from text', () => {
    const text = 'Check out https://example.com for more info';
    const cleaned = removeUrlsFromText(text);
    expect(cleaned).toBe('Check out for more info');
  });

  it('should remove multiple URLs and normalize whitespace', () => {
    const text = 'Visit https://example.com and https://another.com today';
    const cleaned = removeUrlsFromText(text);
    expect(cleaned).toBe('Visit and today');
  });

  it('should remove URL and clean up empty lines', () => {
    const text = `Title
https://example.com
via @app`;
    const cleaned = removeUrlsFromText(text);
    expect(cleaned).toBe('Title\nvia @app');
  });

  it('should handle text with only URLs', () => {
    const text = 'https://example.com';
    const cleaned = removeUrlsFromText(text);
    expect(cleaned).toBe('');
  });

  it('should preserve text without URLs', () => {
    const text = 'Just regular text';
    const cleaned = removeUrlsFromText(text);
    expect(cleaned).toBe('Just regular text');
  });
});

describe('parseSharedData', () => {
  describe('Podcast Addict format', () => {
    it('should parse Podcast Addict share with URL in text field', () => {
      const rawData = {
        title: '',
        text: `[SOLVED with Mark Manson] How to Make Friends as an Adult  🅴 #solvedWithMarkManson
https://podcastaddict.com/solved-with-mark-manson/episode/209824729 via @PodcastAddict`,
        url: '',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://podcastaddict.com/solved-with-mark-manson/episode/209824729');
      // Whitespace is normalized (double spaces become single)
      expect(parsed.title).toBe('[SOLVED with Mark Manson] How to Make Friends as an Adult 🅴 #solvedWithMarkManson');
      expect(parsed.text).toBe('via @PodcastAddict');
    });

    it('should handle Podcast Addict share with complex episode title', () => {
      const rawData = {
        title: '',
        text: `Episode 123: The Future of AI & Machine Learning
https://podcastaddict.com/podcast/episode/123456
Shared via @PodcastAddict`,
        url: '',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://podcastaddict.com/podcast/episode/123456');
      expect(parsed.title).toBe('Episode 123: The Future of AI & Machine Learning');
      expect(parsed.text).toBe('Shared via @PodcastAddict');
    });
  });

  describe('Standard share format', () => {
    it('should handle standard share with all fields populated', () => {
      const rawData = {
        title: 'Article Title',
        text: 'Article description or excerpt',
        url: 'https://example.com/article',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://example.com/article');
      expect(parsed.title).toBe('Article Title');
      expect(parsed.text).toBe('Article description or excerpt');
    });

    it('should use URL as title when title is empty', () => {
      const rawData = {
        title: '',
        text: 'Some description',
        url: 'https://example.com/article',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://example.com/article');
      expect(parsed.title).toBe('https://example.com/article');
      expect(parsed.text).toBe('Some description');
    });

    it('should extract URL from text when URL field is empty', () => {
      const rawData = {
        title: 'Article Title',
        text: 'Check this out: https://example.com/article with more info',
        url: '',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://example.com/article');
      expect(parsed.title).toBe('Article Title');
      expect(parsed.text).toBe('Check this out: with more info');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty data', () => {
      const rawData = {
        title: '',
        text: '',
        url: '',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('');
      expect(parsed.title).toBe('');
      expect(parsed.text).toBe('');
    });

    it('should handle undefined fields', () => {
      const rawData = {};

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('');
      expect(parsed.title).toBe('');
      expect(parsed.text).toBe('');
    });

    it('should handle text with only URL and no other content', () => {
      const rawData = {
        title: '',
        text: 'https://example.com/article',
        url: '',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://example.com/article');
      expect(parsed.title).toBe('https://example.com/article');
      expect(parsed.text).toBe('');
    });

    it('should extract first URL when multiple URLs in text', () => {
      const rawData = {
        title: '',
        text: 'Visit https://first.com or https://second.com',
        url: '',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://first.com');
      expect(parsed.title).toBe('Visit or');
      expect(parsed.text).toBe('');
    });

    it('should use first line as title when title is empty and text has multiple lines', () => {
      const rawData = {
        title: '',
        text: `First line title
Second line description
https://example.com`,
        url: '',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://example.com');
      expect(parsed.title).toBe('First line title');
      expect(parsed.text).toBe('Second line description');
    });

    it('should trim whitespace from all fields', () => {
      const rawData = {
        title: '  Title with spaces  ',
        text: '  Text with spaces  ',
        url: '  https://example.com  ',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://example.com');
      expect(parsed.title).toBe('Title with spaces');
      expect(parsed.text).toBe('Text with spaces');
    });
  });

  describe('Real-world app formats', () => {
    it('should handle YouTube app share', () => {
      const rawData = {
        title: 'Video Title from YouTube',
        text: 'Video description',
        url: 'https://youtube.com/watch?v=abc123',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://youtube.com/watch?v=abc123');
      expect(parsed.title).toBe('Video Title from YouTube');
      expect(parsed.text).toBe('Video description');
    });

    it('should handle Twitter/X share format', () => {
      const rawData = {
        title: '',
        text: 'Tweet text here https://twitter.com/user/status/123456',
        url: '',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://twitter.com/user/status/123456');
      expect(parsed.title).toBe('Tweet text here');
      expect(parsed.text).toBe('');
    });

    it('should handle Reddit share format', () => {
      const rawData = {
        title: 'Post Title',
        text: 'https://reddit.com/r/subreddit/comments/abc123',
        url: 'https://reddit.com/r/subreddit/comments/abc123',
      };

      const parsed = parseSharedData(rawData);

      expect(parsed.url).toBe('https://reddit.com/r/subreddit/comments/abc123');
      expect(parsed.title).toBe('Post Title');
      expect(parsed.text).toBe('');
    });
  });
});
