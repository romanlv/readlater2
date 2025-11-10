/**
 * Extracts and parses shared content from various apps
 */

export interface ParsedShareData {
  url: string;
  title: string;
  text: string;
}

/**
 * URL regex pattern that matches http/https URLs
 */
const URL_PATTERN = /https?:\/\/[^\s]+/gi;

/**
 * Extracts URLs from text content
 * @param text - The text to search for URLs
 * @returns Array of found URLs
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN);
  return matches || [];
}

/**
 * Removes URLs from text content
 * @param text - The text to clean
 * @returns Text with URLs removed and whitespace normalized
 */
export function removeUrlsFromText(text: string): string {
  return text
    .split('\n')
    .map(line =>
      line
        .replace(URL_PATTERN, ' ') // Replace URLs with space
        .replace(/ +/g, ' ') // Normalize multiple spaces to single space (within line)
        .trim()
    )
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

/**
 * Parses shared data from Web Share Target API
 * Handles cases where apps (like Podcast Addict) put everything in the text field
 *
 * @param rawData - Raw data from the share target
 * @returns Parsed and structured share data
 */
export function parseSharedData(rawData: {
  title?: string;
  text?: string;
  url?: string;
}): ParsedShareData {
  let url = rawData.url || '';
  let title = rawData.title || '';
  let text = rawData.text || '';

  // If no URL provided, try to extract from text
  if (!url && text) {
    const extractedUrls = extractUrls(text);
    if (extractedUrls.length > 0) {
      // Use the first URL found
      url = extractedUrls[0];
      // Remove the URL from text to keep description clean
      text = removeUrlsFromText(text);
    }
  }

  // If URL was provided but also appears in text, remove it from text
  if (url && text) {
    const textUrls = extractUrls(text);
    if (textUrls.includes(url)) {
      text = removeUrlsFromText(text);
    }
  }

  // If no title provided, decide between using text or URL as title
  if (!title) {
    if (text && !rawData.url) {
      // URL was extracted from text, so use first line of text as title
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        title = lines[0];
        // Remove title from text if text has multiple lines
        if (lines.length > 1) {
          text = lines.slice(1).join('\n').trim();
        } else {
          // If only one line and it's used as title, clear text
          text = '';
        }
      }
    } else if (url) {
      // URL was provided separately, use it as title and keep text as description
      title = url;
    }
  }

  return {
    url: url.trim(),
    title: title.trim(),
    text: text.trim(),
  };
}
