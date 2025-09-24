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
    <div className="w-full max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          {mode === 'create' ? 'Save Article' : 'Edit Article'}
        </h2>
      </div>
      <div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="url" className="text-foreground font-medium">URL</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder="https://stephango.com/vault"
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
              placeholder="How I use Obsidian — Steph Ango"
              required
              className="bg-background border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="description" className="text-foreground font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="https://stephango.com/vault"
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

          <div className="flex gap-3 pt-6">
            <Button
              type="submit"
              disabled={isLoading || !formData.url.trim() || !formData.title.trim()}
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
        </form>
      </div>
    </div>
  );
}