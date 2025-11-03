import { Article, SyncOperation } from '../../lib/db.js';
import { ArticleData, GoogleSheetsConfig } from './types.js';
import { initializeGoogleSheetsSync, AuthenticationRequiredError, getAuthProvider } from './google-sheets.js';
import { articleRepository, ArticleRepository } from './repository.js';
import type { GoogleSheetsSyncEngine, PwaAuthProvider } from '@readlater/google-sheets-sync';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'auth-required' | 'checking-auth' | 'not-authenticated';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime?: number;
  error?: string;
}

interface SyncCheckpoint {
  timestamp: number;
  articleCount: number;
  syncQueueCount: number;
  lastSyncTime?: number;
}

interface SyncQueueResult {
  processed: number;
  failures: number;
  errors: string[];
}

// Sync timeout configuration
const SYNC_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Service for synchronizing articles with Google Sheets.
 *
 * Dependencies can be injected via constructor for testing purposes.
 * Production code should use the exported singleton instance.
 */
export class SyncService {
  private syncState: SyncState = {
    status: 'idle',
    pendingCount: 0
  };

  private listeners: ((state: SyncState) => void)[] = [];
  private config: GoogleSheetsConfig | null = null;

  /**
   * Creates a new SyncService instance.
   *
   * @param repository - Article repository for local storage operations (default: singleton instance)
   * @param syncEngineFactory - Factory function to create sync engine instances (default: initializeGoogleSheetsSync)
   * @param authProviderGetter - Function to get auth provider (default: getAuthProvider)
   * @param timeoutMs - Sync timeout in milliseconds (default: 120000)
   */
  constructor(
    private readonly repository: ArticleRepository = articleRepository,
    private readonly syncEngineFactory: (config: GoogleSheetsConfig) => GoogleSheetsSyncEngine = initializeGoogleSheetsSync,
    private readonly authProviderGetter: () => PwaAuthProvider = getAuthProvider,
    private readonly timeoutMs: number = SYNC_TIMEOUT_MS
  ) {
    this.updatePendingCount();
  }

  public configure(config: GoogleSheetsConfig): void {
    this.config = config;
    // Eagerly initialize sync engine and auth provider
    this.syncEngineFactory(config);
  }

