import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SharedData {
  title?: string;
  text?: string;
  url?: string;
}

interface ShareTargetDisplayProps {
  sharedData: SharedData | null;
  onSaveArticle: () => void;
  onViewArticles: () => void;
}

export function ShareTargetDisplay({ sharedData, onSaveArticle, onViewArticles }: ShareTargetDisplayProps) {
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

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Shared Content</CardTitle>
          <CardDescription>Content received via Web Share Target</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {decodedTitle && (
            <div>
              <strong>Title:</strong> {decodedTitle}
            </div>
          )}
          {decodedText && (
            <div>
              <strong>Text:</strong> {decodedText}
            </div>
          )}
          {decodedUrl && (
            <div>
              <strong>URL:</strong>{' '}
              <a 
                href={decodedUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {decodedUrl}
              </a>
            </div>
          )}
          {!decodedTitle && !decodedText && !decodedUrl && (
            <p>No share data received.</p>
          )}
          
          <div className="flex gap-2 pt-4 border-t">
            {decodedUrl && (
              <Button 
                onClick={onSaveArticle} 
                className="flex-1"
              >
                Save Article
              </Button>
            )}
            <Button 
              onClick={onViewArticles} 
              variant="outline"
              className="flex-1"
            >
              View All Articles
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
