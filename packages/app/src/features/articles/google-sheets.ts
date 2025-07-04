import { ArticleData, GoogleSheetsConfig } from './types';
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

export const saveArticlesToSheet = async (articles: ArticleData[], config: GoogleSheetsConfig): Promise<void> => {
  const engine = initializeGoogleSheetsSync(config);
  
  for (const article of articles) {
    const result = await engine.saveArticle(article);
    if (!result.success) {
      throw new Error(result.error || `Failed to save article: ${article.url}`);
    }
  }
};

export const loadArticlesFromSheet = async (config: GoogleSheetsConfig): Promise<ArticleData[]> => {
  const engine = initializeGoogleSheetsSync(config);
  return await engine.getArticles();
};

export { AuthenticationRequiredError };