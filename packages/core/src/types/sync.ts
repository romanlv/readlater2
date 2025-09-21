import { ArticleData } from './article.js';

export interface SyncResult {
  success: boolean;
  error?: string;
  articleUrl?: string;
}

export interface SyncEngine {
  saveArticle(article: ArticleData): Promise<SyncResult>;
  getArticles?(): Promise<ArticleData[]>;
  deleteArticle?(url: string): Promise<SyncResult>;
  updateArticle?(url: string, updates: Partial<ArticleData>): Promise<SyncResult>;
  syncWithConflictResolution?(localArticles: ArticleData[]): Promise<SyncResult[]>;
}

export interface AuthProvider {
  getAuthToken(): Promise<string>;
  isAuthenticated(): Promise<boolean>;
  authenticate(): Promise<void>;
}