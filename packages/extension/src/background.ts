/// <reference types="chrome"/>

import type { SaveArticleMessage, SaveArticleResponse } from '@readlater/core';
import { GoogleSheetsSyncEngine, ChromeAuthProvider, ChromeSpreadsheetStorage } from '@readlater/google-sheets-sync';

const authProvider = new ChromeAuthProvider();
const storage = new ChromeSpreadsheetStorage();
const syncEngine = new GoogleSheetsSyncEngine(authProvider, storage);

chrome.runtime.onMessage.addListener((
  message: SaveArticleMessage, 
  _sender: chrome.runtime.MessageSender, 
  sendResponse: (response: SaveArticleResponse) => void
) => {
  console.log('Received message:', message);
  
  if (message.action === 'saveArticle') {
    syncEngine.saveArticle(message.articleData)
      .then((result) => {
        console.log('Sync result:', result);
        sendResponse({ 
          success: result.success, 
          message: result.success ? 'Article saved successfully' : 'Failed to save article',
          error: result.error 
        });
      })
      .catch((error) => {
        console.error('Error saving article:', error);
        sendResponse({ 
          success: false, 
          message: 'Failed to save article',
          error: error.message 
        });
      });
    
    return true;
  }
});


