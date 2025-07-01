import { ArticleData, GoogleSheetsConfig } from './types';

declare global {
  interface Window {
    gapi: {
      load: (name: string, callback: () => void) => void;
      client: {
        init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        getToken: () => string | null;
        sheets: {
          spreadsheets: {
            values: {
              update: (params: unknown, body: unknown) => Promise<unknown>;
              get: (params: unknown) => Promise<{ result: { values?: string[][] } }>;
            };
          };
        };
      };
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: string;
          }) => {
            callback: (resp: unknown) => void;
            requestAccessToken: (options: { prompt: string }) => void;
          };
        };
      };
    };
    CONFIG: GoogleSheetsConfig;
  }
}

const DISCOVERY_DOCS = [
  'https://sheets.googleapis.com/$discovery/rest?version=v4',
];
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient: {
  callback: (resp: unknown) => void;
  requestAccessToken: (options: { prompt: string }) => void;
};
let gapiInited = false;
let gisInited = false;

export const initializeGapi = async (config: GoogleSheetsConfig): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window.gapi === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({
              apiKey: config.API_KEY,
              discoveryDocs: DISCOVERY_DOCS,
            });
            gapiInited = true;
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      };
      script.onerror = reject;
      document.head.appendChild(script);
    } else {
      resolve();
    }
  });
};

export const initializeGis = async (config: GoogleSheetsConfig): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window.google === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: config.CLIENT_ID,
          scope: SCOPES,
          callback: '',
        });
        gisInited = true;
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    } else {
      resolve();
    }
  });
};

export const authenticateAndExecute = async (callback: () => void): Promise<void> => {
  if (!gapiInited || !gisInited) {
    throw new Error('GAPI or GIS not initialized');
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp: unknown) => {
      const authResp = resp as { error?: string };
      if (authResp.error !== undefined) {
        console.error('Auth failed', authResp);
        if (authResp.error === 'popup_closed_by_user') {
          reject(new Error('The sign-in popup was closed or blocked. Please allow pop-ups for this site and try again.'));
        } else {
          reject(new Error('Authentication failed'));
        }
        return;
      }
      try {
        callback();
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    if (!window.gapi.client.getToken()) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const saveArticlesToSheet = async (articles: ArticleData[], spreadsheetId: string): Promise<void> => {
  const values = articles.map(article => [
    article.url,
    article.title || '',
    article.tags?.join(', ') || '',
    article.notes || '',
    article.description || '',
    article.featuredImage || '',
    article.timestamp || new Date().toISOString(),
    article.domain || '',
    article.archived ? 'TRUE' : 'FALSE',
    article.favorite ? 'TRUE' : 'FALSE'
  ]);

  const params = {
    spreadsheetId,
    range: `Sheet1!A2:J${values.length + 1}`,
    valueInputOption: 'RAW',
  };

  const body = { values };

  try {
    const response = await window.gapi.client.sheets.spreadsheets.values.update(params, body);
    console.log('Saved to Google Sheets', response);
  } catch (error) {
    console.error('Error saving data', error);
    throw error;
  }
};

export const loadArticlesFromSheet = async (spreadsheetId: string): Promise<ArticleData[]> => {
  const params = {
    spreadsheetId,
    range: 'Sheet1!A2:J',
  };

  try {
    const response = await window.gapi.client.sheets.spreadsheets.values.get(params);
    const rows = response.result.values || [];
    
    return rows.map((row: string[]) => ({
      url: row[0] || '',
      title: row[1] || '',
      tags: row[2] ? row[2].split(', ').filter(Boolean) : [],
      notes: row[3] || '',
      description: row[4] || '',
      featuredImage: row[5] || '',
      timestamp: row[6] || new Date().toISOString(),
      domain: row[7] || '',
      archived: row[8] === 'TRUE',
      favorite: row[9] === 'TRUE',
    }));
  } catch (error) {
    console.error('Error loading data', error);
    throw error;
  }
};