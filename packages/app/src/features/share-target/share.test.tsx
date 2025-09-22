import { describe, test, expect, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset URL to clean state
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        hash: '',
        pathname: '/',
      },
      writable: true,
    });
    window.history.replaceState = vi.fn();
  });

  test('renders ShareTargetDisplay when share_target=1 is in URL', async () => {
    // Mock URL parameters for share target
    Object.defineProperty(window, 'location', {
      value: {
        search: '?share_target=1',
        hash: '#title=Test%20Article&text=Test%20description&url=https%3A%2F%2Fexample.com',
        pathname: '/',
      },
      writable: true,
    });

    render(<App />);

    // Should now show the edit form directly with the title "Save Article"
    expect(await screen.findByText('Save Article', { selector: '[data-slot="card-title"]' })).not.toBeNull();
    expect(screen.getByDisplayValue('Test Article')).not.toBeNull();
    expect(screen.getByDisplayValue('https://example.com')).not.toBeNull();
    expect(screen.getByDisplayValue('Test description')).not.toBeNull();
  });

  test('renders ShareTargetDisplay with no data when share_target=1 but no hash params', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?share_target=1',
        hash: '',
        pathname: '/',
      },
      writable: true,
    });

    render(<App />);

    // Should show the edit form with empty fields
    expect(await screen.findByText('Save Article', { selector: '[data-slot="card-title"]' })).not.toBeNull();
    expect(screen.getByDisplayValue('')).not.toBeNull(); // Empty URL field
  });

  test('handles Save Article button click', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?share_target=1',
        hash: '#title=Test%20Article&url=https%3A%2F%2Fexample.com',
        pathname: '/',
      },
      writable: true,
    });

    const user = userEvent.setup();
    render(<App />);

    const saveButton = await screen.findByText('Save Article');
    await user.click(saveButton);

    // Should now show the edit form instead of immediately saving
    expect(await screen.findByText('Save Article', { selector: '[data-slot="card-title"]' })).not.toBeNull();
    expect(screen.getByDisplayValue('Test Article')).not.toBeNull();
    expect(screen.getByDisplayValue('https://example.com')).not.toBeNull();
  });

  test('handles View All Articles button click', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?share_target=1',
        hash: '#title=Test%20Article&url=https%3A%2F%2Fexample.com',
        pathname: '/',
      },
      writable: true,
    });

    const user = userEvent.setup();
    render(<App />);

    const viewArticlesButton = await screen.findByText('View All Articles');
    await user.click(viewArticlesButton);

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/');
    });
  });

  test('renders ArticleList when not a share target', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        hash: '',
        pathname: '/',
      },
      writable: true,
    });

    render(<App />);

    expect(await screen.findByText('Read It Later 2.0b')).not.toBeNull();
  });

  test('correctly decodes URL parameters', async () => {
    const encodedTitle = encodeURIComponent('Test Article with Special Characters!');
    const encodedText = encodeURIComponent('Description with "quotes" and symbols');
    const encodedUrl = encodeURIComponent('https://example.com/article?id=123&ref=test');

    Object.defineProperty(window, 'location', {
      value: {
        search: '?share_target=1',
        hash: `#title=${encodedTitle}&text=${encodedText}&url=${encodedUrl}`,
        pathname: '/',
      },
      writable: true,
    });

    render(<App />);

    // Should show the edit form with decoded values in the form fields
    expect(await screen.findByDisplayValue('Test Article with Special Characters!')).not.toBeNull();
    expect(screen.getByDisplayValue('Description with "quotes" and symbols')).not.toBeNull();
    expect(screen.getByDisplayValue('https://example.com/article?id=123&ref=test')).not.toBeNull();
  });

  test('handles URL-only share target', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?share_target=1',
        hash: '#url=https%3A%2F%2Fexample.com%2Farticle',
        pathname: '/',
      },
      writable: true,
    });

    render(<App />);

    // Should show the edit form with the URL pre-filled
    expect(await screen.findByText('Save Article', { selector: '[data-slot="card-title"]' })).not.toBeNull();
    expect(screen.getByDisplayValue('https://example.com/article')).not.toBeNull();
  });
});