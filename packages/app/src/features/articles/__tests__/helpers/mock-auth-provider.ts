import { vi } from 'vitest';

/**
 * Creates a mock PwaAuthProvider for testing.
 * By default, assumes the user is authenticated with a valid token.
 *
 * You can customize behavior after creation:
 * ```ts
 * const mockAuth = createMockAuthProvider();
 * mockAuth.isAuthenticated.mockResolvedValue(false);
 * mockAuth.getAuthToken.mockRejectedValue(new AuthenticationRequiredError());
 * ```
 */
export function createMockAuthProvider() {
  return {
    getAuthToken: vi.fn().mockResolvedValue('mock-auth-token'),
    redirectToAuth: vi.fn(),
    handleRedirect: vi.fn().mockResolvedValue(false),
    isAuthenticated: vi.fn().mockResolvedValue(true),
    authenticate: vi.fn().mockResolvedValue(undefined),
    clearAuthToken: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock auth provider that simulates an unauthenticated state.
 */
export function createUnauthenticatedMockAuthProvider() {
  const mock = createMockAuthProvider();
  mock.isAuthenticated.mockResolvedValue(false);
  mock.getAuthToken.mockRejectedValue(new Error('Not authenticated'));
  return mock;
}
