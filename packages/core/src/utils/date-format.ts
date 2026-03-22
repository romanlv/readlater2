/**
 * Converts a Unix timestamp (milliseconds) to an ISO 8601 string.
 * Used when converting IndexedDB timestamps to Google Sheets format.
 */
export function unixMsToIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Converts an ISO 8601 string to a Unix timestamp (milliseconds).
 * Used when converting Google Sheets timestamps to IndexedDB format.
 */
export function isoToUnixMs(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Formats a timestamp as a relative time string (e.g., "2m ago", "3h ago", "5d ago").
 */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;

  if (diff < 0) return 'just now';
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Formats a timestamp as a short date string (YYYY-MM-DD).
 */
export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split('T')[0];
}

/**
 * Returns the more recent of two optional timestamps.
 * Used in conflict resolution to determine which version wins.
 */
export function mostRecent(a?: number | string, b?: number | string): number {
  const timeA = a ? (typeof a === 'string' ? new Date(a).getTime() : a) : 0;
  const timeB = b ? (typeof b === 'string' ? new Date(b).getTime() : b) : 0;
  return Math.max(timeA, timeB);
}
