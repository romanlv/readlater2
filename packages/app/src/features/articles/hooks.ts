import { useInfiniteQuery, useMutation, useQueryClient, useQuery, InfiniteData } from '@tanstack/react-query';
import { articleRepository, ArticleFilters, PaginationCursor } from './repository.js';
import { Article, PaginatedResult } from '../../lib/db.js';

// Paginated articles with automatic infinite scroll
export function usePaginatedArticles(filters?: ArticleFilters) {
  return useInfiniteQuery({
    queryKey: ['articles', filters],
    queryFn: ({ pageParam }) =>
      articleRepository.getPaginated(filters, { cursor: pageParam, limit: 50 }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as PaginationCursor | undefined,
  });
}

// Search with automatic relevance scoring
export function useSearchArticles(query: string) {
  return useInfiniteQuery({
    queryKey: ['articles', 'search', query],
    queryFn: ({ pageParam }) =>
      articleRepository.searchPaginated(query, { cursor: pageParam, limit: 30 }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as PaginationCursor | undefined,
    enabled: !!query.trim(),
  });
}

// Individual article
export function useArticle(url: string) {
  return useQuery({
    queryKey: ['articles', url],
    queryFn: () => articleRepository.getByUrl(url),
    enabled: !!url,
  });
}

// Mutations with optimistic updates
export function useAddArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (article: Article) => articleRepository.save(article),
    onMutate: async (newArticle) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['articles'] });

      // Snapshot the previous value
      const previousArticles = queryClient.getQueryData(['articles']);

      // Optimistically update
      queryClient.setQueryData(['articles'], (old: InfiniteData<PaginatedResult<Article>> | undefined) => {
        if (!old?.pages?.[0]) return old;

        const optimisticArticle = {
          ...newArticle,
          syncStatus: 'pending' as const,
          editedAt: Date.now()
        };

        return {
          ...old,
          pages: [
            {
              ...old.pages[0],
              items: [optimisticArticle, ...old.pages[0].items]
            },
            ...old.pages.slice(1)
          ]
        };
      });

      return { previousArticles };
    },
    onError: (_err, _newArticle, context) => {
      // Rollback on error
      queryClient.setQueryData(['articles'], context?.previousArticles);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, updates }: { url: string; updates: Partial<Article> }) =>
      articleRepository.update(url, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => articleRepository.delete(url),
    onMutate: async (url) => {
      await queryClient.cancelQueries({ queryKey: ['articles'] });

      // Remove from all lists
      queryClient.setQueriesData({ queryKey: ['articles'] }, (old: InfiniteData<PaginatedResult<Article>> | undefined) => {
        if (!old?.pages) return old;

        return {
          ...old,
          pages: old.pages.map((page: PaginatedResult<Article>) => ({
            ...page,
            items: page.items.filter((article: Article) => article.url !== url)
          }))
        };
      });

      // Remove individual article cache
      queryClient.removeQueries({ queryKey: ['articles', url] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useRestoreArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => articleRepository.restore(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}