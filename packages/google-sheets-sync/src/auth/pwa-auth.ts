import { AuthProvider } from '@readlater/core';

declare global {
  interface Window {
    gapi: {
      load: (name: string, callback: () => void) => void;
      client: {
        init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        getToken: () => string | null;
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
  }
}

const TOKEN_STORAGE_KEY = 'readlater_google_auth_token';
const TOKEN_EXPIRY_STORAGE_KEY = 'readlater_google_auth_token_expiry';

export class AuthenticationRequiredError extends Error {
  constructor(message = 'Authentication is required.') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export interface PwaAuthConfig {
  clientId: string;
  apiKey: string;
}


export class PwaAuthProvider implements AuthProvider {
  private config: PwaAuthConfig;
  private token: string | null = null;

  constructor(config: PwaAuthConfig) {
    this.config = config;
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage() {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_STORAGE_KEY);

    if (storedToken && expiry && Date.now() < parseInt(expiry, 10)) {
      this.token = storedToken;
      console.log('Loaded auth token from storage.');
    } else {
      this.clearAuthToken();
    }
  }

  private setToken(token: string, expiresIn: number) {
    this.token = token;
    const expiryTime = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_STORAGE_KEY, expiryTime.toString());
    console.log(`Token stored, expires in ${expiresIn} seconds.`);
  }

  async getAuthToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    // If no token, signal to the UI that it needs to initiate the auth flow.
    throw new AuthenticationRequiredError();
  }

  redirectToAuth() {
    console.log('Redirecting to Google for authentication...');
    const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    
    const params = {
      client_id: this.config.clientId,
      redirect_uri: window.location.origin + window.location.pathname,
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
      include_granted_scopes: 'true',
      state: 'pass-through-value', // Can be used to pass state
    };

    const url = `${oauth2Endpoint}?${new URLSearchParams(params).toString()}`;
    window.location.assign(url);
  }

  async handleRedirect(): Promise<boolean> {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');

    if (accessToken && expiresIn) {
      console.log('Handling redirect, found access token.');
      this.setToken(accessToken, parseInt(expiresIn, 10));
      
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      return true;
    }
    return false;
  }

  async isAuthenticated(): Promise<boolean> {
    return this.token !== null;
  }

  async authenticate(): Promise<void> {
    await this.getAuthToken();
  }

  async clearAuthToken(): Promise<void> {
    this.token = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_STORAGE_KEY);
    console.log('Auth token cleared.');
  }
}