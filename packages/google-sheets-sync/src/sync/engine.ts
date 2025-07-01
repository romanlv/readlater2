import { ArticleData, SyncEngine, SyncResult, AuthProvider } from '@readlater/core';
import { GoogleSpreadsheetManager, SpreadsheetStorage, articleToSheetRow } from '../spreadsheet/index.js';

export class GoogleSheetsSyncEngine implements SyncEngine {
  private manager: GoogleSpreadsheetManager;

  constructor(
    authProvider: AuthProvider,
    storage: SpreadsheetStorage,
    spreadsheetName?: string
  ) {
    this.manager = new GoogleSpreadsheetManager(authProvider, storage, spreadsheetName);
  }

  async saveArticle(article: ArticleData): Promise<SyncResult> {
    try {
      console.log('Getting auth token...');
      const token = await this.manager['authProvider'].getAuthToken();
      
      console.log('Got auth token, getting/creating spreadsheet...');
      const spreadsheetId = await this.manager.getOrCreateSpreadsheet();
      
      console.log('Using spreadsheet ID:', spreadsheetId);
      
      const rowData = articleToSheetRow(article);
      await this.manager.appendRow(token, spreadsheetId, rowData);
      
      console.log('Successfully saved to Google Sheets');
      return { 
        success: true, 
        articleUrl: article.url 
      };
    } catch (error) {
      console.error('Error saving article:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        articleUrl: article.url 
      };
    }
  }

  // Future implementations for read operations
  async getArticles(): Promise<ArticleData[]> {
    throw new Error('getArticles not implemented yet');
  }

  async deleteArticle(_url: string): Promise<SyncResult> {
    throw new Error('deleteArticle not implemented yet');
  }

  async updateArticle(_url: string, _updates: Partial<ArticleData>): Promise<SyncResult> {
    throw new Error('updateArticle not implemented yet');
  }
}