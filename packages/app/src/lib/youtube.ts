/**
 * Extracts YouTube video ID from various YouTube URL formats
 * Supports:
 * - youtube.com/watch?v=VIDEO_ID
 * - youtu.be/VIDEO_ID
 * - youtube.com/embed/VIDEO_ID
 * - youtube.com/v/VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check if it's a YouTube domain
    if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
      return null;
    }

    // youtu.be/VIDEO_ID
    if (hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1).split('?')[0];
    }

    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.pathname === '/watch') {
      return urlObj.searchParams.get('v');
    }

    // youtube.com/embed/VIDEO_ID or youtube.com/v/VIDEO_ID or youtube.com/shorts/VIDEO_ID
    const pathMatch = urlObj.pathname.match(/^\/(embed|v|shorts)\/([^/?]+)/);
    if (pathMatch) {
      return pathMatch[2];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if a URL is a YouTube video URL
 */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}
