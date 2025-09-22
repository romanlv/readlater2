import { useState, useEffect } from "react"
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ArticleList } from "@/features/articles/article-list"
import { ShareTargetDisplay } from "@/features/share-target/share-target-display"
import { useAddArticle } from "@/features/articles/hooks"
import { ArticleFormData } from "@/features/articles/article-edit-form"
import PWABadge from "./PWABadge"
import { DebugPanel } from "@/components/debug-panel"
import { queryClient } from "@/lib/query-client"

interface SharedData {
  title?: string;
  text?: string;
  url?: string;
}

function AppContent() {
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [showShareTarget, setShowShareTarget] = useState(false);
  const addArticleMutation = useAddArticle();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isShareTarget = urlParams.get('share_target') === '1';

    if (isShareTarget) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const title = hashParams.get('title') || undefined;
      const text = hashParams.get('text') || undefined;
      const url = hashParams.get('url') || undefined;
      const error = hashParams.get('error') || undefined;

      console.log('🔍 Share target detected:', { title, text, url, error });

      if (error) {
        console.error('❌ Share target error:', error);
      }

      setSharedData({ title, text, url });
      setShowShareTarget(true);
    }
  }, []);

  const handleSaveSharedArticle = (formData: ArticleFormData) => {
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

    console.log('✅ Saving shared article with form data via mutation');

    // Save article directly using React Query mutation
    addArticleMutation.mutate(article);
    setShowShareTarget(false);
    setSharedData(null);
    // Clear the URL params to show normal article list
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleViewArticles = () => {
    setShowShareTarget(false);
    setSharedData(null);
    // Clear the URL params to show normal article list
    window.history.replaceState({}, '', window.location.pathname);
  };

  if (showShareTarget) {
    return (
      <>
        <ShareTargetDisplay
          sharedData={sharedData}
          onSaveArticle={handleSaveSharedArticle}
          onViewArticles={handleViewArticles}
          isLoading={addArticleMutation.isPending}
        />
        <PWABadge />
        <DebugPanel />
        <ReactQueryDevtools initialIsOpen={false} />
      </>
    );
  }

  return (
    <>
      <ArticleList />
      <PWABadge />
      <DebugPanel />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App