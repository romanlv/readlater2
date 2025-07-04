import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticleList } from './article-list';
import * as GoogleSheets from './google-sheets';

// Mock the entire google-sheets module
vi.mock('./google-sheets', async (importOriginal) => {
  const actual = await importOriginal();
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

const mockConfig = {
  CLIENT_ID: 'test-client-id',
  API_KEY: 'test-api-key',
  SPREADSHEET_ID: 'test-spreadsheet-id',
};

describe('ArticleList', () => {
  const mockedGoogleSheets = vi.mocked(GoogleSheets);
  const mockAuthProvider = mockedGoogleSheets.getAuthProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows "Sign In" button when not authenticated', async () => {
    mockAuthProvider.handleRedirect.mockResolvedValue(false);
    mockAuthProvider.isAuthenticated.mockResolvedValue(false);

    render(<ArticleList config={mockConfig} />);

    expect(await screen.findByText('Please sign in with Google to manage your articles.')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Sign In with Google/i })).not.toBeNull();
  });

  test('clicking "Sign In" triggers authentication flow', async () => {
    mockAuthProvider.handleRedirect.mockResolvedValue(false);
    mockAuthProvider.isAuthenticated.mockResolvedValue(false);
    // Simulate auth error to trigger redirect
    mockedGoogleSheets.loadArticlesFromSheet.mockRejectedValue(new GoogleSheets.AuthenticationRequiredError());

    const user = userEvent.setup();
    render(<ArticleList config={mockConfig} />);

    const signInButton = await screen.findByRole('button', { name: /Sign In with Google/i });
    await user.click(signInButton);

    await waitFor(() => {
      expect(mockAuthProvider.redirectToAuth).toHaveBeenCalled();
    });
  });

  test('loads and displays articles when authenticated', async () => {
    const mockArticles = [{ url: 'https://example.com', title: 'Test Article', description: '', featuredImage: '', timestamp: '', domain: '', tags: [], notes: '', archived: false, favorite: false }];
    mockAuthProvider.handleRedirect.mockResolvedValue(false);
    mockAuthProvider.isAuthenticated.mockResolvedValue(true);
    mockedGoogleSheets.loadArticlesFromSheet.mockResolvedValue(mockArticles);

    render(<ArticleList config={mockConfig} />);

    expect(await screen.findByText('Test Article')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Reload Articles/i })).not.toBeNull();
  });
});
