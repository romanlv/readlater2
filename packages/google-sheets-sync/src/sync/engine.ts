import { ArticleData, SyncEngine, SyncResult, AuthProvider } from '@readlater/core';
import { GoogleSpreadsheetManager, SpreadsheetStorage, articleToSheetRow, sheetRowToArticle } from '../spreadsheet/index.js';

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

  async getArticles(): Promise<ArticleData[]> {
    try {
      console.log('Getting auth token...');
      const token = await this.manager['authProvider'].getAuthToken();
      
      console.log('Got auth token, getting/creating spreadsheet...');
      const spreadsheetId = await this.manager.getOrCreateSpreadsheet();
      
      console.log('Fetching articles from spreadsheet ID:', spreadsheetId);
      
      const rows = await this.manager.getAllRows(token, spreadsheetId);
      const articles = rows
        .filter(row => row.length > 0 && row[0]) // Filter out empty rows
        .map(row => sheetRowToArticle(row));
      
      console.log(`Successfully loaded ${articles.length} articles from Google Sheets`);
      return articles;
    } catch (error) {
      console.error('Error loading articles:', error);
      throw error;
    }
  }

  async saveArticles(articles: ArticleData[]): Promise<SyncResult[]> {
    try {
      console.log(`Batch saving ${articles.length} articles...`);
      const token = await this.manager['authProvider'].getAuthToken();
      const spreadsheetId = await this.manager.getOrCreateSpreadsheet();

      const results: SyncResult[] = [];

      for (const article of articles) {
        try {
          const rowData = articleToSheetRow(article);
          await this.manager.appendRow(token, spreadsheetId, rowData);
          results.push({
            success: true,
            articleUrl: article.url
          });
        } catch (error) {
          console.error(`Error saving article ${article.url}:`, error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            articleUrl: article.url
          });
        }
      }

      console.log(`Batch save completed: ${results.filter(r => r.success).length}/${articles.length} successful`);
      return results;
    } catch (error) {
      console.error('Error in batch save:', error);
      // Return failed results for all articles
      return articles.map(article => ({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        articleUrl: article.url
      }));
    }
  }

  async deleteArticle(_url: string): Promise<SyncResult> {
    throw new Error('deleteArticle not implemented yet');
  }

  async updateArticle(_url: string, _updates: Partial<ArticleData>): Promise<SyncResult> {
    throw new Error('updateArticle not implemented yet');
  }
}