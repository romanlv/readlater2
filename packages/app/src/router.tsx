import { createBrowserRouter, RouterProvider } from 'react-router';
import { ArticleList } from '@/features/articles/article-list';
import { YouTubeVideoPage } from '@/features/articles/youtube-video-page';
import { ShareTargetDisplay } from '@/features/share-target/share-target-display';
import { useAddArticle } from '@/features/articles/hooks';
import { ArticleFormData } from '@/features/articles/article-edit-form';
import { useNavigate, useSearchParams } from 'react-router';
import { useEffect } from 'react';

function ShareTargetRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addArticleMutation = useAddArticle();

  const isShareTarget = searchParams.get('share_target') === '1';

  useEffect(() => {
    if (!isShareTarget) {
      navigate('/', { replace: true });
    }
  }, [isShareTarget, navigate]);

  if (!isShareTarget) {
    return null;
  }

  // Parse hash params
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const sharedData = {
    title: hashParams.get('title') || undefined,
    text: hashParams.get('text') || undefined,
    url: hashParams.get('url') || undefined,
  };
  const error = hashParams.get('error') || undefined;

  console.log('🔍 Share target detected:', { ...sharedData, error });

  if (error) {
    console.error('❌ Share target error:', error);
  }

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
    addArticleMutation.mutate(article);
    navigate('/', { replace: true });
  };

  const handleViewArticles = () => {
    navigate('/', { replace: true });
  };

  return (
    <ShareTargetDisplay
      sharedData={sharedData}
      onSaveArticle={handleSaveSharedArticle}
      onViewArticles={handleViewArticles}
      isLoading={addArticleMutation.isPending}
    />
  );
}

function RootRoute() {
  const [searchParams] = useSearchParams();
  const isShareTarget = searchParams.get('share_target') === '1';

  if (isShareTarget) {
    return <ShareTargetRoute />;
  }

  return <ArticleList />;
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <RootRoute />,
    },
    {
      path: '/article/:encodedUrl',
      element: <YouTubeVideoPage />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  }
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
