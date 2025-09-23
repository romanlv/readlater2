import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArticleList } from './article-list';
import * as Hooks from './hooks';
import { Article } from '@/lib/db';

// Mock the hooks module
vi.mock('./hooks', () => ({
  usePaginatedArticles: vi.fn(),
  useAddArticle: vi.fn(),
  useUpdateArticle: vi.fn(),
  useDeleteArticle: vi.fn(),
}));

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Test wrapper with QueryClient
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockArticles: Article[] = [
  {
    url: 'https://example.com',
    title: 'Test Article',
    description: 'Test description',
    featuredImage: '',
    timestamp: Date.now(),
    domain: 'example.com',
    tags: [],
    notes: '',
    archived: false,
    favorite: false,
    syncStatus: 'synced',
  },
];

describe('ArticleList', () => {
  const mockedHooks = vi.mocked(Hooks);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockedHooks.usePaginatedArticles.mockReturnValue({
      data: { pages: [{ items: mockArticles, hasMore: false }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isLoading: false,
      error: null,
    } as ReturnType<typeof Hooks.usePaginatedArticles>);

    mockedHooks.useAddArticle.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as ReturnType<typeof Hooks.useAddArticle>);

    mockedHooks.useUpdateArticle.mockReturnValue({
      mutate: vi.fn(),
    } as ReturnType<typeof Hooks.useUpdateArticle>);

    mockedHooks.useDeleteArticle.mockReturnValue({
      mutate: vi.fn(),
    } as ReturnType<typeof Hooks.useDeleteArticle>);
  });

  test('displays articles from IndexedDB', async () => {
    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    expect(await screen.findByText('Test Article')).not.toBeNull();
    expect(screen.getByText('1 articles • Offline ready')).not.toBeNull();
  });

  test('shows offline indicator when offline', async () => {
    // Mock navigator.onLine to be false
    Object.defineProperty(navigator, 'onLine', { value: false });

    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    expect(await screen.findByText('Offline')).not.toBeNull();
    expect(screen.getByText('Offline mode:')).not.toBeNull();
  });

  test('allows adding new articles', async () => {
    const mockMutate = vi.fn();
    mockedHooks.useAddArticle.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof Hooks.useAddArticle>);

    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Enter URL');
    const addButton = screen.getByText('Add URL');

    await user.type(input, 'https://example.com/new-article');
    await user.click(addButton);

    // Should now show the confirmation dialog
    const saveButton = await screen.findByRole('button', { name: 'Save Article' });
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/new-article');

    // Click save to actually add the article
    await user.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/new-article',
      title: 'https://example.com/new-article',
      syncStatus: 'pending',
    }));
  });

  test('shows pending sync status', async () => {
    const articlesWithPending = [
      { ...mockArticles[0], syncStatus: 'pending' as const },
    ];

    mockedHooks.usePaginatedArticles.mockReturnValue({
      data: { pages: [{ items: articlesWithPending, hasMore: false }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isLoading: false,
      error: null,
    } as ReturnType<typeof Hooks.usePaginatedArticles>);

    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    expect(await screen.findByText('1 pending sync')).not.toBeNull();
    expect(screen.getByText('Pending sync')).not.toBeNull();
  });

  test('handles load more functionality', async () => {
    const mockFetchNextPage = vi.fn();
    mockedHooks.usePaginatedArticles.mockReturnValue({
      data: { pages: [{ items: mockArticles, hasMore: true }] },
      fetchNextPage: mockFetchNextPage,
      hasNextPage: true,
      isFetching: false,
      isLoading: false,
      error: null,
    } as ReturnType<typeof Hooks.usePaginatedArticles>);

    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    const loadMoreButton = await screen.findByText('Load More');
    await user.click(loadMoreButton);

    expect(mockFetchNextPage).toHaveBeenCalled();
  });

  test('handles favorite button click', async () => {
    const mockUpdateMutate = vi.fn();
    mockedHooks.useUpdateArticle.mockReturnValue({
      mutate: mockUpdateMutate,
    } as ReturnType<typeof Hooks.useUpdateArticle>);

    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    // Find the favorite button by title
    const favoriteButton = await screen.findByTitle('Add to favorites');
    await user.click(favoriteButton);

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      url: 'https://example.com',
      updates: { favorite: true },
    });
  });

  test('handles archive button click', async () => {
    const mockUpdateMutate = vi.fn();
    mockedHooks.useUpdateArticle.mockReturnValue({
      mutate: mockUpdateMutate,
    } as ReturnType<typeof Hooks.useUpdateArticle>);

    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    // Find the archive button by title
    const archiveButton = await screen.findByTitle('Archive article');
    await user.click(archiveButton);

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      url: 'https://example.com',
      updates: { archived: true },
    });
  });
});
