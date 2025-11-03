import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface ArticleFormData {
  url: string;
  title: string;
  description: string;
  notes: string;
  tags: string[];
}

interface ArticleEditFormProps {
  initialData: Partial<ArticleFormData>;
  onSave: (data: ArticleFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

export function ArticleEditForm({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
  mode = 'create'
}: ArticleEditFormProps) {
  const [formData, setFormData] = useState<ArticleFormData>({
    url: initialData.url || '',
    title: initialData.title || '',
    description: initialData.description || '',
    notes: initialData.notes || '',
    tags: initialData.tags || []
  });

  const [tagsInput, setTagsInput] = useState(
    initialData.tags ? initialData.tags.join(', ') : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse tags from comma-separated string
    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onSave({
      ...formData,
      tags
    });
  };

  const handleInputChange = (field: keyof ArticleFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="w-full max-w-2xl flex flex-col">
      <div className="flex-1 pb-24 md:pb-0 px-6 md:px-0">
        <form onSubmit={handleSubmit} className="space-y-6" id="article-form">
          <div className="space-y-3">
            <Label htmlFor="url" className="text-foreground font-medium">URL</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder="https://example.com/article"
              required
              disabled={mode === 'edit'} // URL should not be editable in edit mode
              className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="title" className="text-foreground font-medium">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Article title (auto-filled from page)"
              className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="description" className="text-foreground font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description or summary of the article"
              rows={3}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="notes" className="text-foreground font-medium">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Your personal notes about this article"
              rows={4}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="tags" className="text-foreground font-medium">Tags</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="technology, programming, ai (separate with commas)"
              className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              Separate tags with commas
            </p>
          </div>
        </form>
      </div>

      {/* Sticky button bar on mobile */}
      <div className="fixed bottom-0 left-0 right-0 md:relative bg-background border-t md:border-t-0 border-border p-4 md:p-0 md:pt-6 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button
            type="submit"
            form="article-form"
            disabled={isLoading || !formData.url.trim()}
            className="flex-1 font-medium py-3"
          >
            {isLoading ? 'Saving...' : mode === 'create' ? 'Save Article' : 'Update Article'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}