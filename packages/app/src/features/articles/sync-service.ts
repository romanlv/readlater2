import { Article, SyncOperation } from '../../lib/db.js';
import { ArticleData, GoogleSheetsConfig } from './types.js';
import { initializeGoogleSheetsSync, AuthenticationRequiredError, getAuthProvider } from './google-sheets.js';
import { articleRepository } from './repository.js';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'auth-required';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime?: number;
  error?: string;
}

export class SyncService {
  private syncState: SyncState = {
    status: 'idle',
    pendingCount: 0
  };

  private listeners: ((state: SyncState) => void)[] = [];
  private config: GoogleSheetsConfig | null = null;

  constructor() {
    this.updatePendingCount();
  }

  public configure(config: GoogleSheetsConfig): void {
    this.config = config;
  }

  public getState(): SyncState {
    return { ...this.syncState };
  }

  public subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private setState(updates: Partial<SyncState>): void {
    this.syncState = { ...this.syncState, ...updates };
    this.listeners.forEach(listener => listener(this.syncState));
  }

  private async updatePendingCount(): Promise<void> {
    try {
      const pendingCount = await articleRepository.getPendingArticlesCount();
      this.setState({ pendingCount });
    } catch (error) {
      console.error('Failed to update pending count:', error);
    }
  }

