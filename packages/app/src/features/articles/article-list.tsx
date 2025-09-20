import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArticleData, GoogleSheetsConfig } from './types';
import { 
  initializeGoogleSheetsSync,
  getAuthProvider,
  loadArticlesFromSheet,
  saveArticlesToSheet,
  AuthenticationRequiredError
} from './google-sheets';
import type { PwaAuthProvider } from '@readlater/google-sheets-sync';

interface ArticleListProps {
  config: GoogleSheetsConfig;
  pendingArticle?: ArticleData | null;
}

export function ArticleList({ config, pendingArticle }: ArticleListProps) {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authProvider, setAuthProvider] = useState<PwaAuthProvider | null>(null);

  useEffect(() => {
    initializeGoogleSheetsSync(config);
    setAuthProvider(getAuthProvider());
  }, [config]);

  const handleLoad = useCallback(async () => {
    if (!authProvider) return;

    console.log('Attempting to load articles...');
    setIsLoading(true);
    try {
      const loadedArticles = await loadArticlesFromSheet(config);
      setArticles(loadedArticles);
      setIsAuthenticated(true);
      console.log('Articles loaded successfully');
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        console.log('Authentication required. Redirecting...');
        authProvider.redirectToAuth();
      } else {
        console.error('Failed to load articles:', error);
        alert(error instanceof Error ? error.message : 'Failed to load articles');
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [config, authProvider]);

  useEffect(() => {
    if (!authProvider) return;

    const checkAuthAndLoad = async () => {
      const handled = await authProvider.handleRedirect();
      if (handled) {
        handleLoad();
      } else {
        const authenticated = await authProvider.isAuthenticated();
        if (authenticated) {
          handleLoad();
        } else {
          setIsLoading(false);
        }
      }
    };

    checkAuthAndLoad();
  }, [authProvider, handleLoad]);

  useEffect(() => {
    if (pendingArticle) {
      setArticles(prev => [pendingArticle, ...prev]);
    }
  }, [pendingArticle]);

  const addArticle = () => {
    const url = urlInput.trim();
    if (!url) return;
    
    const newArticle: ArticleData = {
      url,
      title: url,
      description: '',
      featuredImage: '',
      timestamp: new Date().toISOString(),
      domain: new URL(url).hostname,
      tags: [],
      notes: '',
      archived: false,
      favorite: false,
    };
    
    setArticles(prev => [...prev, newArticle]);
    setUrlInput('');
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await saveArticlesToSheet(articles, config);
      console.log('Articles saved successfully');
    } catch (error) {
      console.error('Failed to save articles:', error);
      alert(error instanceof Error ? error.message : 'Failed to save articles');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSignOut = async () => {
    if (!authProvider) return;
    await authProvider.clearAuthToken();
    setIsAuthenticated(false);
    setArticles([]);
    console.log('User signed out.');
  };

  if (!authProvider) {
    return <div>Initializing...</div>;
  }

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Read It Later 2.0b</h1>
      
      {isLoading ? (
        <p>Loading...</p>
      ) : isAuthenticated ? (
        <>
          <ul className="mb-4 space-y-2">
            {articles.map((article, index) => (
              <li key={index} className="p-3 border-b border-gray-200">
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
              </li>
            ))}
          </ul>
          
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
            >
              Add URL
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              onClick={handleLoad} 
              disabled={isLoading}
              variant="outline"
            >
              Reload Articles
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isLoading}
            >
              Save to Google Sheets
            </Button>
            <Button 
              onClick={handleSignOut}
              variant="destructive"
            >
              Sign Out
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center">
          <p className="mb-4">Please sign in with Google to manage your articles.</p>
          <Button 
            onClick={handleLoad} 
            disabled={isLoading}
          >
            Sign In with Google
          </Button>
        </div>
      )}
    </div>
  );
}