  /**
   * Checks authentication status on app load
   * Sets state to 'not-authenticated' if no valid token, 'idle' if authenticated
   */
  public async checkAuthStatus(): Promise<void> {
    if (!this.config) {
      console.warn('Cannot check auth status: sync service not configured');
      return;
    }

    try {
      this.setState({ status: 'checking-auth' });

      // Initialize sync engine to create auth provider
      this.syncEngineFactory(this.config);
      const authProvider = this.authProviderGetter();

      // Check if authenticated (only checks localStorage, no server call)
      const isAuthenticated = await authProvider.isAuthenticated();

      if (isAuthenticated) {
        console.log('Auth check: User is authenticated');
        this.setState({ status: 'idle' });
      } else {
        console.log('Auth check: User is not authenticated');
        this.setState({ status: 'not-authenticated' });
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      // On error, assume not authenticated
      this.setState({ status: 'not-authenticated' });
    }
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
      const pendingCount = await this.repository.getPendingArticlesCount();
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

    // Check for concurrent sync operations BEFORE setting state
    if (this.syncState.status === 'syncing') {
      console.warn('Sync already in progress, ignoring request');
      return { success: false, error: 'Sync already in progress' };
    }

    // Pre-sync validation BEFORE setting syncing state
    try {
      await this.validateSyncPreconditions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Pre-sync validation failed';
      console.error('Pre-sync validation failed:', error);
      this.setState({ status: 'error', error: errorMessage });
      return { success: false, error: errorMessage };
    }

    // Record sync start time for atomic operation tracking
    const syncStartTime = Date.now();

    // NOW set syncing state after validation passes
    this.setState({ status: 'syncing', error: undefined });

    // Set up sync timeout to prevent indefinite hanging
    const syncTimeoutId = setTimeout(() => {
      if (this.syncState.status === 'syncing') {
        console.error('Sync operation timed out after', this.timeoutMs, 'ms');
        this.setState({
          status: 'error',
          error: `Sync timed out after ${this.timeoutMs / 1000} seconds`
        });
      }
    }, this.timeoutMs);

    // Track initial state for potential rollback
    let syncCheckpoint: SyncCheckpoint | null = null;

    try {
      // Initialize sync engine first to ensure everything is set up
      this.syncEngineFactory(this.config!);

      // Create a checkpoint before making any changes
      syncCheckpoint = await this.createSyncCheckpoint();

      // Step 1: Process outgoing changes (sync queue) - more atomic
      const outgoingResults = await this.processSyncQueueSafely();

      // Step 2: Fetch and merge remote changes - with validation
      await this.syncFromRemote();

      // Step 3: Verify sync integrity
      await this.verifySyncIntegrity(syncCheckpoint);

      // Step 4: Update state only after all operations succeed
      await this.updatePendingCount();
      this.setState({
        status: 'idle',
        lastSyncTime: Date.now(),
        error: undefined
      });

      console.log(`Sync completed successfully in ${Date.now() - syncStartTime}ms`, {
        outgoingOperations: outgoingResults.processed,
        failures: outgoingResults.failures
      });

      // Clear the timeout since sync completed successfully
      clearTimeout(syncTimeoutId);
      return { success: true };
    } catch (error) {
      console.error('Sync failed:', error);

      // Attempt recovery if we have a checkpoint
      if (syncCheckpoint) {
        try {
          await this.recoverFromSyncFailure(syncCheckpoint);
          console.log('Successfully recovered from sync failure');
        } catch (recoveryError) {
          console.error('Failed to recover from sync failure:', recoveryError);
        }
      }

      // CRITICAL: Always reset sync state on error to prevent getting stuck
      if (error instanceof AuthenticationRequiredError) {
        this.setState({ status: 'auth-required', error: 'Authentication required' });
        return { success: false, error: 'Authentication required' };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      this.setState({ status: 'error', error: errorMessage });

      // Clear the timeout on error
      clearTimeout(syncTimeoutId);
      return { success: false, error: errorMessage };
    } finally {
      // Always clear timeout in finally block as additional safety
      clearTimeout(syncTimeoutId);
    }
  }


  private async processSyncOperation(
    operation: SyncOperation,
    syncEngine: GoogleSheetsSyncEngine
  ): Promise<void> {
    switch (operation.type) {
      case 'create':
        if (operation.data.url) {
          const article = operation.data as Article;
          const articleData = this.articleToSheetData(article);
          await syncEngine.saveArticle(articleData);
          await this.repository.markAsSynced(operation.articleUrl);
        }
        break;
      case 'update':
        if (operation.data.url) {
          const article = operation.data as Article;
          const articleData = this.articleToSheetData(article);
          await syncEngine.updateArticle(operation.articleUrl, articleData);
          await this.repository.markAsSynced(operation.articleUrl);
        }
        break;
      case 'delete':
        await syncEngine.deleteArticle(operation.articleUrl);
        break;
    }
  }

  private async syncFromRemote(): Promise<void> {
    const syncEngine = this.syncEngineFactory(this.config!);

    try {
      const remoteArticles = await syncEngine.getArticles();

      // SAFETY CHECK: Validate remote data before proceeding
      if (!this.validateRemoteData(remoteArticles)) {
        throw new Error('Remote data validation failed - aborting sync to prevent data loss');
      }

      // Future: Could use pending operations for more sophisticated conflict resolution
      // const pendingOperations = await this.repository.getPendingSyncOperations();

      const articlesToUpdate: Article[] = [];
      const processedUrls = new Set<string>();

      // Process remote articles safely
      for (const remoteArticleData of remoteArticles) {
        if (!remoteArticleData.url) {
          console.warn('Skipping remote article with missing URL:', remoteArticleData);
          continue;
        }

        const localArticle = await this.repository.getByUrl(remoteArticleData.url);
        const remoteArticle = this.sheetDataToArticle(remoteArticleData);

        if (!localArticle) {
          // New remote article - add it locally
          articlesToUpdate.push({ ...remoteArticle, syncStatus: 'synced' as const });
        } else {
          // Resolve conflict with enhanced safety checks
          const winner = this.resolveConflictSafely(localArticle, remoteArticle);
          articlesToUpdate.push({ ...winner, syncStatus: 'synced' as const });
        }

        processedUrls.add(remoteArticleData.url);
      }

      // Apply all updates atomically
      if (articlesToUpdate.length > 0) {
        console.log(`Applying ${articlesToUpdate.length} article updates from remote`);
        await this.repository.bulkUpdate(articlesToUpdate);
      }

      console.log(`Successfully synced ${processedUrls.size} articles from remote`);

      // Run cleanup of old deleted articles after successful remote sync
      try {
        const localCleanedUp = await this.repository.cleanupDeletedArticles(30);
        if (localCleanedUp > 0) {
          console.log(`Cleaned up ${localCleanedUp} old deleted articles from local storage`);
        }

        // Also cleanup Google Sheets
        const syncEngine = this.syncEngineFactory(this.config!);
        if (typeof syncEngine.cleanupDeletedArticles === 'function') {
          const remoteCleanedUp = await syncEngine.cleanupDeletedArticles(30);
          if (remoteCleanedUp > 0) {
            console.log(`Cleaned up ${remoteCleanedUp} old deleted articles from Google Sheets`);
          }
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup old deleted articles:', cleanupError);
        // Don't fail the sync if cleanup fails
      }

    } catch (error) {
      console.error('Failed to sync from remote:', error);
      // Re-throw to trigger retry logic in the caller
      throw error;
    }
  }

  private validateRemoteData(remoteArticles: unknown[]): boolean {
    // Basic validation to prevent data corruption
    if (!Array.isArray(remoteArticles)) {
      console.error('Remote data is not an array');
      return false;
    }

    // Check for suspicious scenarios that might indicate data corruption
    if (remoteArticles.length === 0) {
      console.warn('Remote articles list is empty - this might indicate an issue with remote fetch');
      // Don't fail validation for empty lists - this might be legitimate for new users
      // But log it for debugging purposes
    }

    // Validate that each article has required fields
    let validArticleCount = 0;
    for (const article of remoteArticles) {
      if (article && typeof article === 'object' && 'url' in article && 'title' in article && article.url && article.title) {
        validArticleCount++;
      } else {
        console.warn('Invalid remote article detected:', article);
      }
    }

    // If more than 50% of articles are invalid, something is seriously wrong
    if (remoteArticles.length > 0 && validArticleCount < remoteArticles.length * 0.5) {
      console.error(`Too many invalid articles in remote data: ${validArticleCount}/${remoteArticles.length} valid`);
      return false;
    }

    console.log(`Remote data validation passed: ${validArticleCount} valid articles`);
    return true;
  }

  private resolveConflictSafely(local: Article, remote: Article): Article {
    // Enhanced conflict resolution with safety checks

    // Validate that both articles have the same URL
    if (local.url !== remote.url) {
      console.error(`URL mismatch in conflict resolution: local="${local.url}" remote="${remote.url}"`);
      return local; // Prefer local when there's a data integrity issue
    }

    // Check for data corruption indicators
    if (!remote.title || !remote.domain) {
      console.warn(`Remote article appears corrupted for ${remote.url}, preferring local version`);
      return local;
    }

    // For conflict resolution, consider deletedAt as the most recent change timestamp
    const localTime = local.deletedAt || local.editedAt || local.timestamp;
    const remoteTime = remote.deletedAt || remote.editedAt || remote.timestamp;

    // Check for suspicious timestamp differences (more than 1 year apart)
    const timeDiffMs = Math.abs(localTime - remoteTime);
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    if (timeDiffMs > oneYearMs) {
      console.warn(`Suspicious timestamp difference for ${local.url}: ${timeDiffMs}ms apart`);
      // Still proceed with LWW but log the issue
    }

    // Enhanced Last Write Wins with bias toward recent local changes
    if (local.syncStatus === 'pending') {
      // If local article has pending changes, prefer local unless remote is significantly newer
      const fiveMinutesMs = 5 * 60 * 1000;
      if (remoteTime > localTime + fiveMinutesMs) {
        console.log(`Remote article is significantly newer for ${local.url}, using remote version`);
        return remote;
      } else {
        console.log(`Local article has pending changes for ${local.url}, preferring local version`);
        return local;
      }
    }

    // Standard LWW for synced articles, but ties go to local (changed from remote)
    // This prevents unnecessary overwrites when timestamps are equal
    return remoteTime > localTime ? remote : local;
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
      editedAt: article.editedAt ? new Date(article.editedAt).toISOString() : undefined,
      deletedAt: article.deletedAt ? new Date(article.deletedAt).toISOString() : undefined
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
      deletedAt: data.deletedAt ? new Date(data.deletedAt).getTime() : undefined,
      syncStatus: 'synced'
    };
  }

  public async authenticate(): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'Sync service not configured' };
    }

