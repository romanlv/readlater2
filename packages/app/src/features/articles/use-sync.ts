import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncService, SyncState, SyncStatus } from './sync-service.js';
import { GoogleSheetsConfig } from './types.js';

export function useSync(config?: GoogleSheetsConfig) {
  const [syncState, setSyncState] = useState<SyncState>(syncService.getState());
  const queryClient = useQueryClient();

  // Configure sync service when config is provided
  useEffect(() => {
    if (config) {
      syncService.configure(config);
    }
  }, [config]);

  // Subscribe to sync state changes
  useEffect(() => {
    const unsubscribe = syncService.subscribe(setSyncState);
    return unsubscribe;
  }, []);

  const syncMutation = useMutation({
    mutationFn: () => syncService.syncNow(),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate all article queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['articles'] });
      }
    }
  });

  const authMutation = useMutation({
    mutationFn: () => syncService.authenticate(),
  });

  const syncNow = useCallback(() => {
    if (!config) {
      console.warn('Cannot sync: config not provided');
      return;
    }
    syncMutation.mutate();
  }, [config, syncMutation]);

  const authenticate = useCallback(() => {
    if (!config) {
      console.warn('Cannot authenticate: config not provided');
      return;
    }
    authMutation.mutate();
  }, [config, authMutation]);

  return {
    syncState,
    syncNow,
    authenticate,
    isSyncing: syncState.status === 'syncing' || syncMutation.isPending,
    canSync: !!config && syncState.status !== 'syncing' && syncState.status !== 'checking-auth',
    needsAuth: syncState.status === 'auth-required',
    isCheckingAuth: syncState.status === 'checking-auth',
    isNotAuthenticated: syncState.status === 'not-authenticated',
    lastSyncError: syncState.error || (syncMutation.error?.message)
  };
}

export type { SyncState, SyncStatus };