  public async syncNow(): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      const error = 'Sync service not configured';
      this.setState({ status: 'error', error });
      return { success: false, error };
    }

    if (this.syncState.status === 'syncing') {
      return { success: false, error: 'Sync already in progress' };
    }

    this.setState({ status: 'syncing', error: undefined });

    try {
      // Step 1: Process outgoing changes (sync queue)
      await this.processSyncQueue();

      // Step 2: Fetch and merge remote changes
      await this.syncFromRemote();

      // Step 3: Update state
      await this.updatePendingCount();
      this.setState({
        status: 'idle',
        lastSyncTime: Date.now(),
        error: undefined
      });

      return { success: true };
    } catch (error) {
      console.error('Sync failed:', error);

      if (error instanceof AuthenticationRequiredError) {
        this.setState({ status: 'auth-required', error: 'Authentication required' });
        return { success: false, error: 'Authentication required' };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      this.setState({ status: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async processSyncQueue(): Promise<void> {
    const operations = await articleRepository.getPendingSyncOperations();
    const syncEngine = initializeGoogleSheetsSync(this.config!);

    for (const operation of operations) {
      try {
        await this.processSyncOperation(operation, syncEngine);
        await articleRepository.removeSyncOperation(operation.id);
      } catch (error) {
        console.error(`Failed to process sync operation ${operation.id}:`, error);

        // Handle authentication errors differently
        if (error instanceof AuthenticationRequiredError) {
          throw error; // Re-throw auth errors to stop sync
        }

        // Increment retry count for other errors
        await articleRepository.incrementSyncRetryCount(operation.id);

        // Remove operation if it has failed too many times (3 total attempts)
        if (operation.retryCount >= 2) {
          console.warn(`Removing sync operation ${operation.id} after ${operation.retryCount + 1} failed attempts`);
          await articleRepository.removeSyncOperation(operation.id);
        }
      }
    }
  }

  private async processSyncOperation(
    operation: SyncOperation,
    syncEngine: ReturnType<typeof initializeGoogleSheetsSync>
  ): Promise<void> {
    switch (operation.type) {
      case 'create':
        if (operation.data.url) {
          const article = operation.data as Article;
          const articleData = this.articleToSheetData(article);
          await syncEngine.saveArticle(articleData);
          await articleRepository.markAsSynced(operation.articleUrl);
        }
        break;
      case 'update':
        if (operation.data.url) {
          const article = operation.data as Article;
          const articleData = this.articleToSheetData(article);
          await syncEngine.updateArticle(operation.articleUrl, articleData);
          await articleRepository.markAsSynced(operation.articleUrl);
        }
        break;
      case 'delete':
        await syncEngine.deleteArticle(operation.articleUrl);
        break;
    }
  }

  private async syncFromRemote(): Promise<void> {
    const syncEngine = initializeGoogleSheetsSync(this.config!);

    try {
      const remoteArticles = await syncEngine.getArticles();

      // Get pending operations to avoid re-adding articles that are queued for deletion
      const pendingOperations = await articleRepository.getPendingSyncOperations();
      const pendingDeletes = new Set(
        pendingOperations
          .filter(op => op.type === 'delete')
          .map(op => op.articleUrl)
      );

      for (const remoteArticleData of remoteArticles) {
        // Skip articles that are pending deletion
        if (pendingDeletes.has(remoteArticleData.url)) {
          console.log(`Skipping remote article ${remoteArticleData.url} - pending deletion`);
          continue;
        }

        const localArticle = await articleRepository.getByUrl(remoteArticleData.url);
        const remoteArticle = this.sheetDataToArticle(remoteArticleData);

        if (!localArticle) {
          // New remote article - add it locally
          await articleRepository.bulkUpdate([
            { ...remoteArticle, syncStatus: 'synced' as const }
          ]);
        } else {
          // Resolve conflict using Last Write Wins (LWW)
          const winner = this.resolveConflict(localArticle, remoteArticle);
          await articleRepository.bulkUpdate([
            { ...winner, syncStatus: 'synced' as const }
          ]);
        }
      }

      // Handle deletions - remove local articles that no longer exist remotely
      const remoteUrls = new Set(remoteArticles.map(a => a.url));
      const localArticles = await articleRepository.getAllArticles();

      for (const localArticle of localArticles) {
        if (!remoteUrls.has(localArticle.url) && localArticle.syncStatus === 'synced') {
          // Use deleteLocalOnly to avoid queueing another delete operation
          await articleRepository.deleteLocalOnly(localArticle.url);
        }
      }

    } catch (error) {
      console.error('Failed to sync from remote:', error);
      throw error;
    }
  }

  private resolveConflict(local: Article, remote: Article): Article {
    const localTime = local.editedAt || local.timestamp;
    const remoteTime = remote.editedAt || remote.timestamp;

    // Later timestamp wins; ties go to remote for consistency
    return remoteTime >= localTime ? remote : local;
  }

  private articleToSheetData(article: Article): ArticleData {
    return {
      url: article.url,
      title: article.title,
      description: article.description || '',
      featuredImage: article.featuredImage || '',
      domain: article.domain,
      timestamp: new Date(article.timestamp).toISOString(),
      tags: article.tags,
      notes: article.notes,
      archived: article.archived,
      favorite: article.favorite,
      editedAt: article.editedAt ? new Date(article.editedAt).toISOString() : undefined
    };
  }

  private sheetDataToArticle(data: ArticleData): Article {
    return {
      url: data.url,
      title: data.title,
      description: data.description,
      featuredImage: data.featuredImage,
      domain: data.domain,
      timestamp: new Date(data.timestamp).getTime(),
      tags: data.tags || [],
      notes: data.notes,
      archived: data.archived || false,
      favorite: data.favorite || false,
      editedAt: data.editedAt ? new Date(data.editedAt).getTime() : undefined,
      syncStatus: 'synced'
    };
  }

  public async authenticate(): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'Sync service not configured' };
    }

    try {
      const authProvider = getAuthProvider();

      // Check if we have a stored token first
      if (await authProvider.isAuthenticated()) {
        this.setState({ status: 'idle', error: undefined });
        return { success: true };
      }

      // Handle any existing auth redirect
      const handled = await authProvider.handleRedirect();
      if (handled) {
        this.setState({ status: 'idle', error: undefined });
        return { success: true };
      }

      // No stored token and no redirect, need to authenticate
      authProvider.redirectToAuth();
      return { success: false, error: 'Redirecting to authentication' };

    } catch (error) {
      console.error('Authentication failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.setState({ status: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  public async clearAllData(): Promise<void> {
    await articleRepository.clearSyncQueue();
    await this.updatePendingCount();
  }
}

export const syncService = new SyncService();