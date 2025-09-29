import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticleList } from './article-list';
import * as Hooks from './hooks';
import * as SyncHook from './use-sync';
import { Article } from '@/lib/db';
import { TestWrapper } from '@/lib/test-utils';

// Mock the hooks module
vi.mock('./hooks', () => ({
  usePaginatedArticles: vi.fn(),
  useAddArticle: vi.fn(),
  useUpdateArticle: vi.fn(),
  useDeleteArticle: vi.fn(),
  useRestoreArticle: vi.fn(),
}));

// Mock the sync hook
vi.mock('./use-sync', () => ({
  useSync: vi.fn(),
}));

// Mock the repository
vi.mock('./repository', () => ({
  articleRepository: {
    getPendingArticlesCount: vi.fn().mockResolvedValue(0),
    // Add other methods that might be used
    getAllPaginated: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock config
vi.mock('@/config', () => ({
  config: {
    CLIENT_ID: 'test-client-id',
    API_KEY: 'test-api-key',
    SPREADSHEET_ID: 'test-spreadsheet-id',
  }
}));


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
  const mockedSyncHook = vi.mocked(SyncHook);

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
    (mockedHooks as typeof Hooks).useRestoreArticle.mockReturnValue({
      mutate: vi.fn(),
    } as ReturnType<typeof Hooks.useRestoreArticle>);

    // Default sync hook mock
    mockedSyncHook.useSync.mockReturnValue({
      syncState: { pendingCount: 0, status: 'idle', lastSyncTime: null, error: null },
      syncNow: vi.fn(),
      authenticate: vi.fn(),
      isSyncing: false,
      canSync: true,
      needsAuth: false,
      lastSyncError: null,
    } as ReturnType<typeof SyncHook.useSync>);
  });

  test('displays articles from IndexedDB', async () => {
    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    expect(await screen.findByText('Test Article')).toBeTruthy();
    expect(screen.queryByText('1 articles • Offline ready')).toBeTruthy();
  });

  test('shows offline indicator when offline', async () => {
    // Mock navigator.onLine to be false
    Object.defineProperty(navigator, 'onLine', { value: false });

    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    expect(await screen.findByText('Offline')).toBeTruthy();
    expect(screen.queryByText('Offline mode:')).toBeTruthy();
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

    const input = screen.queryByPlaceholderText('Enter URL') as HTMLInputElement;
    const addButton = screen.queryByText('Add URL');
    expect(input).toBeTruthy();
    expect(addButton).toBeTruthy();

    await user.type(input, 'https://example.com/new-article');
    await user.click(addButton!);

    // Should now show the confirmation dialog
    const saveButton = await screen.findByRole('button', { name: 'Save Article' });
    const urlInput = screen.queryByLabelText('URL') as HTMLInputElement;
    expect(urlInput).toBeTruthy();
    expect(urlInput.value).toBe('https://example.com/new-article');

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

    // Mock sync state to show pending items
    mockedSyncHook.useSync.mockReturnValue({
      syncState: { pendingCount: 1, status: 'idle', lastSyncTime: null, error: null },
      syncNow: vi.fn(),
      authenticate: vi.fn(),
      isSyncing: false,
      canSync: true,
      needsAuth: false,
      lastSyncError: null,
    } as ReturnType<typeof SyncHook.useSync>);

    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    // Check for the individual article's pending sync status (small dot)
    expect(screen.getByTitle('Pending sync')).toBeTruthy();
    // Check that the article list shows the article
    expect(await screen.findByText('Test Article')).toBeTruthy();
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
