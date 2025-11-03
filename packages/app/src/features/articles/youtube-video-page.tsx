import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { YouTubePlayer } from '@/components/youtube-player';
import { useArticle, useUpdateArticle } from './hooks';
import { ArrowLeft } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { extractYouTubeVideoId } from '@/lib/youtube';
import { decodeArticleUrl } from '@/lib/url-encode';
import { useParams, useNavigate } from 'react-router';

export function YouTubeVideoPage() {
  const { encodedUrl } = useParams<{ encodedUrl: string }>();
  const navigate = useNavigate();
  const articleUrl = encodedUrl ? decodeArticleUrl(encodedUrl) : '';
  const { data: article, isLoading, error } = useArticle(articleUrl);
  const [notes, setNotes] = useState('');
  const updateArticleMutation = useUpdateArticle();
  const debouncedNotes = useDebounce(notes, 1000);

  // Initialize notes from article data
  useEffect(() => {
    if (article) {
      setNotes(article.notes || '');
    }
  }, [article]);

  // Auto-save notes when they change (after debounce)
  useEffect(() => {
    if (article && debouncedNotes !== (article.notes || '')) {
      updateArticleMutation.mutate({
        url: articleUrl,
        updates: { notes: debouncedNotes, editedAt: Date.now() }
      });
    }
  }, [debouncedNotes, articleUrl, article, updateArticleMutation]);

  // Save notes on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (article && notes !== (article.notes || '')) {
        updateArticleMutation.mutate({
          url: articleUrl,
          updates: { notes, editedAt: Date.now() }
        });
      }
    };
  }, [notes, articleUrl, article, updateArticleMutation]);

  // Save notes immediately when textarea loses focus
  const handleNotesBlur = () => {
    if (article && notes !== (article.notes || '')) {
      updateArticleMutation.mutate({
        url: articleUrl,
        updates: { notes, editedAt: Date.now() }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-4 min-h-screen bg-background text-foreground">
        <div className="text-center py-8">Loading article...</div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container max-w-4xl mx-auto p-4 min-h-screen bg-background text-foreground">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div className="text-center py-8 text-destructive">
          Article not found or failed to load
        </div>
      </div>
    );
  }

  const videoId = extractYouTubeVideoId(article.url);

  if (!videoId) {
    return (
      <div className="container max-w-4xl mx-auto p-4 min-h-screen bg-background text-foreground">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div className="text-center py-8 text-destructive">
          Invalid YouTube URL
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 min-h-screen bg-background text-foreground">
      <div className="mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{article.title}</h1>

        <YouTubePlayer videoId={videoId} title={article.title} />

        <div className="space-y-2">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes
            {updateArticleMutation.isPending && (
              <span className="ml-2 text-xs text-muted-foreground">Saving...</span>
            )}
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add your notes here..."
            className="w-full min-h-[200px] px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground resize-y"
          />
        </div>
      </div>
    </div>
  );
}
