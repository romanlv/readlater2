import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArticleEditForm, ArticleFormData } from './article-edit-form';
import { usePaginatedArticles, useAddArticle, useUpdateArticle, useDeleteArticle, useRestoreArticle } from './hooks';
import { Article } from '@/lib/db';
import { SyncStatus } from './sync-status';
import { config } from '@/config';
import { Edit, Star, Archive, ArchiveRestore, Trash2, Smartphone, Filter, RotateCcw } from 'lucide-react';
import { ArticleFilters } from './repository';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { ExtensionDownloadLink } from '@/components/extension-download-link';
import { extractYouTubeVideoId } from '@/lib/youtube';
import { encodeArticleUrl } from '@/lib/url-encode';
import { useNavigate } from 'react-router';

// Hook to track online/offline status
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}


type FilterType = 'all' | 'active' | 'archived' | 'deleted';

export function ArticleList() {
  const [urlInput, setUrlInput] = useState('');
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newArticleData, setNewArticleData] = useState<Partial<ArticleFormData> | null>(null);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('active');
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();

  // Convert filter type to ArticleFilters
  const getFilters = (): ArticleFilters => {
    switch (currentFilter) {
      case 'active':
        return { archived: false };
      case 'archived':
        return { archived: true };
      case 'deleted':
        return { includeDeleted: true };
      default:
        return {};
    }
  };

  // Use React Query hooks for IndexedDB
  const { data, fetchNextPage, hasNextPage, isFetching, isLoading, error } = usePaginatedArticles(getFilters());
  const addArticleMutation = useAddArticle();
  const updateArticleMutation = useUpdateArticle();
  const deleteArticleMutation = useDeleteArticle();
  const restoreArticleMutation = useRestoreArticle();

  // Flatten paginated results and filter based on current view
  const allArticles = data?.pages.flatMap(page => page.items) || [];
  const articles = currentFilter === 'deleted'
    ? allArticles.filter(article => !!article.deletedAt)
    : allArticles.filter(article => !article.deletedAt);




  const addArticle = () => {
    const url = urlInput.trim();
    if (!url) return;

    try {
      // Validate URL
      new URL(url);

      // Show confirmation form instead of directly adding
      setNewArticleData({
        url,
        title: url, // Default to URL, user can edit
        description: '',
        notes: '',
        tags: []
      });
      setIsAddingNew(true);
      setUrlInput('');
    } catch (error) {
      console.error('Invalid URL:', error);
      alert('Please enter a valid URL');
    }
  };

  const loadMore = () => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  };

  const handleToggleArchive = (url: string, archived: boolean) => {
    updateArticleMutation.mutate({ url, updates: { archived: !archived } });
  };

  const handleToggleFavorite = (url: string, favorite: boolean) => {
    updateArticleMutation.mutate({ url, updates: { favorite: !favorite } });
  };

  const handleDelete = (url: string) => {
    if (confirm('Are you sure you want to delete this article?')) {
      deleteArticleMutation.mutate(url);
    }
  };

  const handleRestore = (url: string) => {
    if (confirm('Are you sure you want to restore this article?')) {
      restoreArticleMutation.mutate(url);
    }
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = (formData: ArticleFormData) => {
    if (!editingArticle) return;

    const updates = {
      title: formData.title,
      description: formData.description,
      notes: formData.notes,
      tags: formData.tags,
      editedAt: Date.now()
    };

    updateArticleMutation.mutate({ url: editingArticle.url, updates });
    setIsEditDialogOpen(false);
    setEditingArticle(null);
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingArticle(null);
  };

  const handleSaveNewArticle = (formData: ArticleFormData) => {
    const article = {
      url: formData.url,
      title: formData.title,
      description: formData.description,
      featuredImage: '',
      timestamp: Date.now(),
      domain: new URL(formData.url).hostname,
      tags: formData.tags,
      notes: formData.notes,
      archived: false,
      favorite: false,
      syncStatus: 'pending' as const
    };

    addArticleMutation.mutate(article);
    setIsAddingNew(false);
    setNewArticleData(null);
  };

  const handleCancelNewArticle = () => {
    setIsAddingNew(false);
    setNewArticleData(null);
  };

  const handleArticleClick = (e: React.MouseEvent<HTMLAnchorElement>, article: Article) => {
    const videoId = extractYouTubeVideoId(article.url);
    if (videoId) {
      e.preventDefault();
      const encodedUrl = encodeArticleUrl(article.url);
      navigate(`/article/${encodedUrl}`);
    }
  };

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4 min-h-screen bg-background text-foreground">
        <h1 className="text-2xl font-bold text-center mb-4">Read It Later 2</h1>
        <div className="text-destructive text-center">
          Error loading articles: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1" />
        <h1 className="text-2xl font-bold">Read It Later 2</h1>
        <div className="flex-1 flex justify-end items-center gap-2">
          <ExtensionDownloadLink />
          <ThemeSwitcher />
        </div>
      </div>

      {!isOnline && (
        <div className="mb-4 p-3 bg-accent/20 border border-accent/30 rounded-md">
          <div className="text-accent-foreground text-sm flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span><strong>Offline mode:</strong> All changes are saved locally and will sync when you're back online.</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <p>Loading articles...</p>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              {articles.length} articles • Offline ready
            </div>
            <SyncStatus config={config} isOnline={isOnline} />
          </div>

          {/* Filter Bar */}
          <div className="mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={currentFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setCurrentFilter('all')}
                className="text-xs h-8"
              >
                All
              </Button>
              <Button
                size="sm"
                variant={currentFilter === 'active' ? 'default' : 'outline'}
                onClick={() => setCurrentFilter('active')}
                className="text-xs h-8"
              >
                Active
              </Button>
              <Button
                size="sm"
                variant={currentFilter === 'archived' ? 'default' : 'outline'}
                onClick={() => setCurrentFilter('archived')}
                className="text-xs h-8"
              >
                Archived
              </Button>
              <Button
                size="sm"
                variant={currentFilter === 'deleted' ? 'default' : 'outline'}
                onClick={() => setCurrentFilter('deleted')}
                className="text-xs h-8"
              >
                Deleted
              </Button>
            </div>
          </div>

          <ul className="mb-4 space-y-2">
            {articles.map((article) => (
              <li key={article.url} className="py-3 border-b border-border">
                <div className="flex flex-col">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:underline font-medium break-words"
                    onClick={(e) => handleArticleClick(e, article)}
                  >
                    {article.title}
                  </a>
                    {article.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{article.domain}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <span>{new Date(article.timestamp).toISOString().split('T')[0]}</span>
                          {article.syncStatus === 'pending' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" title="Pending sync" />
                          )}
                        </div>
                        {article.deletedAt && (
                          <>
                            <span>•</span>
                            <span className="text-destructive">Deleted</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {article.deletedAt ? (
                          // Actions for deleted articles
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRestore(article.url)}
                              className="text-green-600 hover:text-green-700 p-1 h-8 w-8"
                              title="Restore article"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          // Actions for regular articles
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(article)}
                              className="text-muted-foreground hover:text-foreground p-1 h-8 w-8"
                              title="Edit article"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleFavorite(article.url, article.favorite)}
                              className={`p-1 h-8 w-8 ${article.favorite ? 'text-accent hover:text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                              title={article.favorite ? "Remove from favorites" : "Add to favorites"}
                            >
                              <Star className={`w-4 h-4 ${article.favorite ? 'fill-current' : ''}`} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleArchive(article.url, article.archived)}
                              className="text-muted-foreground hover:text-foreground p-1 h-8 w-8"
                              title={article.archived ? "Unarchive article" : "Archive article"}
                            >
                              {article.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(article.url)}
                              className="text-destructive hover:text-destructive/80 p-1 h-8 w-8"
                              title="Delete article"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                </div>
              </li>
            ))}
          </ul>

          {hasNextPage && (
            <div className="text-center mb-4">
              <Button
                onClick={loadMore}
                disabled={isFetching}
                variant="outline"
              >
                {isFetching ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter URL"
              className="flex-1 px-3 py-2 border border-input rounded-l-md focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
              onKeyDown={(e) => e.key === 'Enter' && addArticle()}
            />
            <Button
              onClick={addArticle}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-l-none"
              disabled={addArticleMutation.isPending}
              title={!isOnline ? 'Article will be saved locally and synced when online' : ''}
            >
              {addArticleMutation.isPending ? 'Adding...' : 'Add URL'}
            </Button>
          </div>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {editingArticle && (
            <ArticleEditForm
              initialData={{
                url: editingArticle.url,
                title: editingArticle.title,
                description: editingArticle.description || '',
                notes: editingArticle.notes || '',
                tags: editingArticle.tags || []
              }}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              isLoading={updateArticleMutation.isPending}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Article Confirmation Dialog */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {newArticleData && (
            <ArticleEditForm
              initialData={newArticleData}
              onSave={handleSaveNewArticle}
              onCancel={handleCancelNewArticle}
              isLoading={addArticleMutation.isPending}
              mode="create"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}