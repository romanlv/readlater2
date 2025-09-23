import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArticleEditForm, ArticleFormData } from '@/features/articles/article-edit-form';

interface SharedData {
  title?: string;
  text?: string;
  url?: string;
}

interface ShareTargetDisplayProps {
  sharedData: SharedData | null;
  onSaveArticle: (formData: ArticleFormData) => void;
  onViewArticles: () => void;
  isLoading?: boolean;
}

export function ShareTargetDisplay({ sharedData, onSaveArticle, onViewArticles, isLoading }: ShareTargetDisplayProps) {
  if (!sharedData) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Share Target</CardTitle>
            <CardDescription>No shared content received</CardDescription>
          </CardHeader>
          <CardContent>
            <p>This page is designed to receive shared content from other apps.</p>
            <Button onClick={onViewArticles} className="mt-4">
              View Articles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const decodedTitle = sharedData.title ? decodeURIComponent(sharedData.title) : '';
  const decodedText = sharedData.text ? decodeURIComponent(sharedData.text) : '';
  const decodedUrl = sharedData.url ? decodeURIComponent(sharedData.url) : '';

  // Always show the edit form when there's shared data
  return (
    <div className="container max-w-2xl mx-auto p-4">
      <ArticleEditForm
        initialData={{
          url: decodedUrl,
          title: decodedTitle || decodedUrl || '',
          description: decodedText || '',
          notes: '',
          tags: []
        }}
        onSave={onSaveArticle}
        onCancel={onViewArticles}
        isLoading={isLoading}
        mode="create"
      />
    </div>
  );
}
