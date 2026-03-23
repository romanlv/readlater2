import { describe, it, expect } from 'vitest';
import { parseHtml } from './service.ts';

describe('parseHtml', () => {
  it('extracts og tags when present', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="OG Title" />
          <meta property="og:description" content="OG Description" />
          <meta property="og:image" content="https://example.com/image.jpg" />
          <title>Fallback Title</title>
        </head>
        <body><p>Some text</p></body>
      </html>
    `;

    const result = parseHtml(html, 'example.com');
    expect(result).toEqual({
      title: 'OG Title',
      description: 'OG Description',
      featuredImage: 'https://example.com/image.jpg',
      domain: 'example.com',
    });
  });

  it('falls back to title tag and meta description', () => {
    const html = `
      <html>
        <head>
          <title>Page Title</title>
          <meta name="description" content="Meta description" />
        </head>
        <body></body>
      </html>
    `;

    const result = parseHtml(html, 'example.com');
    expect(result).toEqual({
      title: 'Page Title',
      description: 'Meta description',
      featuredImage: '',
      domain: 'example.com',
    });
  });

  it('falls back to h1 and first paragraph', () => {
    const html = `
      <html>
        <head></head>
        <body>
          <h1>Main Heading</h1>
          <p>First paragraph of content here.</p>
        </body>
      </html>
    `;

    const result = parseHtml(html, 'example.com');
    expect(result).toEqual({
      title: 'Main Heading',
      description: 'First paragraph of content here.',
      featuredImage: '',
      domain: 'example.com',
    });
  });

  it('returns empty strings for missing metadata', () => {
    const html = '<html><head></head><body></body></html>';

    const result = parseHtml(html, 'example.com');
    expect(result).toEqual({
      title: '',
      description: '',
      featuredImage: '',
      domain: 'example.com',
    });
  });

  it('uses twitter:image as fallback for featured image', () => {
    const html = `
      <html>
        <head>
          <meta name="twitter:image" content="https://example.com/twitter.jpg" />
        </head>
        <body></body>
      </html>
    `;

    const result = parseHtml(html, 'example.com');
    expect(result.featuredImage).toBe('https://example.com/twitter.jpg');
  });

  it('truncates long paragraph descriptions to 300 chars', () => {
    const longText = 'A'.repeat(500);
    const html = `<html><body><p>${longText}</p></body></html>`;

    const result = parseHtml(html, 'example.com');
    expect(result.description.length).toBe(300);
  });
});
