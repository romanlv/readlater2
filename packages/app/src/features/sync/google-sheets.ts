import { GoogleSheetsConfig } from './types';
import {
  GoogleSheetsSyncEngine,
  PwaAuthProvider,
  LocalStorageSpreadsheetStorage,
  AuthenticationRequiredError
} from '@readlater/google-sheets-sync';

let syncEngine: GoogleSheetsSyncEngine | null = null;
let authProvider: PwaAuthProvider | null = null;

export const initializeGoogleSheetsSync = (config: GoogleSheetsConfig): GoogleSheetsSyncEngine => {
  if (!syncEngine) {
    authProvider = new PwaAuthProvider({
      clientId: config.CLIENT_ID,
      apiKey: config.API_KEY,
    });
    const storage = new LocalStorageSpreadsheetStorage();
    syncEngine = new GoogleSheetsSyncEngine(authProvider, storage);
  }
  return syncEngine;
};

export const getAuthProvider = (): PwaAuthProvider => {
  if (!authProvider) {
    throw new Error('Auth provider not initialized. Call initializeGoogleSheetsSync first.');
  }
  return authProvider;
}

// Safe version that doesn't throw if not initialized
export const getAuthProviderSafely = (): PwaAuthProvider | null => {
  return authProvider;
}

export { AuthenticationRequiredError };