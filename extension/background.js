importScripts('config.js');

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'saveArticle') {
    // Handle async operation properly
    saveToGoogleSheets(message.data)
      .then(() => {
        console.log('Successfully saved to Google Sheets');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error saving article:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
});

function extractPageData() {
  const url = window.location.href;
  const title = document.title || url;
  
  let description = '';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    description = metaDesc.content;
  }
  
  let featuredImage = '';
  const ogImage = document.querySelector('meta[property="og:image"]');
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

async function saveToGoogleSheets(article) {
  console.log('Getting auth token...');
  const token = await getAuthToken();
  console.log('Got auth token, making API request...');
  
  // First, get the current data to find the next empty row
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/Sheet1!A:A`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    }
  );
  
  let nextRow = 1; // Default to row 1 if sheet is empty
  if (getResponse.ok) {
    const data = await getResponse.json();
    if (data.values && data.values.length > 0) {
      nextRow = data.values.length + 1; // Next empty row
    }
  }
  
  console.log('Next row to write:', nextRow);
  
  const requestBody = {
    majorDimension: 'ROWS',
    values: [[
      article.url || '',
      article.tags ? article.tags.join(', ') : '',
      article.notes || article.title || '',
      article.description || '',
      article.featuredImage || '',
      article.timestamp || '',
      article.domain || ''
    ]]
  };
  
  console.log('Request body:', requestBody);
  console.log('First row data:', requestBody.values[0]);
  console.log('URL (should be in column A):', requestBody.values[0][0]);
  console.log('Tags (should be in column B):', requestBody.values[0][1]);
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/Sheet1!A${nextRow}:G${nextRow}?valueInputOption=USER_ENTERED`,
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

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// Icon management functions (kept for potential future use)
async function updateIcon(state, tabId) {
  const iconPaths = {
    default: 'icon-192.png',
    saved: 'icon-192.png',
    error: 'icon-192.png'
  };
  
  const badgeTexts = {
    default: '',
    saving: '...',
    saved: '✓',
    error: '✗'
  };
  
  const badgeColors = {
    default: '#000000',
    saving: '#0000FF',
    saved: '#00FF00',
    error: '#FF0000'
  };
  
  await chrome.action.setIcon({
    path: iconPaths[state],
    tabId: tabId
  });
  
  await chrome.action.setBadgeText({
    text: badgeTexts[state],
    tabId: tabId
  });
  
  await chrome.action.setBadgeBackgroundColor({
    color: badgeColors[state],
    tabId: tabId
  });
}