    try {
      // Initialize sync engine first to ensure auth provider is available
      this.syncEngineFactory(this.config!);
      const authProvider = this.authProviderGetter();

      // Handle any existing auth redirect first
      const handled = await authProvider.handleRedirect();
      if (handled) {
        console.log('Auth redirect handled successfully');
        this.setState({ status: 'idle', error: undefined });
        return { success: true };
      }

      // Check if we have a stored token
      if (await authProvider.isAuthenticated()) {
        console.log('Already authenticated');
        this.setState({ status: 'idle', error: undefined });
        return { success: true };
      }

      // No stored token and no redirect, need to authenticate
      console.log('Starting authentication flow');
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
    await this.repository.clearSyncQueue();
    await this.updatePendingCount();
  }

  // Emergency method to reset stuck sync state
  public resetSyncState(): void {
    console.log('Manually resetting sync state');
    this.setState({
      status: 'idle',
      error: undefined
    });
  }

  // Enhanced sync safety methods

  private async validateSyncPreconditions(): Promise<void> {
    // Check if database is accessible
    try {
      await this.repository.getCount();
    } catch {
      throw new Error('Local database is not accessible');
    }

    // REMOVED: Concurrent sync check moved to syncNow() before state change
    // REMOVED: Auth validation is now handled separately in the sync flow
    // The pre-sync validation was causing issues because:
    // 1. Auth provider might not be initialized yet
    // 2. We want to handle auth errors gracefully within the sync flow
    // 3. Auth check is redundant here since it's done in processSyncQueue
  }

