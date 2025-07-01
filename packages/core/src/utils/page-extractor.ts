import { ArticleData } from '../types/article.js';

export interface TabInfo {
  url?: string;
  title?: string;
  favIconUrl?: string;
}

export function extractPageData(tab: TabInfo): ArticleData {
  const url = tab.url || '';
  const title = tab.title || '';
  const domain = url ? extractDomain(url) : '';
  const timestamp = new Date().toISOString();

  return {
    url,
    title,
    description: '', // Will be filled by content script meta extraction
    featuredImage: tab.favIconUrl || '',
    timestamp,
    domain,
    tags: [],
    notes: '',
    archived: false,
    favorite: false,
  };
}

export function extractPageDataFromDocument(): Partial<ArticleData> {
  const getMetaContent = (name: string): string => {
    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return meta?.getAttribute('content') || '';
  };

  return {
    title: document.title,
    description: getMetaContent('description') || getMetaContent('og:description'),
    featuredImage: getMetaContent('og:image'),
    url: window.location.href,
    domain: window.location.hostname,
    timestamp: new Date().toISOString(),
  };
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}