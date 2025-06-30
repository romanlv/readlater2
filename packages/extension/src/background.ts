/// <reference types="chrome"/>

interface ArticleData {
  url: string;
  title: string;
  description: string;
  featuredImage: string;
  timestamp: string;
  domain: string;
  tags?: string[];
  notes?: string;
  archived?: boolean;
  favorite?: boolean;
}

interface SaveArticleMessage {
  action: 'saveArticle';
  data: ArticleData;
}

interface MessageResponse {
  success: boolean;
  error?: string;
}

chrome.runtime.onMessage.addListener((
  message: SaveArticleMessage, 
  _sender: chrome.runtime.MessageSender, 
  sendResponse: (response: MessageResponse) => void
) => {
  console.log('Received message:', message);
  
  if (message.action === 'saveArticle') {
    saveToGoogleSheets(message.data)
      .then(() => {
        console.log('Successfully saved to Google Sheets');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error saving article:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

function extractPageData(): ArticleData {
  const url = window.location.href;
  const title = document.title || url;
  
  let description = '';
  const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
  if (metaDesc) {
    description = metaDesc.content;
  }
  
  let featuredImage = '';
  const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
  if (ogImage) {
    featuredImage = ogImage.content;
  }
  
  return {
    url,
    title,
    description,
    featuredImage,
    timestamp: new Date().toISOString(),
    domain: new URL(url).hostname
  };
}

async function saveToGoogleSheets(article: ArticleData): Promise<void> {
  console.log('Getting auth token...');
  const token = await getAuthToken();
  console.log('Got auth token, getting/creating spreadsheet...');
  
  const spreadsheetId = await getOrCreateReadLaterSpreadsheet(token);
  console.log('Using spreadsheet ID:', spreadsheetId);
  
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    }
  );
  
  let nextRow = 1;
  if (getResponse.ok) {
    const data = await getResponse.json();
    if (data.values && data.values.length > 0) {
      nextRow = data.values.length + 1;
    }
  }
  
  console.log('Next row to write:', nextRow);
  
  const requestBody = {
    majorDimension: 'ROWS',
    values: [[
      article.url || '',
      article.title || '',
      article.tags ? article.tags.join(', ') : '',
      article.notes || '',
      article.description || '',
      article.featuredImage || '',
      article.timestamp || '',
      article.domain || '',
      article.archived ? '1' : '',
      article.favorite ? '1' : ''
    ]]
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
  
  console.log('API response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('API error response:', errorText);
    throw new Error(`Failed to save to Google Sheets: ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('API success response:', result);
}

async function getOrCreateReadLaterSpreadsheet(token: string): Promise<string> {
  const spreadsheetName = 'ReadLater';
  
  try {
    const existingId = await findSpreadsheetByName(token, spreadsheetName);
    if (existingId) {
      console.log('Found existing spreadsheet:', existingId);
      await chrome.storage.local.set({ readlater_spreadsheet_id: existingId });
      return existingId;
    }
  } catch (error) {
    console.log('Drive API search failed, falling back to storage check:', (error as Error).message);
    
    const stored = await chrome.storage.local.get(['readlater_spreadsheet_id']);
    if (stored.readlater_spreadsheet_id) {
      console.log('Using stored spreadsheet ID:', stored.readlater_spreadsheet_id);
      return stored.readlater_spreadsheet_id;
    }
  }
  
  console.log(`No existing '${spreadsheetName}' spreadsheet found, creating new one...`);
  
  const spreadsheetResponse = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: spreadsheetName
        }
      })
    }
  );
  
  if (!spreadsheetResponse.ok) {
    const errorText = await spreadsheetResponse.text();
    console.error('Failed to create spreadsheet:', errorText);
    throw new Error('Unable to create spreadsheet. Please configure SPREADSHEET_ID in config.js');
  }
  
  const spreadsheet = await spreadsheetResponse.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  
  await addHeadersToSpreadsheet(token, spreadsheetId);
  await chrome.storage.local.set({ readlater_spreadsheet_id: spreadsheetId });
  
  console.log('Created new spreadsheet:', spreadsheetId);
  console.log('Spreadsheet URL:', `https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  
  return spreadsheetId;
}

async function findSpreadsheetByName(token: string, name: string): Promise<string | null> {
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

async function addHeadersToSpreadsheet(token: string, spreadsheetId: string): Promise<void> {
  const headers = [
    'URL',
    'Title',
    'Tags', 
    'Notes',
    'Description',
    'Featured Image',
    'Timestamp',
    'Domain',
    'Archived',
    'Favorite'
  ];
  
  const requestBody = {
    majorDimension: 'ROWS',
    values: [headers]
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

async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token?: string) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token!);
      }
    });
  });
}