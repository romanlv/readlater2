import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { YouTubePlayer } from '@/components/youtube-player';
import { useArticle, useUpdateArticle, useDeleteArticle } from '@/features/articles/hooks';
import { ArticleEditForm, ArticleFormData } from '@/features/articles/article-edit-form';
import { ArrowLeft, Edit, Star, Archive, ArchiveRestore, Trash2, ExternalLink, X } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { extractYouTubeVideoId } from '@/lib/youtube';
import { decodeArticleUrl } from '@/lib/url-encode';
import { useParams, useNavigate } from 'react-router';
import { ArticleIframePreview } from './article-iframe-preview';

export function ArticlePreviewPage() {
  const { encodedUrl } = useParams<{ encodedUrl: string }>();
  const navigate = useNavigate();
  const articleUrl = encodedUrl ? decodeArticleUrl(encodedUrl) : '';
  const { data: article, isLoading, error } = useArticle(articleUrl);
  const [notes, setNotes] = useState('');
  const updateArticleMutation = useUpdateArticle();
  const deleteArticleMutation = useDeleteArticle();
  const debouncedNotes = useDebounce(notes, 1000);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const videoId = article ? extractYouTubeVideoId(article.url) : null;
  const isYouTube = !!videoId;

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

  const handleNotesBlur = () => {
    if (article && notes !== (article.notes || '')) {
      updateArticleMutation.mutate({
        url: articleUrl,
        updates: { notes, editedAt: Date.now() }
      });
    }
  };

  const handleToggleFavorite = () => {
    if (!article) return;
    updateArticleMutation.mutate({
      url: articleUrl,
      updates: { favorite: !article.favorite, editedAt: Date.now() }
    });
  };

  const handleToggleArchive = () => {
    if (!article) return;
    updateArticleMutation.mutate({
      url: articleUrl,
      updates: { archived: !article.archived, editedAt: Date.now() }
    });
  };

  const handleDelete = () => {
    if (!article) return;
    if (confirm('Are you sure you want to delete this article?')) {
      deleteArticleMutation.mutate(articleUrl);
      navigate(-1);
    }
  };

  const handleSaveEdit = (formData: ArticleFormData) => {
    updateArticleMutation.mutate({
      url: articleUrl,
      updates: {
        title: formData.title,
        description: formData.description,
        notes: formData.notes,
        tags: formData.tags,
        editedAt: Date.now()
      }
    });
    setIsEditDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <div className="text-center py-8">Loading article...</div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 h-8">
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

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top action bar */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-background shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 h-8 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <span className="text-sm font-medium truncate flex-1 min-w-0">
          {article.title}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditDialogOpen(true)}
            className="text-muted-foreground hover:text-foreground p-1 h-8 w-8"
            title="Edit article"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleFavorite}
            className={`p-1 h-8 w-8 ${article.favorite ? 'text-accent hover:text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title={article.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4 h-4 ${article.favorite ? 'fill-current' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleArchive}
            className="text-muted-foreground hover:text-foreground p-1 h-8 w-8"
            title={article.archived ? 'Unarchive article' : 'Archive article'}
          >
            {article.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive/80 p-1 h-8 w-8"
            title="Delete article"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(article.url, '_blank')}
            className="text-muted-foreground hover:text-foreground p-1 h-8 w-8"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isYouTube ? (
        <div className="container max-w-4xl mx-auto p-4 overflow-auto flex-1">
          <div className="space-y-4">
            <YouTubePlayer videoId={videoId!} title={article.title} />

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
      ) : (
        <ArticleIframePreview url={article.url} title={article.title} />
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl h-screen md:h-auto md:max-h-[90vh] p-0 md:p-6 rounded-none md:rounded-lg border-0 md:border">
          <div className="flex items-center justify-between mb-6 px-6 pt-6 md:p-0 md:mb-6">
            <h2 className="text-xl font-semibold text-foreground">Edit Article</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditDialogOpen(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ArticleEditForm
            initialData={{
              url: article.url,
              title: article.title,
              description: article.description || '',
              notes: article.notes || '',
              tags: article.tags || []
            }}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditDialogOpen(false)}
            isLoading={updateArticleMutation.isPending}
            mode="edit"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
