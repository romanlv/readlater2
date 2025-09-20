import { AuthProvider } from '@readlater/core';
import { SPREADSHEET_HEADERS } from './schema.js';
import { GoogleDriveFile, GoogleDriveFileList, GoogleSpreadsheet, GoogleValueRange, SpreadsheetConfig } from '../types.js';

const CONFIG_FILE_NAME = 'readlater.config.json';

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

export class LocalStorageSpreadsheetStorage implements SpreadsheetStorage {
  private key = 'readlater_spreadsheet_id';

  async getSpreadsheetId(): Promise<string | null> {
    return localStorage.getItem(this.key);
  }

  async setSpreadsheetId(id: string): Promise<void> {
    localStorage.setItem(this.key, id);
  }
}

export class GoogleSpreadsheetManager {
  constructor(
    private authProvider: AuthProvider,
    private storage: SpreadsheetStorage,
    private spreadsheetName: string = 'ReadLater'
  ) {}

  private async _fetch<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    if (response.ok) {
      // Handle cases where the response might be empty
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    }
    const errorData = (await response.json().catch(() => ({ error: { message: 'Failed to parse API error response.' } }))) as {
      error?: { message?: string };
    };
    const message = errorData.error?.message || `API request failed with status ${response.status}`;
    throw new Error(message);
  }

  private async getFileIdFromAppData(token: string): Promise<string | null> {
    const result = await this._fetch<GoogleDriveFileList>(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    const configFile = result.files?.find((f: GoogleDriveFile) => f.name === CONFIG_FILE_NAME);
    return configFile ? configFile.id : null;
  }

  private async readSpreadsheetIdFromAppData(token: string, fileId: string): Promise<string | null> {
    const result = await this._fetch<SpreadsheetConfig>(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return result.spreadsheetId || null;
  }

  private async writeSpreadsheetIdToAppData(token: string, spreadsheetId: string): Promise<void> {
    const fileId = await this.getFileIdFromAppData(token);
    const metadata = { name: CONFIG_FILE_NAME, mimeType: 'application/json' };
    const content = JSON.stringify({ spreadsheetId });
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/json' }));

    const uploadUrl = fileId 
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&spaces=appDataFolder';
    
    await this._fetch(uploadUrl, {
      method: fileId ? 'PATCH' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form
    });
  }

  async getOrCreateSpreadsheet(): Promise<string> {
    const token = await this.authProvider.getAuthToken();

    const configFileId = await this.getFileIdFromAppData(token);
    if (configFileId) {
      const spreadsheetId = await this.readSpreadsheetIdFromAppData(token, configFileId);
      if (spreadsheetId) {
        console.log('Found spreadsheet ID in AppDataFolder:', spreadsheetId);
        await this.storage.setSpreadsheetId(spreadsheetId);
        return spreadsheetId;
      }
    }

    const storedId = await this.storage.getSpreadsheetId();
    if (storedId) {
      console.log('Found spreadsheet ID in local storage, migrating to AppDataFolder...');
      await this.writeSpreadsheetIdToAppData(token, storedId);
      return storedId;
    }

    const existingId = await this.findSpreadsheetByName(token, this.spreadsheetName);
    if (existingId) {
      console.log('Found existing spreadsheet by name, migrating to AppDataFolder...');
      await this.storage.setSpreadsheetId(existingId);
      await this.writeSpreadsheetIdToAppData(token, existingId);
      return existingId;
    }

    console.log(`No spreadsheet found, creating new one...`);
    const spreadsheetId = await this.createSpreadsheet(token);
    await this.addHeaders(token, spreadsheetId);
    await this.storage.setSpreadsheetId(spreadsheetId);
    await this.writeSpreadsheetIdToAppData(token, spreadsheetId);
    
    console.log('Created new spreadsheet and saved ID to AppDataFolder:', spreadsheetId);
    return spreadsheetId;
  }

  private async findSpreadsheetByName(token: string, name: string): Promise<string | null> {
    const query = `name='${name}' and mimeType='application/vnd.google-apps.spreadsheet' and 'root' in parents and trashed=false`;
    const result = await this._fetch<GoogleDriveFileList>(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return result.files && result.files.length > 0 ? result.files[0].id : null;
  }

  private async createSpreadsheet(token: string): Promise<string> {
    const spreadsheet = await this._fetch<GoogleSpreadsheet>('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { title: this.spreadsheetName } })
    });
    return spreadsheet.spreadsheetId;
  }

  private async addHeaders(token: string, spreadsheetId: string): Promise<void> {
    const body = { values: [SPREADSHEET_HEADERS] };
    await this._fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:J1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
  }

  async getNextRowNumber(token: string, spreadsheetId: string): Promise<number> {
    const range = await this._fetch<GoogleValueRange>(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A?majorDimension=COLUMNS`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    // Add 1 for the header row, and 1 for the next empty row
    return (range.values?.[0]?.length || 0) + 1;
  }

  async getAllRows(token: string, spreadsheetId: string): Promise<string[][]> {
    const result = await this._fetch<GoogleValueRange>(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:J`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return result.values || [];
  }

  async appendRow(token: string, spreadsheetId: string, values: string[]): Promise<void> {
    const nextRow = await this.getNextRowNumber(token, spreadsheetId);
    
    const body = { values: [values] };
    await this._fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A${nextRow}:J${nextRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
  }
}