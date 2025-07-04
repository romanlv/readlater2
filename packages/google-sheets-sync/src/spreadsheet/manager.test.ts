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
    
    const mockFetch = (data: Record<string, unknown>) => {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data),
      });
    };
    
    global.fetch = vi.fn().mockImplementation((url) => {
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
    (global.fetch as vi.Mock)
      .mockResolvedValueOnce(Promise.resolve({ // Find config file in AppData
        ok: true,
        json: () => Promise.resolve({ files: [{ id: 'config-file-id', name: 'readlater.config.json' }] }),
        text: () => Promise.resolve(JSON.stringify({ files: [{ id: 'config-file-id', name: 'readlater.config.json' }] })),
      }))
      .mockResolvedValueOnce(Promise.resolve({ // Read config file content
        ok: true,
        json: () => Promise.resolve({ spreadsheetId: 'app-data-sheet-id' }),
        text: () => Promise.resolve(JSON.stringify({ spreadsheetId: 'app-data-sheet-id' })),
      }));

    const spreadsheetId = await manager.getOrCreateSpreadsheet();
    expect(spreadsheetId).toBe('app-data-sheet-id');
    expect(storage.setSpreadsheetId).toHaveBeenCalledWith('app-data-sheet-id');
  });

  test('should fall back to searching Drive if not in AppData or local storage', async () => {
    (global.fetch as vi.Mock)
      .mockResolvedValueOnce(Promise.resolve({ // AppData search fails
        ok: true,
        json: () => Promise.resolve({ files: [] }),
        text: () => Promise.resolve(JSON.stringify({ files: [] })),
      }))
      .mockResolvedValueOnce(Promise.resolve({ // Drive search succeeds
        ok: true,
        json: () => Promise.resolve({ files: [{ id: 'drive-sheet-id', name: 'ReadLater' }] }),
        text: () => Promise.resolve(JSON.stringify({ files: [{ id: 'drive-sheet-id', name: 'ReadLater' }] })),
      }))
      .mockResolvedValueOnce(Promise.resolve({ // Write to AppData succeeds
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(JSON.stringify({})),
      }));

    const spreadsheetId = await manager.getOrCreateSpreadsheet();
    expect(spreadsheetId).toBe('drive-sheet-id');
    expect(storage.setSpreadsheetId).toHaveBeenCalledWith('drive-sheet-id');
  });

  test('should create a new spreadsheet if not found anywhere', async () => {
    (global.fetch as vi.Mock)
      .mockResolvedValueOnce(Promise.resolve({ ok: true, json: () => Promise.resolve({ files: [] }), text: () => Promise.resolve(JSON.stringify({ files: [] })) })) // AppData search
      .mockResolvedValueOnce(Promise.resolve({ ok: true, json: () => Promise.resolve({ files: [] }), text: () => Promise.resolve(JSON.stringify({ files: [] })) })) // Drive search
      .mockResolvedValueOnce(Promise.resolve({ // Create spreadsheet
        ok: true,
        json: () => Promise.resolve({ spreadsheetId: 'new-sheet-id' }),
        text: () => Promise.resolve(JSON.stringify({ spreadsheetId: 'new-sheet-id' })),
      }))
      .mockResolvedValueOnce(Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve(JSON.stringify({})) })) // Add headers
      .mockResolvedValueOnce(Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve(JSON.stringify({})) })); // Write to AppData

    const spreadsheetId = await manager.getOrCreateSpreadsheet();
    expect(spreadsheetId).toBe('new-sheet-id');
    expect(storage.setSpreadsheetId).toHaveBeenCalledWith('new-sheet-id');
  });
});
