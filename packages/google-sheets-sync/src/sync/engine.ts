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

  async deleteArticle(url: string): Promise<SyncResult> {
    try {
      console.log(`Deleting article: ${url}`);
      const token = await this.manager['authProvider'].getAuthToken();
      const spreadsheetId = await this.manager.getOrCreateSpreadsheet();

      const rowNumber = await this.manager.findRowByUrl(token, spreadsheetId, url);
      if (rowNumber === null) {
        console.log(`Article not found in spreadsheet: ${url}`);
        return {
          success: true, // Consider it success if already not present
          articleUrl: url
        };
      }

      await this.manager.deleteRow(token, spreadsheetId, rowNumber);
      console.log(`Successfully deleted article from Google Sheets: ${url}`);

      return {
        success: true,
        articleUrl: url
      };
    } catch (error) {
      console.error(`Error deleting article ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        articleUrl: url
      };
    }
  }

  async updateArticle(url: string, updates: Partial<ArticleData>): Promise<SyncResult> {
    try {
      console.log(`Updating article: ${url}`);
      const token = await this.manager['authProvider'].getAuthToken();
      const spreadsheetId = await this.manager.getOrCreateSpreadsheet();

      const rowNumber = await this.manager.findRowByUrl(token, spreadsheetId, url);
      if (rowNumber === null) {
        console.log(`Article not found in spreadsheet, cannot update: ${url}`);
        return {
          success: false,
          error: 'Article not found in spreadsheet',
          articleUrl: url
        };
      }

      // Get current article data and merge with updates
      const rows = await this.manager.getAllRows(token, spreadsheetId);
      const currentRow = rows[rowNumber - 2]; // Convert back to 0-indexed array
      const currentArticle = sheetRowToArticle(currentRow);

      const updatedArticle: ArticleData = {
        ...currentArticle,
        ...updates,
        url // Ensure URL doesn't get overwritten
      };

      const rowData = articleToSheetRow(updatedArticle);
      await this.manager.updateRow(token, spreadsheetId, rowNumber, rowData);

      console.log(`Successfully updated article in Google Sheets: ${url}`);
      return {
        success: true,
        articleUrl: url
      };
    } catch (error) {
      console.error(`Error updating article ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        articleUrl: url
      };
    }
  }
}