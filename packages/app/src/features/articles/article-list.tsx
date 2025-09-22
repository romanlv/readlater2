import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArticleEditForm, ArticleFormData } from './article-edit-form';
import { usePaginatedArticles, useAddArticle, useUpdateArticle, useDeleteArticle } from './hooks';
import { Article } from '@/lib/db';
import { Edit, Star, Archive, ArchiveRestore, Trash2, Smartphone, CheckCircle } from 'lucide-react';

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
  const [urlInput, setUrlInput] = useState('');
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newArticleData, setNewArticleData] = useState<Partial<ArticleFormData> | null>(null);
  const isOnline = useOnlineStatus();

  // Use React Query hooks for IndexedDB
  const { data, fetchNextPage, hasNextPage, isFetching, isLoading, error } = usePaginatedArticles();
  const addArticleMutation = useAddArticle();
  const updateArticleMutation = useUpdateArticle();
  const deleteArticleMutation = useDeleteArticle();

  // Flatten paginated results
  const articles = data?.pages.flatMap(page => page.items) || [];

  // Count pending sync items
  const pendingSyncCount = articles.filter(article => article.syncStatus === 'pending').length;



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

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-center mb-4">Read It Later 2.0b</h1>
        <div className="text-red-600 text-center">
          Error loading articles: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Read It Later 2.0b</h1>

      {!isOnline && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
          <div className="text-orange-800 text-sm flex items-center gap-2">
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
            <div className="text-gray-600">
              {articles.length} articles • Offline ready
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  Offline
                </span>
              )}
              {pendingSyncCount > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {pendingSyncCount} pending sync
                </span>
              )}
              {isOnline && pendingSyncCount === 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Synced
                </span>
              )}
            </div>
          </div>

          <ul className="mb-4 space-y-2">
            {articles.map((article) => (
              <li key={article.url} className="p-3 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {article.title}
                    </a>
                    {article.description && (
                      <p className="text-sm text-gray-600 mt-1">{article.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{article.domain}</span>
                      <span>•</span>
                      <span>{new Date(article.timestamp).toLocaleDateString()}</span>
                      {article.syncStatus === 'pending' && (
                        <>
                          <span>•</span>
                          <span className="text-orange-500">Pending sync</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(article)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Edit article"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleFavorite(article.url, article.favorite)}
                      className={article.favorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-gray-600'}
                      title={article.favorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={`w-4 h-4 ${article.favorite ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleArchive(article.url, article.archived)}
                      className="text-gray-400"
                      title={article.archived ? "Unarchive article" : "Archive article"}
                    >
                      {article.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(article.url)}
                      className="text-red-400 hover:text-red-600"
                      title="Delete article"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && addArticle()}
            />
            <Button
              onClick={addArticle}
              className="bg-green-600 hover:bg-green-700 rounded-l-none"
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