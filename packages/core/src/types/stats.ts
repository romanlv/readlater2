/**
 * Aggregate statistics about the user's article collection.
 */
export interface ArticleStats {
  /** Total number of articles */
  total: number;
  /** Number of active (non-archived, non-deleted) articles */
  active: number;
  /** Number of archived articles */
  archived: number;
  /** Number of favorited articles */
  favorites: number;
  /** Number of soft-deleted articles */
  deleted: number;
}

/**
 * Per-tag count for tag distribution display.
 */
export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Per-domain count for domain distribution display.
 */
export interface DomainCount {
  domain: string;
  count: number;
}

/**
 * Time-based grouping for articles saved over time.
 */
export interface TimeGroupCount {
  /** Date string (YYYY-MM-DD) */
  date: string;
  count: number;
}
