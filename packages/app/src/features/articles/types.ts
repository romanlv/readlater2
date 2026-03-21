export * from '@readlater/core';

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