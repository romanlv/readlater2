import { Article } from '@/lib/db';

const CSV_FIELDS = ['url', 'title', 'description', 'domain', 'tags', 'notes', 'archived', 'favorite', 'timestamp'] as const;

function escapeField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function articlesToCsv(articles: Article[]): string {
  const header = CSV_FIELDS.map(escapeField).join(',');

  const rows = articles.map(article => {
    const values: string[] = [
      article.url,
      article.title,
      article.description ?? '',
      article.domain,
      (article.tags ?? []).join('|'),
      article.notes ?? '',
      String(article.archived),
      String(article.favorite),
      new Date(article.timestamp).toISOString(),
    ];
    return values.map(escapeField).join(',');
  });

  return '\uFEFF' + [header, ...rows].join('\n');
}

// State-machine CSV row parser that handles quoted fields with embedded commas/newlines
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let fields: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        fields.push(current);
        current = '';
        if (fields.some(f => f.length > 0)) {
          rows.push(fields);
        }
        fields = [];
        if (ch === '\r') i++; // skip \n in \r\n
      } else {
        current += ch;
      }
    }
  }

  // Handle last row (no trailing newline)
  fields.push(current);
  if (fields.some(f => f.length > 0)) {
    rows.push(fields);
  }

  return rows;
}

export interface ParseResult {
  articles: Partial<Article>[];
  errors: string[];
}

export function parseCsvToArticles(csvText: string): ParseResult {
  // Strip BOM
  const text = csvText.replace(/^\uFEFF/, '');
  const rows = parseCsvRows(text);

  if (rows.length === 0) {
    return { articles: [], errors: ['Empty CSV file'] };
  }

  const headerRow = rows[0].map(h => h.trim().toLowerCase());
  const urlIndex = headerRow.indexOf('url');

  if (urlIndex === -1) {
    return { articles: [], errors: ['CSV must have a "url" column'] };
  }

  const articles: Partial<Article>[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (field: string): string => {
      const idx = headerRow.indexOf(field);
      return idx >= 0 && idx < row.length ? row[idx].trim() : '';
    };

    const url = get('url');
    if (!url) {
      errors.push(`Row ${i + 1}: missing URL, skipped`);
      continue;
    }

    let domain = get('domain');
    if (!domain) {
      try {
        domain = new URL(url).hostname;
      } catch {
        errors.push(`Row ${i + 1}: invalid URL "${url}", skipped`);
        continue;
      }
    }

    const tagsStr = get('tags');
    const timestampStr = get('timestamp');
    let timestamp = Date.now();
    if (timestampStr) {
      const parsed = new Date(timestampStr).getTime();
      if (!isNaN(parsed)) timestamp = parsed;
    }

    articles.push({
      url,
      title: get('title') || url,
      description: get('description') || undefined,
      domain,
      tags: tagsStr ? tagsStr.split('|').map(t => t.trim()).filter(Boolean) : [],
      notes: get('notes') || undefined,
      archived: get('archived') === 'true',
      favorite: get('favorite') === 'true',
      timestamp,
      syncStatus: 'pending',
    });
  }

  return { articles, errors };
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
