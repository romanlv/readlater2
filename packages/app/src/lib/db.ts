import Dexie, { Table } from 'dexie';

export interface Article {
  url: string;              // Primary key (normalized; strip UTM params, etc.)
  title: string;
  description?: string;
  featuredImage?: string;   // From og:image meta tag
  domain: string;
  tags: string[];
  notes?: string;
  archived: boolean;
  favorite: boolean;
  timestamp: number;        // When article was created (ms since epoch)
  editedAt?: number;        // When article was last modified (ms since epoch, optional)
  deletedAt?: number;       // When article was soft deleted (ms since epoch, optional)
  syncStatus: 'synced' | 'pending';  // No 'conflict' - auto-resolved with LWW
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  articleUrl: string;
  data: Partial<Article>;
  timestamp: number;
  retryCount: number;
}

export interface PaginationCursor {
  timestamp: number;
  url: string;              // Secondary key for uniqueness
}

export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: PaginationCursor;
  totalCount?: number;      // Optional, for UI indicators
}

class ReadLaterDB extends Dexie {
  articles!: Table<Article>;
  syncQueue!: Table<SyncOperation>;

  constructor() {
    super('ReadLaterDB');
    this.version(1).stores({
      // Simplified single-field indexes for optimal performance
      articles: 'url, timestamp, archived, favorite, domain, syncStatus, editedAt, deletedAt, *tags',
      syncQueue: 'id, timestamp, type, articleUrl'
    });
  }
}

export const db = new ReadLaterDB();