import { AuthProvider } from '@readlater/core';
import { SPREADSHEET_HEADERS } from './schema.js';

export interface SpreadsheetStorage {
  getSpreadsheetId(): Promise<string | null>;
  setSpreadsheetId(id: string): Promise<void>;
}

export class ChromeSpreadsheetStorage implements SpreadsheetStorage {
  async getSpreadsheetId(): Promise<string | null> {
    const stored = await chrome.storage.local.get(['readlater_spreadsheet_id']);
    return stored.readlater_spreadsheet_id || null;
  }

  async setSpreadsheetId(id: string): Promise<void> {
    await chrome.storage.local.set({ readlater_spreadsheet_id: id });
  }
}

export class GoogleSpreadsheetManager {
  constructor(
    private authProvider: AuthProvider,
    private storage: SpreadsheetStorage,
    private spreadsheetName: string = 'ReadLater'
  ) {}

  async getOrCreateSpreadsheet(): Promise<string> {
    const token = await this.authProvider.getAuthToken();
    
    try {
      const existingId = await this.findSpreadsheetByName(token, this.spreadsheetName);
      if (existingId) {
        console.log('Found existing spreadsheet:', existingId);
        await this.storage.setSpreadsheetId(existingId);
        return existingId;
      }
    } catch (error) {
      console.log('Drive API search failed, falling back to storage check:', (error as Error).message);
      
      const storedId = await this.storage.getSpreadsheetId();
      if (storedId) {
        console.log('Using stored spreadsheet ID:', storedId);
        return storedId;
      }
    }
    
    console.log(`No existing '${this.spreadsheetName}' spreadsheet found, creating new one...`);
    
    const spreadsheetId = await this.createSpreadsheet(token);
    await this.addHeaders(token, spreadsheetId);
    await this.storage.setSpreadsheetId(spreadsheetId);
    
    console.log('Created new spreadsheet:', spreadsheetId);
    console.log('Spreadsheet URL:', `https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    
    return spreadsheetId;
  }

  private async findSpreadsheetByName(token: string, name: string): Promise<string | null> {
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${name}' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    
    if (!searchResponse.ok) {
      throw new Error('Drive API search failed');
    }
    
    const searchResult = await searchResponse.json();
    if (searchResult.files && searchResult.files.length > 0) {
      return searchResult.files[0].id;
    }
    
    return null;
  }

  private async createSpreadsheet(token: string): Promise<string> {
    const response = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: this.spreadsheetName
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create spreadsheet:', errorText);
      throw new Error('Unable to create spreadsheet');
    }
    
    const spreadsheet = await response.json();
    return spreadsheet.spreadsheetId;
  }

  private async addHeaders(token: string, spreadsheetId: string): Promise<void> {
    const requestBody = {
      majorDimension: 'ROWS',
      values: [SPREADSHEET_HEADERS]
    };
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:J1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to add headers:', errorText);
      throw new Error(`Failed to add headers: ${response.statusText}`);
    }
    
    console.log('Headers added successfully');
  }

  async getNextRowNumber(token: string, spreadsheetId: string): Promise<number> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.values && data.values.length > 0) {
        return data.values.length + 1;
      }
    }
    
    return 1;
  }

  async appendRow(token: string, spreadsheetId: string, values: string[]): Promise<void> {
    const nextRow = await this.getNextRowNumber(token, spreadsheetId);
    
    const requestBody = {
      majorDimension: 'ROWS',
      values: [values]
    };
    
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A${nextRow}:J${nextRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`Failed to save to Google Sheets: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API success response:', result);
  }
}