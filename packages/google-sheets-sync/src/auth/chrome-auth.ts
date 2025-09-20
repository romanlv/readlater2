import { AuthProvider } from '@readlater/core';

export class ChromeAuthProvider implements AuthProvider {
  async getAuthToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('No token received'));
        }
      });
    });
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      return !!token;
    } catch {
      return false;
    }
  }

  async authenticate(): Promise<void> {
    await this.getAuthToken();
  }

  async clearAuthToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (result) => {
        if (result && typeof result === 'string') {
          chrome.identity.removeCachedAuthToken({ token: result }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  }
}