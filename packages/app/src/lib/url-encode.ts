/**
 * Base64url encoding/decoding utilities for clean URL routing
 * Uses URL-safe base64 (no +, /, = characters)
 */

/**
 * Encodes a string to base64url format (URL-safe, no padding)
 */
export function encodeBase64Url(str: string): string {
  // Convert string to base64
  const base64 = btoa(str);

  // Make it URL-safe: replace +/= with -_
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decodes a base64url string back to the original string
 */
export function decodeBase64Url(base64url: string): string {
  // Convert back to standard base64
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }

  // Decode from base64
  return atob(base64);
}

/**
 * Encodes an article URL for use in routing
 */
export function encodeArticleUrl(url: string): string {
  return encodeBase64Url(url);
}

/**
 * Decodes an encoded article URL from routing
 */
export function decodeArticleUrl(encodedUrl: string): string {
  try {
    return decodeBase64Url(encodedUrl);
  } catch (error) {
    console.error('Failed to decode article URL:', error);
    return '';
  }
}
