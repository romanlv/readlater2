import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

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

    expect(await screen.findByText('Shared Content')).not.toBeNull();
    expect(screen.getByText('Content received via Web Share Target')).not.toBeNull();
    expect(screen.getByText('Test Article')).not.toBeNull();
    expect(screen.getByText('Test description')).not.toBeNull();
    expect(screen.getByText('https://example.com')).not.toBeNull();
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

    expect(await screen.findByText('Shared Content')).not.toBeNull();
    expect(screen.getByText('No share data received.')).not.toBeNull();
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

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/');
    });
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

    expect(await screen.findByText('Read It Later 2.0a')).not.toBeNull();
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

    expect(await screen.findByText('Test Article with Special Characters!')).not.toBeNull();
    expect(screen.getByText('Description with "quotes" and symbols')).not.toBeNull();
    expect(screen.getByText('https://example.com/article?id=123&ref=test')).not.toBeNull();
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

    expect(await screen.findByText('Shared Content')).not.toBeNull();
    expect(screen.getByText('https://example.com/article')).not.toBeNull();
    expect(screen.getByText('Save Article')).not.toBeNull();
  });
});