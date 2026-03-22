/**
 * Application-level settings that are stored locally per device.
 */
export interface AppSettings {
  /** Automatically sync when online */
  autoSync: boolean;
  /** Open articles in embedded preview instead of new tab */
  openInPreview: boolean;
}

/**
 * Sync configuration for Google Sheets integration.
 */
export interface SyncConfig {
  /** Google OAuth 2.0 Client ID */
  clientId: string;
  /** Google API Key */
  apiKey: string;
}

/**
 * Sync-related timing configuration.
 */
export interface SyncTimingConfig {
  /** Debounce delay in ms before auto-sync triggers */
  debounceMs: number;
  /** Periodic fallback sync interval in ms */
  periodicIntervalMs: number;
  /** Maximum retry attempts for failed syncs */
  maxRetries: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoSync: true,
  openInPreview: false,
};

export const DEFAULT_SYNC_TIMING: SyncTimingConfig = {
  debounceMs: 60_000,
  periodicIntervalMs: 900_000, // 15 minutes
  maxRetries: 3,
};
