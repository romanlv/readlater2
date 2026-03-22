import { useState, useEffect, useDeferredValue } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArticleEditForm, ArticleFormData } from './article-edit-form';
import { usePaginatedArticles, useSearchArticles, useAddArticle, useUpdateArticle, useDeleteArticle, useRestoreArticle } from './hooks';
import { Article } from '@/lib/db';
import { SyncStatus } from '@/features/sync/sync-status';
import { config } from '@/config';
import { Edit, Star, Archive, ArchiveRestore, Trash2, Smartphone, RotateCcw, Plus, X, Search, Eye, ExternalLink } from 'lucide-react';
import { ArticleFilters } from './repository';
import { TopBarMenu } from '@/components/top-bar-menu';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { extractYouTubeVideoId } from '@/lib/youtube';
import { encodeArticleUrl } from '@/lib/url-encode';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { cleanUrl, isValidUrl } from '@/lib/url-cleaner';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useSettings } from '@/features/settings/use-settings';

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


export function ArticleList() {
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newArticleData, setNewArticleData] = useState<Partial<ArticleFormData> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isSearching = deferredSearchQuery.trim().length > 0;
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();

  // Convert URL search params to ArticleFilters
  const getFilters = (): ArticleFilters => {
    const filter = searchParams.get('filter') || 'active';
    const tag = searchParams.get('tag');

    if (filter === 'tag' && tag) {
      return { tags: [tag] };
    }

    switch (filter) {
      case 'active':
        return { archived: false };
      case 'archived':
        return { archived: true };
      case 'favorites':
        return { favorite: true };
      case 'deleted':
        return { includeDeleted: true };
      default:
        return {};
    }
  };

  // Use React Query hooks for IndexedDB
  const { data, fetchNextPage, hasNextPage, isFetching, isLoading, error } = usePaginatedArticles(getFilters());
  const searchResults = useSearchArticles(deferredSearchQuery);
  const addArticleMutation = useAddArticle();
  const updateArticleMutation = useUpdateArticle();
  const deleteArticleMutation = useDeleteArticle();
  const restoreArticleMutation = useRestoreArticle();

  // Flatten paginated results and filter based on current view
  const allArticles = data?.pages.flatMap(page => page.items) || [];
  const isDeletedView = searchParams.get('filter') === 'deleted';
  const filteredArticles = isDeletedView
    ? allArticles.filter(article => !!article.deletedAt)
    : allArticles.filter(article => !article.deletedAt);

  const searchArticles = searchResults.data?.pages.flatMap(page => page.items) || [];
  const articles = isSearching ? searchArticles : filteredArticles;




  const openAddDialog = (url?: string) => {
    const trimmedUrl = url?.trim() || '';
    // Clean URL to remove tracking parameters
    const urlToAdd = trimmedUrl && isValidUrl(trimmedUrl) ? cleanUrl(trimmedUrl) : trimmedUrl;

    setNewArticleData({
      url: urlToAdd,
      title: urlToAdd, // Default to URL, user can edit
      description: '',
      notes: '',
      tags: []
    });
    setIsAddingNew(true);
  };

  // Handle paste shortcut (cmd+v on Mac, ctrl+v on Windows/Linux)
  useEffect(() => {
    const handlePaste = async (e: KeyboardEvent) => {
      // Check if cmd+v (Mac) or ctrl+v (Windows/Linux) is pressed
      const isModifierPressed = e.metaKey || e.ctrlKey;

      if (isModifierPressed && e.key === 'v') {
        // Don't interfere if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        // Prevent default paste behavior
        e.preventDefault();

        try {
          // Read from clipboard
          const text = await navigator.clipboard.readText();
          const trimmedText = text.trim();

          // If clipboard contains a URL, open dialog with it
          if (trimmedText) {
            try {
              new URL(trimmedText);
              openAddDialog(trimmedText);
            } catch {
              // If not a valid URL, just open the dialog empty
              openAddDialog();
            }
          } else {
            openAddDialog();
          }
        } catch (error) {
          console.error('Failed to read clipboard:', error);
          // If clipboard access fails, just open the dialog
          openAddDialog();
        }
      }
    };

    window.addEventListener('keydown', handlePaste);
    return () => window.removeEventListener('keydown', handlePaste);
  }, []);

  const loadMore = () => {
    if (isSearching) {
      if (searchResults.hasNextPage && !searchResults.isFetching) {
        searchResults.fetchNextPage();
      }
    } else if (hasNextPage && !isFetching) {
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
    // Clean URL one more time before saving to ensure no tracking params
    const cleanedUrl = cleanUrl(formData.url);

    const article = {
      url: cleanedUrl,
      title: formData.title,
      description: formData.description,
      featuredImage: '',
      timestamp: Date.now(),
      domain: new URL(cleanedUrl).hostname,
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
    if (videoId || settings.openInPreview) {
      e.preventDefault();
      const encodedUrl = encodeArticleUrl(article.url);
      navigate(`/article/${encodedUrl}`);
    }
  };

  const handleOpenPreview = (article: Article) => {
    const encodedUrl = encodeArticleUrl(article.url);
    navigate(`/article/${encodedUrl}`);
  };

  if (error) {
    return (
      <div className="p-4 min-h-screen bg-background text-foreground">
        <div className="text-destructive text-center mt-8">
          Error loading articles: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 min-h-screen bg-background text-foreground">
      <div className="flex items-center gap-2 mb-4">
        <SidebarTrigger />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => openAddDialog()}
          className="h-8 w-8 p-0"
          title="Add new article (Cmd+V)"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <TopBarMenu />
        <ThemeSwitcher />
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
              {isSearching
                ? `${articles.length} result${articles.length !== 1 ? 's' : ''}`
                : `${articles.length} articles • Offline ready`}
            </div>
            <SyncStatus config={config} isOnline={isOnline} />
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
                            {settings.openInPreview ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(article.url, '_blank')}
                                className="text-muted-foreground hover:text-foreground p-1 h-8 w-8"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenPreview(article)}
                                className="text-muted-foreground hover:text-foreground p-1 h-8 w-8"
                                title="Open in preview"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
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

          {(isSearching ? searchResults.hasNextPage : hasNextPage) && (
            <div className="text-center mb-4">
              <Button
                onClick={loadMore}
                disabled={isSearching ? searchResults.isFetching : isFetching}
                variant="outline"
              >
                {(isSearching ? searchResults.isFetching : isFetching) ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
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
        <DialogContent className="max-w-2xl h-screen md:h-auto md:max-h-[90vh] p-0 md:p-6 rounded-none md:rounded-lg border-0 md:border">
          <div className="flex items-center justify-between mb-6 px-6 pt-6 md:p-0 md:mb-6">
            <h2 className="text-xl font-semibold text-foreground">Save Article</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingNew(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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

      {/* Footer */}
      <footer className="mt-8 pt-6 pb-4 border-t border-border">
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <a
              href="https://github.com/romanlv/readlater2"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
          <p>Privacy-first link saving. Your data, your control.</p>
        </div>
      </footer>
    </div>
  );
}