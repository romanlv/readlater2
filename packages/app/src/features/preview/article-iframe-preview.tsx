import { ExternalLink } from 'lucide-react';

interface ArticleIframePreviewProps {
  url: string;
  title: string;
}

export function ArticleIframePreview({ url, title }: ArticleIframePreviewProps) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <iframe
        src={url}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        className="flex-1 w-full border-0"
      />
      <div className="flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground border-t border-border bg-background">
        <span>Page not loading?</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-foreground hover:underline"
        >
          Open in new tab
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
