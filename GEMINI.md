# Gemini Code Assistant Guide

This file provides guidance to the Gemini Code Assistant when working with the ReadLater2 repository.

## Project Overview

ReadLater2 is a multi-platform, serverless article saving system. It consists of a Progressive Web App (PWA) for online/offline reading and a Chrome Extension for one-click article saving. The core principle is user data ownership, achieved by using Google Sheets as the primary data store, which the user owns and controls.

## Architecture

### Monorepo Structure
The project uses a `pnpm` workspace monorepo structure. Key packages are located in the `packages/` directory:

-   **`packages/app`**: The React-based PWA.
-   **`packages/extension`**: The Chrome browser extension.
-   **`packages/google-sheets-sync`**: A shared library for Google Sheets integration.
-   **`packages/core`**: Shared types, interfaces, and utility functions used across the other packages.

### Technology Stack
-   **Build System**: Vite with TypeScript
-   **Frontend**: React 19, Tailwind CSS 4.x
-   **UI Components**: shadcn/ui
-   **PWA**: VitePWA plugin with a service worker for offline capabilities.
-   **Extension**: Manifest V3 using the `@crxjs/vite-plugin`.
-   **Package Management**: pnpm workspace
-   **Data Storage**: Google Sheets API with OAuth 2.0 for authentication and data persistence.

### Data Flow & Schema
Articles are stored in a Google Sheet named "ReadLater" that is automatically created in the user's Google Drive.

**Article Data Schema:**
```typescript
interface Article {
  url: string;           // Primary key
  title: string;
  tags: string[];
  notes: string;
  description: string;
  imageUrl: string;      // From og:image meta tag
  timestamp: Date;
  domain: string;
  archived: boolean;
  favorite: boolean;
}
```

## Development Commands

Use `pnpm` to run commands from the root directory.

-   `pnpm dev`: Start development servers for all packages.
-   `pnpm build`: Build all packages for production.
-   `pnpm lint`: Run ESLint across all packages.
-   `pnpm typecheck`: Run TypeScript type-checking across all packages.
-   `pnpm test`: Run Vitest tests across all packages.

Individual packages also have their own `dev`, `build`, and `lint` scripts that can be run from their respective directories (e.g., `cd packages/app && pnpm dev`).

Always run `lint`, `typecheck`, and `test` after finishing a feature or before committing.

## Code Organization

The general rule is that all code that is fetched externally or depends on storage should be in the `src/features/{feature-name}` folder. `src/components` should be used for shared components that are used across features. Avoid excessive nesting of folders; generally, a feature folder can be flat.

**Example Structure:**
```
packages/app/src/features
└── articles
    ├── list.tsx
    ├── list.test.tsx
    ├── repo.ts
    └── types.ts
```

Shared type definitions are located in `packages/core/src/types`.

## Testing Guide

Follow these principles to write efficient and maintainable tests.

### Testing Stack
-   **Runner**: Vitest (`import { describe, test, expect, vi } from 'vitest'`)
-   **Library**: React Testing Library (RTL)
-   **User Interactions**: `@testing-library/user-event`

### Key Principles

1.  **Avoid Large DOM Dumps on Failure**: This is critical to reduce LLM token costs. Use `queryBy*` methods, which return `null` on failure, instead of `getBy*` methods, which throw errors and print the entire DOM.

    ```typescript
    // ❌ Bad: Throws an error with a large DOM dump.
    expect(screen.getByText('Article Title')).toBeInTheDocument();

    // ✅ Good: Returns null, failure message is concise.
    expect(screen.queryByText('Article Title')).not.toBeNull();
    ```

2.  **Use Helper Functions for Assertions**: Create simple helpers for common checks.

    ```typescript
    const expectElementToExist = (element: HTMLElement | null) => {
      expect(element).not.toBeNull();
    };

    // Usage
    expectElementToExist(screen.queryByRole('button', { name: /save/i }));
    ```

3.  **Mocking**: Use Vitest's built-in `vi` object for all mocking. Do not use `jest`.

    ```typescript
    import { vi } from 'vitest';

    vi.mock('./api.ts', () => ({
      fetchArticles: vi.fn().mockResolvedValue([]),
    }));
    ```

4.  **Test Structure**: Group related tests using `describe` blocks for better organization.

5.  **User Events**: Always use `userEvent.setup()` for simulating user interactions to ensure a realistic event flow.

    ```typescript
    import userEvent from '@testing-library/user-event';

    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    ```
