/**
 * Mock Google Sheets API server for testing.
 *
 * Simulates the Sheets v4 and Drive v3 endpoints used by GoogleSpreadsheetManager.
 * Maintains an in-memory spreadsheet so tests can observe real row-shifting,
 * duplicate-creation, and cross-device race conditions.
 *
 * Usage:
 *   const server = new MockGoogleSheetsServer();
 *   server.install();          // replaces global.fetch
 *   // ... run tests ...
 *   server.uninstall();        // restores original fetch
 */

import { SPREADSHEET_HEADERS } from '../spreadsheet/schema.js';

export interface MockSpreadsheet {
  id: string;
  name: string;
  /** rows[0] is the header row; data rows start at index 1. */
  rows: string[][];
}

export type FetchInterceptor = (url: string, method: string) => void;

export class MockGoogleSheetsServer {
  private spreadsheets = new Map<string, MockSpreadsheet>();
  private appDataFiles = new Map<string, string>(); // fileId -> content
  private originalFetch: typeof globalThis.fetch | null = null;
  private nextSpreadsheetId = 1;
  private nextFileId = 1;

  /**
   * Optional interceptor called BEFORE each request is processed.
   * Use this to simulate external changes between reads and writes.
   * e.g., inject an external row delete after a GET (read) but before a POST (write).
   */
  public onBeforeRequest: FetchInterceptor | null = null;

  // ─── public helpers for test setup / assertions ───

  /** Pre-populate a spreadsheet with data rows (header added automatically). */
  createSpreadsheet(name = 'ReadLater', dataRows: string[][] = []): string {
    const id = `sheet-${this.nextSpreadsheetId++}`;
    this.spreadsheets.set(id, {
      id,
      name,
      rows: [[...SPREADSHEET_HEADERS], ...dataRows],
    });
    return id;
  }

