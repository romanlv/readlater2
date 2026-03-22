import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Article } from '@/lib/db';
import { articleRepository } from '@/features/articles/repository';
import { parseCsvToArticles } from './csv';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportPreview {
  newArticles: Partial<Article>[];
  duplicateCount: number;
  errors: string[];
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setPreview(null);
    setResult(null);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const { articles, errors } = parseCsvToArticles(text);

    // Check for duplicates
    let duplicateCount = 0;
    const newArticles: Partial<Article>[] = [];

    for (const article of articles) {
      if (!article.url) continue;
      const existing = await articleRepository.getByUrl(article.url);
      if (existing) {
        duplicateCount++;
      } else {
        newArticles.push(article);
      }
    }

    setPreview({ newArticles, duplicateCount, errors });
    setResult(null);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);

    let imported = 0;
    for (const article of preview.newArticles) {
      try {
        await articleRepository.save({
          url: article.url!,
          title: article.title || article.url!,
          description: article.description,
          featuredImage: article.featuredImage || '',
          domain: article.domain || new URL(article.url!).hostname,
          tags: article.tags || [],
          notes: article.notes,
          archived: article.archived ?? false,
          favorite: article.favorite ?? false,
          timestamp: article.timestamp || Date.now(),
          syncStatus: 'pending',
        });
        imported++;
      } catch {
        // skip failed individual articles
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['articles'] });
    setImporting(false);
    setResult(`Imported ${imported} article${imported !== 1 ? 's' : ''}.`);
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <h2 className="text-lg font-semibold text-foreground mb-4">Import Articles</h2>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!preview && !result && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a CSV file to import articles. The CSV should have a "url" column at minimum.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose CSV File
            </Button>
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p className="text-foreground">
                <span className="font-medium">{preview.newArticles.length}</span> new article{preview.newArticles.length !== 1 ? 's' : ''} to import
              </p>
              {preview.duplicateCount > 0 && (
                <p className="text-muted-foreground">
                  {preview.duplicateCount} duplicate{preview.duplicateCount !== 1 ? 's' : ''} will be skipped
                </p>
              )}
              {preview.errors.length > 0 && (
                <div className="text-destructive">
                  <p>{preview.errors.length} error{preview.errors.length !== 1 ? 's' : ''}:</p>
                  <ul className="list-disc pl-4 mt-1 max-h-32 overflow-y-auto">
                    {preview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || preview.newArticles.length === 0}
              >
                {importing ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">{result}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
