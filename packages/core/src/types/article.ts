export interface ArticleData {
  url: string;
  title: string;
  description: string;
  featuredImage: string;
  timestamp: string;
  domain: string;
  tags?: string[];
  notes?: string;
  archived?: boolean;
  favorite?: boolean;
}

export interface SaveArticleMessage {
  action: 'saveArticle';
  articleData: ArticleData;
}

export interface SaveArticleResponse {
  success: boolean;
  message: string;
  error?: string;
}