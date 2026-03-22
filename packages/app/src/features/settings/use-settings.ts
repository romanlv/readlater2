import { useState, useEffect, useCallback } from 'react';

export interface AppSettings {
  /** Confirm before deleting an article */
  confirmBeforeDelete: boolean;
  /** Automatically sync when online */
  autoSync: boolean;
  /** Open articles in a new tab */
  openInNewTab: boolean;
}

const STORAGE_KEY = 'app-settings';

const defaultSettings: AppSettings = {
  confirmBeforeDelete: true,
  autoSync: true,
  openInNewTab: true,
};

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return defaultSettings;
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSettingsState(loadSettings());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
