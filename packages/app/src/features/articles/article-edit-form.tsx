import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Save Article' : 'Edit Article'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder="https://example.com/article"
              required
              disabled={mode === 'edit'} // URL should not be editable in edit mode
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Article title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description of the article"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Your personal notes about this article"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="technology, programming, ai (separate with commas)"
            />
            <p className="text-sm text-gray-500">
              Separate tags with commas
            </p>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              type="submit"
              disabled={isLoading || !formData.url.trim() || !formData.title.trim()}
              className="flex-1"
            >
              {isLoading ? 'Saving...' : mode === 'create' ? 'Save Article' : 'Update Article'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}