  /** Get all data rows (excluding the header). */
  getDataRows(spreadsheetId: string): string[][] {
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) throw new Error(`Spreadsheet ${spreadsheetId} not found`);
    return sheet.rows.slice(1);
  }

  /** Get a specific row by 1-based sheet row number (row 1 = header, row 2 = first data). */
  getRow(spreadsheetId: string, rowNumber: number): string[] | undefined {
    const sheet = this.spreadsheets.get(spreadsheetId);
    return sheet?.rows[rowNumber - 1];
  }

  /** Directly mutate the sheet to simulate another device editing it. */
  simulateExternalAppend(spreadsheetId: string, row: string[]): void {
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) throw new Error(`Spreadsheet ${spreadsheetId} not found`);
    sheet.rows.push(row);
  }

  /** Directly delete a row to simulate another device deleting it (1-based row number). */
  simulateExternalDelete(spreadsheetId: string, rowNumber: number): void {
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) throw new Error(`Spreadsheet ${spreadsheetId} not found`);
    sheet.rows.splice(rowNumber - 1, 1);
  }

  /** Set up appDataFolder so the manager can find the spreadsheet. */
  setAppDataConfig(spreadsheetId: string): void {
    const fileId = `config-${this.nextFileId++}`;
    this.appDataFiles.set(fileId, JSON.stringify({ spreadsheetId }));
  }

  // ─── fetch interception ───

  install(): void {
    this.originalFetch = globalThis.fetch;
    globalThis.fetch = this.handleFetch.bind(this) as typeof globalThis.fetch;
  }

  uninstall(): void {
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  reset(): void {
    this.spreadsheets.clear();
    this.appDataFiles.clear();
    this.nextSpreadsheetId = 1;
    this.nextFileId = 1;
  }

  // ─── route dispatcher ───

  private async handleFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method?.toUpperCase() || 'GET';

    // Fire interceptor so tests can simulate external changes at precise moments
    if (this.onBeforeRequest) {
      this.onBeforeRequest(url, method);
    }

    // Drive: list appDataFolder files
    if (url.includes('/drive/v3/files') && url.includes('appDataFolder') && method === 'GET') {
      return this.handleAppDataList();
    }

    // Drive: read appData file content
    const appDataReadMatch = url.match(/\/drive\/v3\/files\/([^?]+)\?alt=media/);
    if (appDataReadMatch && method === 'GET') {
      return this.handleAppDataRead(appDataReadMatch[1]);
    }

    // Drive: upload/update appData file
    if (url.includes('/upload/drive/v3/files') && (method === 'POST' || method === 'PATCH')) {
      return this.handleAppDataWrite(init);
    }

    // Drive: search for spreadsheet by name
    if (url.includes('/drive/v3/files') && url.includes('q=') && method === 'GET') {
      return this.handleDriveSearch(url);
    }

    // Sheets: create spreadsheet
    if (url.includes('/v4/spreadsheets') && method === 'POST' && !url.includes(':batchUpdate') && !url.includes('/values')) {
      return this.handleCreateSpreadsheet(init);
    }

    // Sheets: batchUpdate (delete rows)
    const batchUpdateMatch = url.match(/\/v4\/spreadsheets\/([^/:]+):batchUpdate/);
    if (batchUpdateMatch && method === 'POST') {
      return this.handleBatchUpdateStructure(batchUpdateMatch[1], init);
    }

    // Sheets: values batchUpdate (batch write)
    const valuesBatchMatch = url.match(/\/v4\/spreadsheets\/([^/]+)\/values:batchUpdate/);
    if (valuesBatchMatch && method === 'POST') {
      return this.handleValuesBatchUpdate(valuesBatchMatch[1], init);
    }

    // Sheets: get values (getAllRows or getNextRowNumber)
    const getValuesMatch = url.match(/\/v4\/spreadsheets\/([^/]+)\/values\/(.+?)(?:\?|$)/);
    if (getValuesMatch && method === 'GET') {
      return this.handleGetValues(getValuesMatch[1], getValuesMatch[2], url);
    }

    // Sheets: put values (appendRow, updateRow, addHeaders)
    const putValuesMatch = url.match(/\/v4\/spreadsheets\/([^/]+)\/values\/(.+?)(?:\?|$)/);
    if (putValuesMatch && method === 'PUT') {
      return this.handlePutValues(putValuesMatch[1], putValuesMatch[2], init);
    }

    console.warn(`[MockGoogleSheetsServer] Unhandled: ${method} ${url}`);
    return this.jsonResponse({}, 404);
  }

  // ─── handlers ───

  private handleAppDataList(): Response {
    const files = Array.from(this.appDataFiles.entries()).map(([id]) => ({
      id,
      name: 'readlater.config.json',
    }));
    return this.jsonResponse({ files });
  }

  private handleAppDataRead(fileId: string): Response {
    const content = this.appDataFiles.get(fileId);
    if (!content) return this.jsonResponse({ error: { message: 'Not found' } }, 404);
    return this.jsonResponse(JSON.parse(content));
  }

  private handleAppDataWrite(init?: RequestInit): Response {
    // Extract spreadsheetId from FormData body — in tests we just accept it
    const fileId = `config-${this.nextFileId++}`;
    // Try to parse the body to extract the config
    if (init?.body instanceof FormData) {
      const fileBlob = init.body.get('file');
      if (fileBlob instanceof Blob) {
        // We can't synchronously read the blob in this context,
        // so we just acknowledge it
      }
    }
    return this.jsonResponse({ id: fileId });
  }

  private handleDriveSearch(url: string): Response {
    const queryParam = decodeURIComponent(url.split('q=')[1]?.split('&')[0] || '');
    const nameMatch = queryParam.match(/name='([^']+)'/);
    const name = nameMatch?.[1];

    const found: Array<{ id: string; name: string }> = [];
    for (const sheet of this.spreadsheets.values()) {
      if (sheet.name === name) {
        found.push({ id: sheet.id, name: sheet.name });
      }
    }
    return this.jsonResponse({ files: found });
  }

  private handleCreateSpreadsheet(init?: RequestInit): Response {
    const body = JSON.parse((init?.body as string) || '{}');
    const name = body.properties?.title || 'Untitled';
    const id = this.createSpreadsheet(name);
    return this.jsonResponse({ spreadsheetId: id });
  }

  private handleBatchUpdateStructure(spreadsheetId: string, init?: RequestInit): Response {
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) return this.jsonResponse({ error: { message: 'Not found' } }, 404);

    const body = JSON.parse((init?.body as string) || '{}');
    const requests: Array<{
      deleteDimension?: {
        range: { startIndex: number; endIndex: number };
      };
    }> = body.requests || [];

    // Process delete requests — they come in descending order
    for (const req of requests) {
      if (req.deleteDimension) {
        const { startIndex, endIndex } = req.deleteDimension.range;
        const count = endIndex - startIndex;
        sheet.rows.splice(startIndex, count);
      }
    }

    return this.jsonResponse({ replies: [] });
  }

  private handleValuesBatchUpdate(spreadsheetId: string, init?: RequestInit): Response {
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) return this.jsonResponse({ error: { message: 'Not found' } }, 404);

    const body = JSON.parse((init?.body as string) || '{}');
    const data: Array<{ range: string; values: string[][] }> = body.data || [];

    for (const item of data) {
      const rowNum = this.parseRowFromRange(item.range);
      if (rowNum !== null && item.values?.[0]) {
        // Expand sheet if needed
        while (sheet.rows.length < rowNum) {
          sheet.rows.push([]);
        }
        sheet.rows[rowNum - 1] = item.values[0];
      }
    }

    return this.jsonResponse({ totalUpdatedRows: data.length });
  }

  private handleGetValues(spreadsheetId: string, range: string, url: string): Response {
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) return this.jsonResponse({ error: { message: 'Not found' } }, 404);

    // getNextRowNumber: Sheet1!A:A?majorDimension=COLUMNS
    if (url.includes('majorDimension=COLUMNS') && range.includes('A:A')) {
      const columnA = sheet.rows.map(row => row[0] || '').filter(v => v);
      return this.jsonResponse({ values: columnA.length > 0 ? [columnA] : [] });
    }

    // getAllRows: Sheet1!A2:L — returns data rows (skip header)
    if (range.match(/A2:L/)) {
      const dataRows = sheet.rows.slice(1); // skip header
      return this.jsonResponse({ values: dataRows.length > 0 ? dataRows : [] });
    }

    // Generic range read (e.g., A1:L1 for headers)
    return this.jsonResponse({ values: sheet.rows.length > 0 ? [sheet.rows[0]] : [] });
  }

  private handlePutValues(spreadsheetId: string, range: string, init?: RequestInit): Response {
    const sheet = this.spreadsheets.get(spreadsheetId);
    if (!sheet) return this.jsonResponse({ error: { message: 'Not found' } }, 404);

    const body = JSON.parse((init?.body as string) || '{}');
    const values: string[][] = body.values || [];

    const rowNum = this.parseRowFromRange(range);
    if (rowNum !== null && values[0]) {
      while (sheet.rows.length < rowNum) {
        sheet.rows.push([]);
      }
      sheet.rows[rowNum - 1] = values[0];
    }

    return this.jsonResponse({ updatedRows: values.length });
  }

  // ─── utilities ───

  private parseRowFromRange(range: string): number | null {
    // Match patterns like "Sheet1!A5:L5" or "Sheet1!A1:L1"
    const match = range.match(/!?A(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private jsonResponse(data: unknown, status = 200): Response {
    const body = JSON.stringify(data);
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
