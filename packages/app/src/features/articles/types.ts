export * from '@readlater/core';

export interface GoogleSheetsConfig {
  CLIENT_ID: string;
  API_KEY: string;
}

export interface ShareTargetData {
  title?: string;
  text?: string;
  url?: string;
}

export interface ServiceWorkerMessage {
  type: string;
  message?: string;
  args?: unknown[];
}