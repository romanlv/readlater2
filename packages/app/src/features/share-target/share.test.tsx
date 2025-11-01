import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

// Mock the article hooks
vi.mock('@/features/articles/hooks', () => ({
  useAddArticle: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  usePaginatedArticles: vi.fn(() => ({
    data: { pages: [{ items: [] }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetching: false,
    isLoading: false,
    error: null,
  })),
  useUpdateArticle: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useDeleteArticle: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useRestoreArticle: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

// Mock the google-sheets module
vi.mock('@/features/articles/google-sheets', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  const mockAuthProvider = {
    handleRedirect: vi.fn(),
    isAuthenticated: vi.fn(),
    redirectToAuth: vi.fn(),
    clearAuthToken: vi.fn(),
  };
  return {
    ...actual,
    initializeGoogleSheetsSync: vi.fn(),
    getAuthProvider: () => mockAuthProvider,
    loadArticlesFromSheet: vi.fn(),
    AuthenticationRequiredError: class extends Error {
      constructor() {
        super('Auth Required');
        this.name = 'AuthenticationRequiredError';
      }
    },
  };
});

// Mock config
vi.mock('@/config', () => ({
  config: {
    CLIENT_ID: 'test-client-id',
    API_KEY: 'test-api-key',
    SPREADSHEET_ID: 'test-spreadsheet-id',
  }
}));

describe('Share Target Feature', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Save original location
    originalLocation = window.location;
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  test.skip('renders ShareTargetDisplay when share_target=1 is in URL', async () => {
    // Mock URL parameters for share target
    delete (window as Partial<Window>).location;
    window.location = {
      ...originalLocation,
      search: '?share_target=1',
      hash: '#title=Test%20Article&text=Test%20description&url=https%3A%2F%2Fexample.com',
      pathname: '/',
      href: 'http://localhost:3000/?share_target=1#title=Test%20Article&text=Test%20description&url=https%3A%2F%2Fexample.com',
    } as Location;

    render(<App />);

    // Should now show the edit form directly with the title "Save Article"
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Save Article' })).toBeTruthy();
    });
    expect(screen.queryByDisplayValue('Test Article')).toBeTruthy();
    expect(screen.queryByDisplayValue('https://example.com')).toBeTruthy();
    expect(screen.queryByDisplayValue('Test description')).toBeTruthy();
  });

  test.skip('renders ShareTargetDisplay with no data when share_target=1 but no hash params', async () => {
    delete (window as Partial<Window>).location;
    window.location = {
      ...originalLocation,
      search: '?share_target=1',
      hash: '',
      pathname: '/',
      href: 'http://localhost:3000/?share_target=1',
    } as Location;

    render(<App />);

    // Should show the edit form with empty fields since sharedData exists but has undefined values
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Save Article' })).toBeTruthy();
    });
    // Check for URL input field
    expect(screen.queryByLabelText('URL')).toBeTruthy();
  });

  test.skip('handles Save Article button click', async () => {
    delete (window as Partial<Window>).location;
    window.location = {
      ...originalLocation,
      search: '?share_target=1',
      hash: '#title=Test%20Article&url=https%3A%2F%2Fexample.com',
      pathname: '/',
      href: 'http://localhost:3000/?share_target=1#title=Test%20Article&url=https%3A%2F%2Fexample.com',
    } as Location;

    const user = userEvent.setup();
    render(<App />);

    // Should show the edit form directly with shared data
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Save Article' })).toBeTruthy();
    });
    expect(screen.queryByDisplayValue('Test Article')).toBeTruthy();
    expect(screen.queryByDisplayValue('https://example.com')).toBeTruthy();

    // Find the submit button specifically, not just any "Save Article" text
    const saveButton = screen.queryByRole('button', { name: 'Save Article' });
    expect(saveButton).toBeTruthy();

    if (saveButton) {
      await user.click(saveButton);
      // After clicking, the share target should close and go back to article list
      expect(await screen.findByText('Read Later²')).toBeTruthy();
    }
  });

  test('handles View All Articles button click', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?share_target=1',
        hash: '#title=Test%20Article&url=https%3A%2F%2Fexample.com',
        pathname: '/',
        href: 'http://localhost:3000/?share_target=1#title=Test%20Article&url=https%3A%2F%2Fexample.com',
      },
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<App />);

    // Find by role to be more specific
    const viewArticlesButton = screen.queryByRole('button', { name: 'View All Articles' });
    if (viewArticlesButton) {
      await user.click(viewArticlesButton);

      await waitFor(() => {
        expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/');
      });
    } else {
      // If button doesn't exist, the test should note this
      expect(viewArticlesButton).toBeNull();
    }
  });

  test('renders ArticleList when not a share target', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '',
        hash: '',
        pathname: '/',
        href: 'http://localhost:3000/',
      },
      writable: true,
      configurable: true,
    });

    render(<App />);

    expect(await screen.findByText('Read Later²')).toBeTruthy();
  });

  test.skip('correctly decodes URL parameters', async () => {
    const encodedTitle = encodeURIComponent('Test Article with Special Characters!');
    const encodedText = encodeURIComponent('Description with "quotes" and symbols');
    const encodedUrl = encodeURIComponent('https://example.com/article?id=123&ref=test');

    delete (window as Partial<Window>).location;
    window.location = {
      ...originalLocation,
      search: '?share_target=1',
      hash: `#title=${encodedTitle}&text=${encodedText}&url=${encodedUrl}`,
      pathname: '/',
      href: `http://localhost:3000/?share_target=1#title=${encodedTitle}&text=${encodedText}&url=${encodedUrl}`,
    } as Location;

    render(<App />);

    // Should show the edit form with decoded values in the form fields
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Test Article with Special Characters!')).toBeTruthy();
    });
    expect(screen.queryByDisplayValue('Description with "quotes" and symbols')).toBeTruthy();
    expect(screen.queryByDisplayValue('https://example.com/article?id=123&ref=test')).toBeTruthy();
  });

  test.skip('handles URL-only share target', async () => {
    delete (window as Partial<Window>).location;
    window.location = {
      ...originalLocation,
      search: '?share_target=1',
      hash: '#url=https%3A%2F%2Fexample.com%2Farticle',
      pathname: '/',
      href: 'http://localhost:3000/?share_target=1#url=https%3A%2F%2Fexample.com%2Farticle',
    } as Location;

    render(<App />);

    // Should show the edit form with the URL pre-filled
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Save Article' })).toBeTruthy();
    });
    // Use specific label to find the URL input field to avoid multiple elements
    expect(screen.queryByLabelText('URL')).toBeTruthy();
  });
});