import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  test('allows adding new articles via + button', async () => {
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

    // Click the + button
    const addButton = await screen.findByTitle('Add new article (Cmd+V)');
    await user.click(addButton);

    // Should show the add dialog
    const urlInput = await screen.findByLabelText('URL') as HTMLInputElement;
    const titleInput = await screen.findByLabelText('Title') as HTMLInputElement;
    expect(urlInput).toBeTruthy();
    expect(titleInput).toBeTruthy();

    // Enter URL and title
    await user.type(urlInput, 'https://example.com/new-article');
    await user.type(titleInput, 'New Article Title');

    const saveButton = screen.getByRole('button', { name: 'Save Article' });
    await user.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/new-article',
      title: 'New Article Title',
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

  test('hides load more button when no more pages', async () => {
    mockedHooks.usePaginatedArticles.mockReturnValue({
      data: { pages: [{ items: mockArticles, hasMore: false }] },
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

    // Load more button should not be visible
    expect(screen.queryByText('Load More')).toBeNull();
  });

  test('shows loading state in load more button', async () => {
    mockedHooks.usePaginatedArticles.mockReturnValue({
      data: { pages: [{ items: mockArticles, hasMore: true }] },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetching: true,
      isLoading: false,
      error: null,
    } as ReturnType<typeof Hooks.usePaginatedArticles>);

    render(
      <TestWrapper>
        <ArticleList />
      </TestWrapper>
    );

    const loadMoreButton = (await screen.findByText('Loading...')) as HTMLButtonElement;
    expect(loadMoreButton).toBeTruthy();
    expect(loadMoreButton.disabled).toBe(true);
  });

  test('handles multiple pages of articles', async () => {
    const page1Articles = [
      { ...mockArticles[0], url: 'https://example.com/1', title: 'Article 1' }
    ];
    const page2Articles = [
      { ...mockArticles[0], url: 'https://example.com/2', title: 'Article 2' }
    ];

    mockedHooks.usePaginatedArticles.mockReturnValue({
      data: {
        pages: [
          { items: page1Articles, hasMore: true },
          { items: page2Articles, hasMore: false }
        ]
      },
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

    // Both articles from different pages should be displayed
    expect(await screen.findByText('Article 1')).toBeTruthy();
    expect(screen.queryByText('Article 2')).toBeTruthy();
    expect(screen.queryByText('2 articles • Offline ready')).toBeTruthy();
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

  describe('Paste shortcut', () => {
    const mockReadText = vi.fn();

    beforeEach(() => {
      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          readText: mockReadText,
        },
        writable: true,
        configurable: true,
      });
      mockReadText.mockClear();
    });

    test('opens add dialog with URL from clipboard when cmd+v is pressed', async () => {
      mockReadText.mockResolvedValue('https://example.com/pasted-url');

      render(
        <TestWrapper>
          <ArticleList />
        </TestWrapper>
      );

      // Press cmd+v (on Mac) - use fireEvent to trigger native keyboard event
      fireEvent.keyDown(window, { key: 'v', metaKey: true });

      // Should show the add dialog with clipboard URL
      const urlInput = await screen.findByLabelText('URL') as HTMLInputElement;
      expect(urlInput).toBeTruthy();

      // Wait for clipboard to be read and dialog to update
      await vi.waitFor(() => {
        expect(urlInput.value).toBe('https://example.com/pasted-url');
      });
    });

    test('opens add dialog with URL from clipboard when ctrl+v is pressed', async () => {
      mockReadText.mockResolvedValue('https://example.com/pasted-url');

      render(
        <TestWrapper>
          <ArticleList />
        </TestWrapper>
      );

      // Press ctrl+v (on Windows/Linux) - use fireEvent to trigger native keyboard event
      fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

      // Should show the add dialog with clipboard URL
      const urlInput = await screen.findByLabelText('URL') as HTMLInputElement;
      expect(urlInput).toBeTruthy();

      // Wait for clipboard to be read and dialog to update
      await vi.waitFor(() => {
        expect(urlInput.value).toBe('https://example.com/pasted-url');
      });
    });

    test('opens add dialog with empty URL when clipboard contains invalid URL', async () => {
      mockReadText.mockResolvedValue('not a valid url');

      render(
        <TestWrapper>
          <ArticleList />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'v', metaKey: true });

      // Should show the add dialog with empty URL
      const urlInput = await screen.findByLabelText('URL') as HTMLInputElement;
      expect(urlInput).toBeTruthy();
      expect(urlInput.value).toBe('');
    });

    test('opens add dialog when clipboard access fails', async () => {
      mockReadText.mockRejectedValue(new Error('Clipboard access denied'));

      render(
        <TestWrapper>
          <ArticleList />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'v', metaKey: true });

      // Should still show the add dialog with empty URL
      const urlInput = await screen.findByLabelText('URL') as HTMLInputElement;
      expect(urlInput).toBeTruthy();
      expect(urlInput.value).toBe('');
    });

    test('does not trigger paste shortcut when typing in input field', async () => {
      mockReadText.mockResolvedValue('https://example.com/pasted-url');

      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ArticleList />
        </TestWrapper>
      );

      // First open the dialog
      const addButton = await screen.findByTitle('Add new article (Cmd+V)');
      await user.click(addButton);

      // Focus on the URL input
      const urlInput = await screen.findByLabelText('URL') as HTMLInputElement;
      await user.click(urlInput);

      // Clear the clipboard mock call count
      mockReadText.mockClear();

      // Press cmd+v while focused on input (should paste normally, not trigger our handler)
      await user.keyboard('{Meta>}v{/Meta}');

      // Clipboard should not be read by our handler
      expect(mockReadText).not.toHaveBeenCalled();
    });

    test('does not trigger paste shortcut when typing in textarea', async () => {
      mockReadText.mockResolvedValue('https://example.com/pasted-url');

      const user = userEvent.setup();
      render(
        <TestWrapper>
          <ArticleList />
        </TestWrapper>
      );

      // First open the dialog
      const addButton = await screen.findByTitle('Add new article (Cmd+V)');
      await user.click(addButton);

      // Focus on the notes textarea
      const notesTextarea = await screen.findByLabelText('Notes') as HTMLTextAreaElement;
      await user.click(notesTextarea);

      // Clear the clipboard mock call count
      mockReadText.mockClear();

      // Press cmd+v while focused on textarea (should paste normally, not trigger our handler)
      await user.keyboard('{Meta>}v{/Meta}');

      // Clipboard should not be read by our handler
      expect(mockReadText).not.toHaveBeenCalled();
    });
  });
});
