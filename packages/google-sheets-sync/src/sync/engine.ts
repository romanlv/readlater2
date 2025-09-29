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
      console.log('Saving article to Google Sheets...');

      const rowData = articleToSheetRow(article);
      await this.manager.appendRow(rowData);

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
      console.log('Fetching articles from Google Sheets...');

      const rows = await this.manager.getAllRows();

      // Enhanced validation and filtering
      const validArticles: ArticleData[] = [];
      const invalidRows: string[][] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Skip completely empty rows
        if (!row || row.length === 0 || !row.some(cell => cell?.trim())) {
          continue;
        }

        // Validate that row has minimum required data
        if (!row[0]?.trim()) { // URL is required
          console.warn(`Row ${i + 2} missing URL, skipping:`, row);
          invalidRows.push(row);
          continue;
        }

        if (!row[1]?.trim()) { // Title is required
          console.warn(`Row ${i + 2} missing title, skipping:`, row);
          invalidRows.push(row);
          continue;
        }

        try {
          const article = sheetRowToArticle(row);

          // Additional validation on the parsed article
          if (!this.validateArticleData(article)) {
            console.warn(`Row ${i + 2} failed validation after parsing:`, article);
            invalidRows.push(row);
            continue;
          }

          validArticles.push(article);
        } catch (parseError) {
          console.warn(`Failed to parse row ${i + 2}:`, parseError, row);
          invalidRows.push(row);
        }
      }

      // Log summary of what we found
      console.log(`Successfully loaded ${validArticles.length} valid articles from Google Sheets`);
      if (invalidRows.length > 0) {
        console.warn(`Skipped ${invalidRows.length} invalid rows`);

        // If more than 25% of rows are invalid, something might be seriously wrong
        const totalRows = rows.length;
        const invalidRatio = invalidRows.length / totalRows;
        if (totalRows > 0 && invalidRatio > 0.25) {
          console.error(`High invalid row ratio detected: ${invalidRows.length}/${totalRows} (${Math.round(invalidRatio * 100)}%)`);
          console.error('This might indicate spreadsheet corruption or format changes');
          // Still return valid articles, but log the issue for investigation
        }
      }

      return validArticles;
    } catch (error) {
      console.error('Error loading articles:', error);

      // Provide more specific error context
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          throw new Error('Spreadsheet not found - it may have been deleted');
        } else if (error.message.includes('403')) {
          throw new Error('Access denied to spreadsheet - check permissions');
        } else if (error.message.includes('401')) {
          throw new Error('Authentication failed - token may be expired');
        }
      }

      throw error;
    }
  }

  private validateArticleData(article: ArticleData): boolean {
    // Check required fields
    if (!article.url || typeof article.url !== 'string') {
      return false;
    }

    if (!article.title || typeof article.title !== 'string') {
      return false;
    }

    // Validate URL format (basic check)
    try {
      new URL(article.url);
    } catch {
      console.warn(`Invalid URL format: ${article.url}`);
      return false;
    }

    // Validate timestamp if present
    if (article.timestamp) {
      if (typeof article.timestamp !== 'string') {
        return false;
      }

      // Try to parse timestamp
      const timestamp = new Date(article.timestamp);
      if (isNaN(timestamp.getTime())) {
        console.warn(`Invalid timestamp: ${article.timestamp}`);
        return false;
      }

      // Check for reasonable timestamp (not too far in past or future)
      const now = new Date();
      const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
      const oneYearFromNow = new Date(now.getFullYear() + 1, 11, 31);

      if (timestamp < tenYearsAgo || timestamp > oneYearFromNow) {
        console.warn(`Suspicious timestamp: ${article.timestamp}`);
        // Don't fail validation for this - just log it
      }
    }

    return true;
  }

  async saveArticles(articles: ArticleData[]): Promise<SyncResult[]> {
    if (articles.length === 0) return [];

    try {
      console.log(`Batch saving ${articles.length} articles...`);

      // Convert all articles to row data
      const valuesList = articles.map(article => articleToSheetRow(article));

      // Use batch operation for better performance
      await this.manager.batchAppendRows(valuesList);

      const results = articles.map(article => ({
        success: true,
        articleUrl: article.url
      }));

      console.log(`Batch save completed: ${results.length}/${articles.length} successful`);
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

      const rowNumber = await this.manager.findRowByUrl(url);
      if (rowNumber === null) {
        console.log(`Article not found in spreadsheet: ${url}`);
        return {
          success: true, // Consider it success if already not present
          articleUrl: url
        };
      }

      await this.manager.deleteRow(rowNumber);
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

      const rowNumber = await this.manager.findRowByUrl(url);
      if (rowNumber === null) {
        console.log(`Article not found in spreadsheet, cannot update: ${url}`);
        return {
          success: false,
          error: 'Article not found in spreadsheet',
          articleUrl: url
        };
      }

      // Get current article data and merge with updates
      const rows = await this.manager.getAllRows();
      const currentRow = rows[rowNumber - 2]; // Convert back to 0-indexed array
      const currentArticle = sheetRowToArticle(currentRow);

      const updatedArticle: ArticleData = {
        ...currentArticle,
        ...updates,
        url // Ensure URL doesn't get overwritten
      };

      const rowData = articleToSheetRow(updatedArticle);
      await this.manager.updateRow(rowNumber, rowData);

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

  async cleanupDeletedArticles(olderThanDays: number = 30): Promise<number> {
    try {
      console.log(`Starting cleanup of deleted articles older than ${olderThanDays} days...`);

      const rows = await this.manager.getAllRows();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const rowsToDelete: number[] = [];

      // Find rows with deletedAt older than cutoff
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const deletedAt = row[11]; // deletedAt is in column 11 (L)

        if (deletedAt && deletedAt.trim()) {
          try {
            const deletedDate = new Date(deletedAt);
            if (!isNaN(deletedDate.getTime()) && deletedDate < cutoffDate) {
              // Convert array index to sheet row number (add 2 for header and 1-indexed)
              rowsToDelete.push(i + 2);
            }
          } catch {
            console.warn(`Invalid deletedAt date format in row ${i + 2}: ${deletedAt}`);
          }
        }
      }

      if (rowsToDelete.length === 0) {
        console.log('No old deleted articles found for cleanup');
        return 0;
      }

      console.log(`Found ${rowsToDelete.length} old deleted articles to remove from spreadsheet`);

      // Use batch delete for better performance
      await this.manager.batchDeleteRows(rowsToDelete);

      console.log(`Successfully cleaned up ${rowsToDelete.length} old deleted articles from Google Sheets`);
      return rowsToDelete.length;

    } catch (error) {
      console.error('Error during Google Sheets cleanup:', error);
      throw error;
    }
  }

  async batchUpdateArticles(updates: Array<{ url: string; updates: Partial<ArticleData> }>): Promise<SyncResult[]> {
    if (updates.length === 0) return [];

    try {
      console.log(`Batch updating ${updates.length} articles...`);

      // Get all rows once to find row numbers for each URL
      const rows = await this.manager.getAllRows();
      const urlToRowMap = new Map<string, number>();

      for (let i = 0; i < rows.length; i++) {
        const url = rows[i][0];
        if (url) {
          urlToRowMap.set(url, i + 2); // Convert to 1-indexed row number
        }
      }

      const rowUpdates: Array<{ rowNumber: number; values: string[] }> = [];
      const results: SyncResult[] = [];

      for (const { url, updates: articleUpdates } of updates) {
        const rowNumber = urlToRowMap.get(url);
        if (!rowNumber) {
          results.push({
            success: false,
            error: 'Article not found in spreadsheet',
            articleUrl: url
          });
          continue;
        }

        // Get current article data and merge with updates
        const currentRow = rows[rowNumber - 2]; // Convert back to 0-indexed array
        const currentArticle = sheetRowToArticle(currentRow);

        const updatedArticle: ArticleData = {
          ...currentArticle,
          ...articleUpdates,
          url // Ensure URL doesn't get overwritten
        };

        const rowData = articleToSheetRow(updatedArticle);
        rowUpdates.push({ rowNumber, values: rowData });
        results.push({
          success: true,
          articleUrl: url
        });
      }

      // Perform batch update if we have any valid updates
      if (rowUpdates.length > 0) {
        await this.manager.batchUpdateRows(rowUpdates);
      }

      console.log(`Batch update completed: ${rowUpdates.length}/${updates.length} successful`);
      return results;
    } catch (error) {
      console.error('Error in batch update:', error);
      // Return failed results for all articles
      return updates.map(({ url }) => ({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        articleUrl: url
      }));
    }
  }

  async batchDeleteArticles(urls: string[]): Promise<SyncResult[]> {
    if (urls.length === 0) return [];

    try {
      console.log(`Batch deleting ${urls.length} articles...`);

      // Get all rows once to find row numbers for each URL
      const rows = await this.manager.getAllRows();
      const urlToRowMap = new Map<string, number>();

      for (let i = 0; i < rows.length; i++) {
        const url = rows[i][0];
        if (url) {
          urlToRowMap.set(url, i + 2); // Convert to 1-indexed row number
        }
      }

      const rowsToDelete: number[] = [];
      const results: SyncResult[] = [];

      for (const url of urls) {
        const rowNumber = urlToRowMap.get(url);
        if (!rowNumber) {
          // Consider it success if already not present
          results.push({
            success: true,
            articleUrl: url
          });
          continue;
        }

        rowsToDelete.push(rowNumber);
        results.push({
          success: true,
          articleUrl: url
        });
      }

      // Perform batch delete if we have any rows to delete
      if (rowsToDelete.length > 0) {
        await this.manager.batchDeleteRows(rowsToDelete);
      }

      console.log(`Batch delete completed: ${rowsToDelete.length}/${urls.length} rows deleted`);
      return results;
    } catch (error) {
      console.error('Error in batch delete:', error);
      // Return failed results for all articles
      return urls.map(url => ({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        articleUrl: url
      }));
    }
  }
}