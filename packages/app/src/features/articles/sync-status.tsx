import { Button } from '@/components/ui/button';
import { useSync } from './use-sync';
import { GoogleSheetsConfig } from './types';
import { RefreshCw, WifiOff, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface SyncStatusProps {
  config?: GoogleSheetsConfig;
  isOnline: boolean;
}

export function SyncStatus({ config, isOnline }: SyncStatusProps) {
  const { syncState, syncNow, authenticate, isSyncing, canSync, needsAuth, lastSyncError } = useSync(config);

  const getSyncIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    if (isSyncing) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (needsAuth) return <AlertCircle className="w-4 h-4" />;
    if (lastSyncError) return <AlertCircle className="w-4 h-4" />;
    if (syncState.pendingCount > 0) return <Clock className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getSyncText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (needsAuth) return 'Sign in needed';
    if (lastSyncError) return 'Sync error';
    if (syncState.pendingCount > 0) return `${syncState.pendingCount} pending`;
    return 'Synced';
  };

  const getSyncColor = () => {
    if (!isOnline) return 'text-gray-500 bg-gray-100';
    if (isSyncing) return 'text-blue-600 bg-blue-100';
    if (needsAuth) return 'text-yellow-600 bg-yellow-100';
    if (lastSyncError) return 'text-red-600 bg-red-100';
    if (syncState.pendingCount > 0) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  const formatLastSyncTime = () => {
    if (!syncState.lastSyncTime) return null;
    const date = new Date(syncState.lastSyncTime);
    const now = Date.now();
    const diff = now - syncState.lastSyncTime;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${getSyncColor()}`}>
        {getSyncIcon()}
        <span>{getSyncText()}</span>
      </div>

      {isOnline && config && (
        <>
          {needsAuth ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={authenticate}
              className="text-xs px-2 py-1 h-auto"
              title="Sign in to Google Sheets to sync"
            >
              Sign In
            </Button>
          ) : canSync && (
            <Button
              size="sm"
              variant="ghost"
              onClick={syncNow}
              disabled={isSyncing}
              className="text-xs px-2 py-1 h-auto"
              title={lastSyncError ? `Retry sync (${lastSyncError})` : 'Sync now'}
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          )}
        </>
      )}

      {lastSyncError && (
        <div className="text-xs text-red-600" title={lastSyncError}>
          Error
        </div>
      )}

      {syncState.lastSyncTime && !lastSyncError && (
        <div className="text-xs text-gray-500">
          {formatLastSyncTime()}
        </div>
      )}
    </div>
  );
}