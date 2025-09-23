import { ArticleData } from '@readlater/core';

export const SPREADSHEET_HEADERS = [
  'URL',
  'Title',
  'Tags',
  'Notes',
  'Description',
  'Featured Image',
  'Timestamp',
  'Domain',
  'Archived',
  'Favorite',
  'Edited At'
] as const;

export function articleToSheetRow(article: ArticleData): string[] {
  return [
    article.url || '',
    article.title || '',
    article.tags ? article.tags.join(', ') : '',
    article.notes || '',
    article.description || '',
    article.featuredImage || '',
    article.timestamp || '',
    article.domain || '',
    article.archived ? '1' : '',
    article.favorite ? '1' : '',
    article.editedAt || ''
  ];
}

export function sheetRowToArticle(row: string[]): ArticleData {
  return {
    url: row[0] || '',
    title: row[1] || '',
    tags: row[2] ? row[2].split(', ').filter(tag => tag.trim()) : [],
    notes: row[3] || '',
    description: row[4] || '',
    featuredImage: row[5] || '',
    timestamp: row[6] || '',
    domain: row[7] || '',
    archived: row[8] === '1',
    favorite: row[9] === '1',
    editedAt: row[10] || undefined
  };
}