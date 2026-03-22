import type { ArticleData } from '../types/article.js';

/**
 * Validates that an ArticleData object has the minimum required fields.
 */
export function isValidArticle(article: Partial<ArticleData>): article is ArticleData {
  return (
    typeof article.url === 'string' &&
    article.url.length > 0 &&
    typeof article.title === 'string' &&
    typeof article.description === 'string' &&
    typeof article.featuredImage === 'string' &&
    typeof article.timestamp === 'string' &&
    typeof article.domain === 'string'
  );
}

/**
 * Validates that a URL string is well-formed and uses http/https.
 */
export function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes a string for safe display (strips control characters).
 */
export function sanitizeDisplayString(input: string): string {
  // Remove control characters except newline and tab
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validates that tags are well-formed (non-empty, trimmed strings).
 */
export function sanitizeTags(tags: string[]): string[] {
  return tags
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .filter((tag, index, self) => self.indexOf(tag) === index); // deduplicate
}
