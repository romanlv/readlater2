import { AuthProvider } from '@readlater/core';
import { SPREADSHEET_HEADERS } from './schema.js';
import { GoogleDriveFile, GoogleDriveFileList, GoogleSpreadsheet, GoogleValueRange, SpreadsheetConfig } from '../types.js';

const CONFIG_FILE_NAME = 'readlater.config.json';

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

interface ManagerCache {
  spreadsheetId?: string;
  configFileId?: string | null; // Allow null to distinguish between "uncached" and "cached as null"
  configFileIdCached?: boolean; // Track if we've already fetched it
  authToken?: CacheEntry<string>;
  initializationPromise?: Promise<string>;
  rowsData?: CacheEntry<string[][]>;
}

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
  private cache: ManagerCache = {};
  private readonly TOKEN_CACHE_DURATION = 45 * 60 * 1000; // 45 minutes
  private readonly ROWS_CACHE_DURATION = 30 * 1000; // 30 seconds - short cache for row data

  constructor(
    private authProvider: AuthProvider,
    private storage: SpreadsheetStorage,
    private spreadsheetName: string = 'ReadLater'
  ) {}

  private async getCachedAuthToken(): Promise<string> {
    // Check cache first
    if (this.cache.authToken && this.cache.authToken.expiry > Date.now()) {
      return this.cache.authToken.value;
    }

    // Get fresh token and cache it
    const token = await this.authProvider.getAuthToken();
    this.cache.authToken = {
      value: token,
      expiry: Date.now() + this.TOKEN_CACHE_DURATION
    };
    return token;
  }

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
    // Check cache first - only make API call if we haven't cached this yet
    if (this.cache.configFileIdCached) {
      return this.cache.configFileId ?? null;
    }

    const result = await this._fetch<GoogleDriveFileList>(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    const configFile = result.files?.find((f: GoogleDriveFile) => f.name === CONFIG_FILE_NAME);
    const fileId = configFile ? configFile.id : null;

    // Cache the result (even if null) and mark as cached
    this.cache.configFileId = fileId;
    this.cache.configFileIdCached = true;
    return fileId;
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
    // Check memory cache first
    if (this.cache.spreadsheetId) {
      return this.cache.spreadsheetId;
    }

    // Prevent concurrent initialization by returning existing promise if one is running
    if (this.cache.initializationPromise) {
      return this.cache.initializationPromise;
    }

    // Create and cache the initialization promise
    this.cache.initializationPromise = this.initializeSpreadsheet();

    try {
      const spreadsheetId = await this.cache.initializationPromise;
      this.cache.spreadsheetId = spreadsheetId;
      return spreadsheetId;
    } finally {
      // Clear the promise after completion (success or failure)
      this.cache.initializationPromise = undefined;
    }
  }

  private async initializeSpreadsheet(): Promise<string> {
    const token = await this.getCachedAuthToken();

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
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:L1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
  }

  async getNextRowNumber(spreadsheetId?: string): Promise<number> {
    const token = await this.getCachedAuthToken();
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();

    const range = await this._fetch<GoogleValueRange>(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:A?majorDimension=COLUMNS`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    // Add 1 for the header row, and 1 for the next empty row
    return (range.values?.[0]?.length || 0) + 1;
  }

  async getAllRows(spreadsheetId?: string): Promise<string[][]> {
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();

    // Check cache first - use short-lived cache for row data
    if (this.cache.rowsData && this.cache.rowsData.expiry > Date.now()) {
      return this.cache.rowsData.value;
    }

    const token = await this.getCachedAuthToken();

    const result = await this._fetch<GoogleValueRange>(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A2:L`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    const rows = result.values || [];

    // Cache the rows with short expiration
    this.cache.rowsData = {
      value: rows,
      expiry: Date.now() + this.ROWS_CACHE_DURATION
    };

    return rows;
  }

  async appendRow(values: string[], spreadsheetId?: string): Promise<void> {
    const token = await this.getCachedAuthToken();
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();
    const nextRow = await this.getNextRowNumber(sheetId);

    const body = { values: [values] };
    await this._fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A${nextRow}:L${nextRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    // Invalidate rows cache since we modified the sheet
    this.invalidateRowsCache();
  }

  async findRowByUrl(url: string, spreadsheetId?: string): Promise<number | null> {
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();
    const rows = await this.getAllRows(sheetId);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === url) {
        return i + 2; // +2 because rows are 0-indexed but sheets are 1-indexed and we start from row 2 (skip header)
      }
    }
    return null;
  }

  async deleteRow(rowNumber: number, spreadsheetId?: string): Promise<void> {
    const token = await this.getCachedAuthToken();
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();

    const request = {
      deleteDimension: {
        range: {
          sheetId: 0, // Sheet1 has sheetId 0
          dimension: 'ROWS',
          startIndex: rowNumber - 1, // Convert to 0-indexed
          endIndex: rowNumber // End index is exclusive
        }
      }
    };

    await this._fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [request] })
      }
    );

    // Invalidate rows cache since we modified the sheet
    this.invalidateRowsCache();
  }

  async updateRow(rowNumber: number, values: string[], spreadsheetId?: string): Promise<void> {
    const token = await this.getCachedAuthToken();
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();

    const body = { values: [values] };
    await this._fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A${rowNumber}:L${rowNumber}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    // Invalidate rows cache since we modified the sheet
    this.invalidateRowsCache();
  }

  async batchAppendRows(valuesList: string[][], spreadsheetId?: string): Promise<void> {
    if (valuesList.length === 0) return;

    const token = await this.getCachedAuthToken();
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();
    const startRow = await this.getNextRowNumber(sheetId);

    // Use the batchUpdate API for better performance
    const data = valuesList.map((values, index) => ({
      range: `Sheet1!A${startRow + index}:L${startRow + index}`,
      values: [values]
    }));

    const body = {
      valueInputOption: 'USER_ENTERED',
      data
    };

    await this._fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    // Invalidate rows cache since we modified the sheet
    this.invalidateRowsCache();
  }

  async batchUpdateRows(updates: Array<{ rowNumber: number; values: string[] }>, spreadsheetId?: string): Promise<void> {
    if (updates.length === 0) return;

    const token = await this.getCachedAuthToken();
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();

    const data = updates.map(({ rowNumber, values }) => ({
      range: `Sheet1!A${rowNumber}:L${rowNumber}`,
      values: [values]
    }));

    const body = {
      valueInputOption: 'USER_ENTERED',
      data
    };

    await this._fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    // Invalidate rows cache since we modified the sheet
    this.invalidateRowsCache();
  }

  async batchDeleteRows(rowNumbers: number[], spreadsheetId?: string): Promise<void> {
    if (rowNumbers.length === 0) return;

    const token = await this.getCachedAuthToken();
    const sheetId = spreadsheetId || await this.getOrCreateSpreadsheet();

    // Sort in descending order to avoid index shifting issues
    const sortedRows = [...rowNumbers].sort((a, b) => b - a);

    const requests = sortedRows.map(rowNumber => ({
      deleteDimension: {
        range: {
          sheetId: 0, // Sheet1 has sheetId 0
          dimension: 'ROWS',
          startIndex: rowNumber - 1, // Convert to 0-indexed
          endIndex: rowNumber // End index is exclusive
        }
      }
    }));

    await this._fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      }
    );

    // Invalidate rows cache since we modified the sheet
    this.invalidateRowsCache();
  }

  private invalidateRowsCache(): void {
    if (this.cache.rowsData) {
      this.cache.rowsData = undefined;
    }
  }

  public clearCache(): void {
    this.cache = {};
  }
}