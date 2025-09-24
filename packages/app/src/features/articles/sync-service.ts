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
        console.error('Sync operation timed out after', SYNC_TIMEOUT_MS, 'ms');
        this.setState({
          status: 'error',
          error: `Sync timed out after ${SYNC_TIMEOUT_MS / 1000} seconds`
        });
      }
    }, SYNC_TIMEOUT_MS);

    // Track initial state for potential rollback
    let syncCheckpoint: SyncCheckpoint | null = null;

    try {
      // Initialize sync engine first to ensure everything is set up
      initializeGoogleSheetsSync(this.config);

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

      // SAFETY CHECK: Validate remote data before proceeding
      if (!this.validateRemoteData(remoteArticles)) {
        throw new Error('Remote data validation failed - aborting sync to prevent data loss');
      }

      // Get current local state for atomic operations
      const pendingOperations = await articleRepository.getPendingSyncOperations();
      const pendingDeletes = new Set(
        pendingOperations
          .filter(op => op.type === 'delete')
          .map(op => op.articleUrl)
      );

      const articlesToUpdate: Article[] = [];
      const processedUrls = new Set<string>();

      // Process remote articles safely
      for (const remoteArticleData of remoteArticles) {
        if (!remoteArticleData.url) {
          console.warn('Skipping remote article with missing URL:', remoteArticleData);
          continue;
        }

        // Skip articles that are pending deletion locally
        if (pendingDeletes.has(remoteArticleData.url)) {
          console.log(`Skipping remote article ${remoteArticleData.url} - pending local deletion`);
          continue;
        }

        const localArticle = await articleRepository.getByUrl(remoteArticleData.url);
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
        await articleRepository.bulkUpdate(articlesToUpdate);
      }

      // REMOVED DANGEROUS DELETION LOGIC:
      // The old code would delete any local article not found remotely.
      // This was causing data loss when:
      // - Remote fetch was incomplete
      // - Network issues occurred
      // - Authentication expired mid-sync
      // - User saved articles during sync
      //
      // Instead, we now ONLY explicitly track deletions through sync operations.
      // If an article was deleted remotely, it should come through as a delete operation,
      // not be inferred from absence in the remote list.

      console.log(`Successfully synced ${processedUrls.size} articles from remote`);

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

    const localTime = local.editedAt || local.timestamp;
    const remoteTime = remote.editedAt || remote.timestamp;

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
      // Initialize sync engine first to ensure auth provider is available
      initializeGoogleSheetsSync(this.config);
      const authProvider = getAuthProvider();

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
    await articleRepository.clearSyncQueue();
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
      await articleRepository.getCount();
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
      articleRepository.getCount(),
      articleRepository.getPendingSyncOperations().then(ops => ops.length)
    ]);

    return {
      timestamp: Date.now(),
      articleCount,
      syncQueueCount,
      lastSyncTime: this.syncState.lastSyncTime
    };
  }

  private async processSyncQueueSafely(): Promise<SyncQueueResult> {
    const operations = await articleRepository.getPendingSyncOperations();
    const syncEngine = initializeGoogleSheetsSync(this.config!);

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
          await articleRepository.removeSyncOperation(operation.id);
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
          await articleRepository.incrementSyncRetryCount(operation.id);

          // Remove operation if it has failed too many times (3 total attempts)
          if (operation.retryCount >= 2) {
            console.warn(`Removing sync operation ${operation.id} after ${operation.retryCount + 1} failed attempts`);
            await articleRepository.removeSyncOperation(operation.id);
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
    const currentSyncQueueCount = (await articleRepository.getPendingSyncOperations()).length;

    // We expect the sync queue to have fewer or equal items than before
    if (currentSyncQueueCount > checkpoint.syncQueueCount) {
      console.warn(`Sync queue grew during sync: ${checkpoint.syncQueueCount} -> ${currentSyncQueueCount}`);
      // This is not necessarily an error - new operations might have been queued during sync
    }

    // Check that we can still access the database
    try {
      await articleRepository.getCount();
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
    const stalledOperations = await articleRepository.getPendingSyncOperations();
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const operation of stalledOperations) {
      if (now - operation.timestamp > maxAge && operation.retryCount >= 2) {
        console.log(`Removing stalled sync operation: ${operation.id}`);
        await articleRepository.removeSyncOperation(operation.id);
      }
    }

    await this.updatePendingCount();
  }
}

export const syncService = new SyncService();