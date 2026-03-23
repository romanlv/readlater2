import * as cheerio from 'cheerio';
import { config } from '../../config.ts';
import { AppError } from '../../lib/errors.ts';
import type { MetadataResponse } from './types.ts';

export async function extractMetadata(url: string): Promise<MetadataResponse> {
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname.replace(/^www\./, '');

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.metadata.fetchTimeoutMs,
    );

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ReadLaterBot/1.0; +https://github.com/nicedoc/readlater)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new AppError('URL does not point to an HTML page', 422);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > config.metadata.maxResponseBytes) {
      throw new AppError('Response too large', 422);
    }

    html = await response.text();
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AppError('Page took too long to respond', 504);
    }
    throw new AppError(
      `Could not fetch URL: ${err instanceof Error ? err.message : 'unknown error'}`,
      422,
    );
  }

  return parseHtml(html, domain);
}

export function parseHtml(html: string, domain: string): MetadataResponse {
  const $ = cheerio.load(html);

  const getMeta = (name: string): string =>
    $(`meta[property="${name}"]`).attr('content') ??
    $(`meta[name="${name}"]`).attr('content') ??
    '';

  const title =
    getMeta('og:title') ||
    $('title').text().trim() ||
    $('h1').first().text().trim();

  const description =
    getMeta('og:description') ||
    getMeta('description') ||
    $('p').first().text().trim().slice(0, 300);

  const featuredImage =
    getMeta('og:image') ||
    getMeta('twitter:image') ||
    '';

  return { title, description, featuredImage, domain };
}