  private async createSyncCheckpoint(): Promise<SyncCheckpoint> {
    const [articleCount, syncQueueCount] = await Promise.all([
      this.repository.getCount(),
      this.repository.getPendingSyncOperations().then(ops => ops.length)
    ]);

    return {
      timestamp: Date.now(),
      articleCount,
      syncQueueCount,
      lastSyncTime: this.syncState.lastSyncTime
    };
  }

  private async processSyncQueueSafely(): Promise<SyncQueueResult> {
    const operations = await this.repository.getPendingSyncOperations();
    const syncEngine = this.syncEngineFactory(this.config!);

    const result: SyncQueueResult = {
      processed: 0,
      failures: 0,
      errors: []
    };

    // Process operations in smaller batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      for (const operation of batch) {
        try {
          await this.processSyncOperation(operation, syncEngine);
          await this.repository.removeSyncOperation(operation.id);
          result.processed++;
        } catch (error) {
          console.error(`Failed to process sync operation ${operation.id}:`, error);
          result.failures++;
          result.errors.push(`Operation ${operation.type} for ${operation.articleUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // Handle authentication errors differently
          if (error instanceof AuthenticationRequiredError) {
            throw error; // Re-throw auth errors to stop sync
          }

          // Increment retry count for other errors
          await this.repository.incrementSyncRetryCount(operation.id);

          // Remove operation if it has failed too many times (3 total attempts)
          if (operation.retryCount >= 2) {
            console.warn(`Removing sync operation ${operation.id} after ${operation.retryCount + 1} failed attempts`);
            await this.repository.removeSyncOperation(operation.id);
          }
        }
      }

      // Small delay between batches to be respectful to the API
      if (i + batchSize < operations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return result;
  }

  private async verifySyncIntegrity(checkpoint: SyncCheckpoint): Promise<void> {
    // Verify that sync operations completed as expected
    const currentSyncQueueCount = (await this.repository.getPendingSyncOperations()).length;

    // We expect the sync queue to have fewer or equal items than before
    if (currentSyncQueueCount > checkpoint.syncQueueCount) {
      console.warn(`Sync queue grew during sync: ${checkpoint.syncQueueCount} -> ${currentSyncQueueCount}`);
      // This is not necessarily an error - new operations might have been queued during sync
    }

    // Check that we can still access the database
    try {
      await this.repository.getCount();
    } catch {
      throw new Error('Database integrity check failed after sync');
    }

    console.log('Sync integrity verification passed');
  }

  private async recoverFromSyncFailure(checkpoint: SyncCheckpoint): Promise<void> {
    console.log('Attempting to recover from sync failure...');

    // For now, just reset the sync state
    // In a more sophisticated implementation, we could:
    // - Restore from a backup
    // - Rollback specific operations
    // - Validate and repair data consistency

    this.setState({
      status: 'error',
      error: 'Sync failed - manual review may be required',
      lastSyncTime: checkpoint.lastSyncTime
    });

    // Clear any corrupted sync operations that might be stuck
    const stalledOperations = await this.repository.getPendingSyncOperations();
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const operation of stalledOperations) {
      if (now - operation.timestamp > maxAge && operation.retryCount >= 2) {
        console.log(`Removing stalled sync operation: ${operation.id}`);
        await this.repository.removeSyncOperation(operation.id);
      }
    }

    await this.updatePendingCount();
  }
}

export const syncService = new SyncService();