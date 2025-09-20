import { useState, useEffect } from "react"
import { ArticleList } from "@/features/articles/article-list"
import { config } from "./config"
import { ShareTargetDisplay } from "@/features/share-target/share-target-display"
import { ArticleData } from "@/features/articles/types"
import PWABadge from "./PWABadge"
import { DebugPanel } from "@/components/debug-panel"

interface SharedData {
  title?: string;
  text?: string;
  url?: string;
}

function App() {
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [showShareTarget, setShowShareTarget] = useState(false);
  const [pendingArticle, setPendingArticle] = useState<ArticleData | null>(null);

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

  const handleSaveSharedArticle = () => {
    if (!sharedData?.url) return;

    const articleData: ArticleData = {
      url: sharedData.url,
      title: sharedData.title || sharedData.url,
      description: sharedData.text || '',
      featuredImage: '',
      timestamp: new Date().toISOString(),
      domain: new URL(sharedData.url).hostname,
      tags: [],
      notes: '',
      archived: false,
      favorite: false,
    };

    console.log('✅ Shared article saved to local state');

    // Set as pending article to show in list
    setPendingArticle(articleData);
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
        />
        <PWABadge />
        <DebugPanel />
      </>
    );
  }

  return (
    <>
      <ArticleList config={config} pendingArticle={pendingArticle} />
      <PWABadge />
      <DebugPanel />
    </>
  );
}

export default App