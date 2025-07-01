import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArticleData, GoogleSheetsConfig } from './types';
import { 
  initializeGapi, 
  initializeGis, 
  authenticateAndExecute, 
  saveArticlesToSheet, 
  loadArticlesFromSheet 
} from './google-sheets';

interface ArticleListProps {
  config: GoogleSheetsConfig;
}

export function ArticleList({ config }: ArticleListProps) {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(window.location.href);
  const [swLogs, setSwLogs] = useState<Array<{ message: string; time: string }>>([]);

  useEffect(() => {
    // Initialize Google APIs
    const initApis = async () => {
      try {
        await Promise.all([
          initializeGapi(config),
          initializeGis(config)
        ]);
      } catch (error) {
        console.error('Failed to initialize Google APIs:', error);
      }
    };
    
    const handleShareTarget = () => {
      console.log('Checking for share target data...');
      const queryParams = new URLSearchParams(window.location.search);
      
      if (queryParams.has('share_target')) {
        console.log('🎯 Share target detected!');
        
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const url = hashParams.get('url');
        const title = hashParams.get('title');
        const text = hashParams.get('text');
        
        console.log('📦 Shared content received:', { title, text, url });
        
        if (url) {
          const newArticle: ArticleData = {
            url,
            title: title || url,
            description: text || '',
            featuredImage: '',
            timestamp: new Date().toISOString(),
            domain: new URL(url).hostname,
            tags: [],
            notes: '',
            archived: false,
            favorite: false,
          };
          
          setArticles(prev => [...prev, newArticle]);
          
          setTimeout(() => {
            history.replaceState(null, '', window.location.pathname);
            updateCurrentUrl();
          }, 3000);
        }
      }
    };
    
    initApis();
    handleShareTarget();
    setupServiceWorkerListeners();
    updateCurrentUrl();
    loadSwLogs();
  }, [config]);


  const setupServiceWorkerListeners = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from SW:', event.data);
        if (event.data?.type === 'SW_LOG') {
          const logs = event.data.args?.map((arg: unknown) => ({
            message: typeof arg === 'string' ? arg : JSON.stringify(arg),
            time: new Date().toISOString(),
          })) || [];
          setSwLogs(prev => [...prev, ...logs]);
        }
      });
    }
  };

  const updateCurrentUrl = () => {
    setCurrentUrl(window.location.href);
  };

  const loadSwLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('swLogs') || '[]');
      setSwLogs(logs);
    } catch {
      setSwLogs([]);
    }
  };

  const clearSwLogs = () => {
    localStorage.removeItem('swLogs');
    setSwLogs([]);
  };

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
      await authenticateAndExecute(() => 
        saveArticlesToSheet(articles, config.SPREADSHEET_ID)
      );
      console.log('Articles saved successfully');
    } catch (error) {
      console.error('Failed to save articles:', error);
      alert(error instanceof Error ? error.message : 'Failed to save articles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async () => {
    setIsLoading(true);
    try {
      await authenticateAndExecute(async () => {
        const loadedArticles = await loadArticlesFromSheet(config.SPREADSHEET_ID);
        setArticles(loadedArticles);
      });
      console.log('Articles loaded successfully');
    } catch (error) {
      console.error('Failed to load articles:', error);
      alert(error instanceof Error ? error.message : 'Failed to load articles');
    } finally {
      setIsLoading(false);
    }
  };

  const testShareTarget = async () => {
    console.log('Testing share target...');
    
    const formData = new FormData();
    formData.append('title', 'Test Share Title');
    formData.append('text', 'This is a test share from the app');
    formData.append('url', 'https://example.com/test');
    
    try {
      const response = await fetch('/', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Test share response:', response);
      
      if (response.redirected) {
        console.log('Redirected to:', response.url);
        window.location.href = response.url;
      } else {
        console.log('No redirect happened - SW might not be working');
      }
    } catch (error) {
      console.error('Test share failed:', error);
    }
  };

  const clearServiceWorker = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log('Unregistering SW:', registration.scope);
        await registration.unregister();
      }
      
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        console.log('Deleting cache:', cacheName);
        await caches.delete(cacheName);
      }
      
      alert('Service worker and caches cleared! Reloading page...');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing SW:', error);
      alert('Error clearing service worker: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">Read It Later v3.1</h1>
      
      <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700 break-all">
        {currentUrl}
      </div>
      
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
          Load from Google Sheets
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={isLoading}
        >
          Save to Google Sheets
        </Button>
        <Button 
          onClick={testShareTarget}
          className="bg-orange-600 hover:bg-orange-700"
        >
          Test Share Target
        </Button>
        <Button 
          onClick={clearServiceWorker}
          variant="destructive"
        >
          Clear Service Worker
        </Button>
      </div>
      
      {swLogs.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Service Worker Logs</h3>
            <Button onClick={clearSwLogs} size="sm" variant="outline">
              Clear Logs
            </Button>
          </div>
          <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-48 overflow-auto">
            {swLogs.map((entry, index) => (
              <div key={index}>
                [{entry.time}] {entry.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}