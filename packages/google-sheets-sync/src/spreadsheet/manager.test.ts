import { describe, test, expect, vi, beforeEach } from 'vitest';
import { GoogleSpreadsheetManager, LocalStorageSpreadsheetStorage } from './manager';
import { PwaAuthProvider } from '../auth/pwa-auth';

// Mock the fetch API
global.fetch = vi.fn();

const mockAuthProvider = new PwaAuthProvider({ clientId: 'test-client', apiKey: 'test-api' });
mockAuthProvider.getAuthToken = vi.fn().mockResolvedValue('fake-token');

describe('GoogleSpreadsheetManager', () => {
  let manager: GoogleSpreadsheetManager;
  let storage: LocalStorageSpreadsheetStorage;

  beforeEach(() => {
    storage = new LocalStorageSpreadsheetStorage();
    manager = new GoogleSpreadsheetManager(mockAuthProvider, storage, 'ReadLater');
    vi.spyOn(storage, 'getSpreadsheetId').mockResolvedValue(null);
    vi.spyOn(storage, 'setSpreadsheetId').mockResolvedValue(undefined);
    
    const mockFetch = (data: Record<string, unknown>): Promise<Response> => {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data),
      } as Response);
    };
    
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('appDataFolder')) {
        return mockFetch({ files: [] });
      }
      if (url.includes('files?q=')) {
        return mockFetch({ files: [] });
      }
      if (url.includes('spreadsheets')) {
        return mockFetch({ spreadsheetId: 'new-sheet-id' });
      }
      return mockFetch({});
    });
  });

  test('should prioritize spreadsheet ID from AppDataFolder', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        // Find config file in AppData
        ok: true,
        json: () => Promise.resolve({ files: [{ id: 'config-file-id', name: 'readlater.config.json' }] }),
        text: () => Promise.resolve(JSON.stringify({ files: [{ id: 'config-file-id', name: 'readlater.config.json' }] }))
      } as Response)
      .mockResolvedValueOnce({
        // Read config file content
        ok: true,
        json: () => Promise.resolve({ spreadsheetId: 'app-data-sheet-id' }),
        text: () => Promise.resolve(JSON.stringify({ spreadsheetId: 'app-data-sheet-id' }))
      } as Response);

    const spreadsheetId = await manager.getOrCreateSpreadsheet();
    expect(spreadsheetId).toBe('app-data-sheet-id');
    expect(storage.setSpreadsheetId).toHaveBeenCalledWith('app-data-sheet-id');
  });

  test('should fall back to searching Drive if not in AppData or local storage', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        // AppData search fails
        ok: true,
        json: () => Promise.resolve({ files: [] }),
        text: () => Promise.resolve(JSON.stringify({ files: [] }))
      } as Response)
      .mockResolvedValueOnce({
        // Drive search succeeds
        ok: true,
        json: () => Promise.resolve({ files: [{ id: 'drive-sheet-id', name: 'ReadLater' }] }),
        text: () => Promise.resolve(JSON.stringify({ files: [{ id: 'drive-sheet-id', name: 'ReadLater' }] }))
      } as Response)
      .mockResolvedValueOnce({
        // Write to AppData succeeds
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(JSON.stringify({}))
      } as Response);

    const spreadsheetId = await manager.getOrCreateSpreadsheet();
    expect(spreadsheetId).toBe('drive-sheet-id');
    expect(storage.setSpreadsheetId).toHaveBeenCalledWith('drive-sheet-id');
  });

  test('should create a new spreadsheet if not found anywhere', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
        text: () => Promise.resolve(JSON.stringify({ files: [] }))
      } as Response) // AppData search
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
        text: () => Promise.resolve(JSON.stringify({ files: [] }))
      } as Response) // Drive search
      .mockResolvedValueOnce({
        // Create spreadsheet
        ok: true,
        json: () => Promise.resolve({ spreadsheetId: 'new-sheet-id' }),
        text: () => Promise.resolve(JSON.stringify({ spreadsheetId: 'new-sheet-id' }))
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve(JSON.stringify({})) } as Response) // Add headers
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve(JSON.stringify({})) } as Response); // Write to AppData

    const spreadsheetId = await manager.getOrCreateSpreadsheet();
    expect(spreadsheetId).toBe('new-sheet-id');
    expect(storage.setSpreadsheetId).toHaveBeenCalledWith('new-sheet-id');
  });
});
