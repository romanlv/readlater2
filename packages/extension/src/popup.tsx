import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, BookOpen, X } from 'lucide-react';
import type { ArticleData, SaveArticleResponse } from '@readlater/core';
import { extractPageDataFromDocument } from '@readlater/core';

type StatusType = 'success' | 'error' | 'loading' | null;


export default function Popup() {
  const [pageData, setPageData] = useState<ArticleData | null>(null);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({ type: null, message: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getPageData = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: extractPageDataFromDocument
        });
        
        const partialData = result.result;
        if (partialData && partialData.url && partialData.title) {
          setPageData({
            url: partialData.url,
            title: partialData.title,
            description: partialData.description || '',
            featuredImage: partialData.featuredImage || '',
            timestamp: partialData.timestamp || new Date().toISOString(),
            domain: partialData.domain || '',
            tags: partialData.tags || [],
            notes: partialData.notes || '',
            archived: partialData.archived || false,
            favorite: partialData.favorite || false,
          });
        }
      } catch (error) {
        console.error('Error getting page data:', error);
        setStatus({ type: 'error', message: 'Error loading page data' });
      }
    };

    getPageData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pageData) {
      setStatus({ type: 'error', message: 'No page data available' });
      return;
    }
    
    const articleData: ArticleData = {
      ...pageData,
      tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : [],
      notes: notes.trim()
    };
    
    try {
      setStatus({ type: 'loading', message: 'Saving article...' });
      setIsLoading(true);
      
      const response: SaveArticleResponse = await chrome.runtime.sendMessage({
        action: 'saveArticle',
        articleData: articleData
      });
      
      if (response && response.success) {
        setStatus({ type: 'success', message: 'Article saved successfully!' });
        
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        const errorMsg = response?.error || 'Unknown error occurred';
        setStatus({ type: 'error', message: response?.message || `Failed to save: ${errorMsg}` });
      }
    } catch (error) {
      console.error('Error saving article:', error);
      setStatus({ type: 'error', message: 'Failed to save article' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    window.close();
  };

  return (
    <div className="w-[350px] p-4 bg-background text-foreground">
      <div className="flex items-center gap-2 text-lg mb-4">
        <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded text-xs font-bold">
          <BookOpen className="w-3 h-3" />
        </div>
        ReadLater
      </div>
      
      <div className="space-y-4">
          {status.type && (
            <Alert className={
              status.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' :
              status.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' :
              'border-blue-200 bg-blue-50 text-blue-800'
            }>
              <AlertDescription className="text-sm">
                {status.message}
              </AlertDescription>
            </Alert>
          )}
          
          {pageData && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm leading-tight">{pageData.title}</h3>
              <p className="text-xs text-muted-foreground break-all">{pageData.url}</p>
            </div>
          )}
          
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tags" className="text-sm font-medium">
                Tags (comma-separated)
              </Label>
              <Input
                id="tags"
                type="text"
                placeholder="e.g. tech, article, important"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="text-sm"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="Add your notes here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm min-h-[60px] resize-none"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1 text-sm"
                disabled={isLoading}
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 text-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3 h-3 mr-1" />
                    Save Article
                  </>
                )}
              </Button>
            </div>
          </form>
      </div>
    </div>
  );
}