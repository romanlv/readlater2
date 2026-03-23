# ReadLater2

A privacy-first article saving system that puts you in control of your data. Think Pocket or Instapaper, but your articles sync via Google Sheets—no third-party data concerns. An optional backend server adds features like automatic metadata extraction.

## Project Status: **Functional MVP** 🚀

The core system is working and deployed. Both the Chrome extension and PWA are functional with offline-first architecture.

### ✅ What Works Today

**Chrome Extension** (Complete)
- One-click article saving from any webpage
- Metadata extraction (title, description, images, domain)
- Tags and notes support
- Direct Google Sheets sync with OAuth 2.0
- CRX packaged with stable extension ID

**PWA Application** (Core Complete - 85% Done)
- Full offline functionality with IndexedDB
- CRUD operations (create, read, update, delete)
- Google Sheets sync with OAuth 2.0
- Manual "Sync Now" with Last-Write-Wins conflict resolution
- Search with relevance scoring
- Advanced filtering (tags, domain, archived, favorite)
- Cursor-based pagination with "Load More" UI
- Dark mode support
- YouTube video support with embedded player
- Share links via "Share to ReadLater2" on Android (iOS not supported)
- Deployed to GitHub Pages with CI/CD

**Sync Engine** (Complete)
- Auto-creation of "ReadLater" spreadsheet
- Conflict-free merging with timestamp-based resolution
- Offline-first: all operations work without internet
- Background sync to Google Sheets

### ⏳ In Progress (Polish & UX)

- Debounced auto-sync (infrastructure ready, not active)
- Filter controls in UI (filters work, not exposed yet)
- Sync progress indicators with pending change counts
- App lifecycle sync (on close/background)

### 📋 Future Enhancements

- Background Sync API integration (service worker-based)
- Multiple spreadsheets/lists support
- Full article content caching for offline reading
- Text highlighting and annotations
- Chrome Web Store publication
- Backend: full page content extraction, AI-powered summarization

## Why ReadLater2?

**Motivation:**
- **User-owned data:** Your articles live in your Google Sheets—you control access, backups, and retention
- **Minimal infrastructure:** Works with zero backend; optional server adds convenience features
- **Privacy-first:** Data never touches third-party servers (except Google Sheets)
- **Offline-capable:** Read and manage articles without internet connection
- **Easy sharing:** Share your reading list by sharing your Google Sheet

## What's Included

### 1. Progressive Web App (PWA)
- **React 19** with TypeScript and Tailwind CSS
- **Offline-first** storage using IndexedDB (Dexie.js)
- **React Query** for state management
- **Service Worker** with Web Share Target API
- Installable on any device (desktop, mobile, tablet)

### 2. Chrome Extension
- **Manifest V3** with service worker
- One-click save from context menu or browser action
- Page metadata extraction
- Immediate sync to Google Sheets

### 3. Google Sheets Sync Engine
- Shared library for both PWA and extension
- OAuth 2.0 authentication
- CRUD operations with error handling
- Conflict resolution (Last-Write-Wins)

### 4. Backend Server (Optional)
- **Fastify 5** with TypeScript
- URL metadata extraction (title, description, og:image)
- Enables auto-populated article fields in the PWA
- Runs independently — not part of the pnpm workspace
- See [backend/README setup](#backend-optional) below

## Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Google Cloud Project with Sheets API enabled (for OAuth)

### Development

```bash
# Install dependencies
pnpm install

# Start all packages in development mode
pnpm dev

# Or run individual packages
pnpm app dev        # PWA only (http://localhost:3030)
pnpm ext dev        # Extension only (load unpacked from dist/)
```

### Backend (Optional)

The backend is a standalone project with its own dependencies, separate from the pnpm workspace.

```bash
cd backend
pnpm install        # Separate install — not part of the workspace
pnpm dev            # Starts on http://localhost:4080
```

Then enable it in the PWA: **Settings > Backend Server > Enable**, set URL to `http://localhost:4080`.

When enabled, adding a URL in the PWA will auto-fetch title, description, and featured image from the page.

### Production Build

```bash
# Build everything
pnpm build

# Build extension CRX with stable ID
pnpm ext build:crx
```

### Quality Checks

```bash
pnpm lint           # ESLint all packages
pnpm typecheck      # TypeScript checking
pnpm test           # Run all tests with Vitest
```

## Key Features

- **Offline-First Architecture:** All operations work immediately in IndexedDB, sync happens in background
- **Cursor-Based Pagination:** Consistent performance even with thousands of articles
- **Advanced Search:** Full-text search with relevance scoring across title, description, domain, tags
- **Smart Filtering:** Filter by tags, domain, archived status, favorites
- **Conflict Resolution:** Automatic Last-Write-Wins merging prevents sync conflicts
- **Optimistic Updates:** Instant UI feedback, sync happens asynchronously
- **Dark Mode:** System-aware theme with manual toggle
- **YouTube Support:** Direct video playback for saved YouTube links

## Tech Stack

**Frontend:** React 19, Tailwind CSS 4.x, shadcn/ui components, Lucide icons
**Backend:** Fastify 5, cheerio, Pino (optional, standalone)
**Build:** Vite 6, TypeScript 5.8, pnpm workspaces
**State:** @tanstack/react-query, minimal Zustand
**Storage:** Dexie.js (IndexedDB), Google Sheets API
**PWA:** VitePWA plugin, Workbox, Service Workers
**Extension:** Manifest V3, @crxjs/vite-plugin
**Testing:** Vitest, React Testing Library, fake-indexeddb
**Deployment:** GitHub Pages (PWA), manual CRX distribution (extension)

## Project Structure

```
backend/                              # Optional Fastify server (standalone)
├── src/features/metadata/            # URL metadata extraction
├── src/lib/                          # Error handling
└── src/utils/                        # Logging

packages/                             # pnpm workspace
├── app/                              # PWA (React + Vite + IndexedDB)
│   ├── src/features/articles/        # Article management
│   ├── src/features/settings/        # App preferences
│   └── src/components/ui/            # shadcn components
│
├── extension/                        # Chrome Extension (Manifest V3)
│   ├── src/background.ts             # Service worker
│   ├── src/popup.tsx                 # Extension UI
│   └── manifest.json                 # Extension config
│
├── google-sheets-sync/               # Shared sync engine
│   ├── src/auth/                     # OAuth providers
│   ├── src/spreadsheet/              # Sheets API operations
│   └── src/sync/                     # Sync engine
│
└── core/                             # Shared types/utilities
    ├── src/types/                    # TypeScript definitions
    └── src/utils/                    # Shared utilities
```

## Architecture Highlights

### Offline-First Design
- All user actions happen immediately in IndexedDB
- React Query treats IndexedDB as the source of truth
- Background sync to Google Sheets (non-blocking)
- Works completely offline—sync when connectivity returns

### Data Flow
1. **Extension:** Save → Google Sheets (online-only, no local storage)
2. **PWA:** Save → IndexedDB → Queue for sync → Background upload to Sheets
3. **Sync:** Fetch from Sheets → Merge with LWW → Update IndexedDB

### Conflict Resolution
- **Last-Write-Wins (LWW)** using `editedAt || timestamp`
- Automatic resolution—no user intervention
- Later timestamp wins; ties prefer remote version
- Simple and deterministic for single-user use case

### Storage Strategy
- **IndexedDB:** Unix timestamps (ms) for performance
- **Google Sheets:** ISO 8601 strings for human readability
- Automatic conversion during sync operations

## Documentation

Comprehensive docs available in `docs/`:

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design, data flow, architecture decisions
- **[OFFLINE_STORAGE.md](docs/OFFLINE_STORAGE.md)** - IndexedDB implementation, React Query patterns, repository layer
- **[testing-guide.md](docs/testing-guide.md)** - Vitest best practices, testing patterns
- **[tasks.md](docs/tasks.md)** - Development roadmap and progress tracking
- **[CLAUDE.md](CLAUDE.md)** - Project instructions for AI assistants

## Testing

6 test files covering critical functionality:
- Article repository (CRUD, pagination, search, filtering)
- Article list component (load more, filtering, CRUD operations)
- Sync service (conflict resolution, queue management)
- Google Sheets integration
- Component rendering

```bash
pnpm test           # Run all tests (workspace)
pnpm app test       # PWA tests only
pnpm ext test       # Extension tests only
cd backend && pnpm test  # Backend tests (separate)
```

See [docs/testing-guide.md](docs/testing-guide.md) for detailed testing guidance.

## Deployment

**PWA:** Auto-deploys to GitHub Pages on push to `main` branch
**Extension:** Manual build with `pnpm ext build:crx` creates `readlater-extension.crx`

## What's Next?

If you're picking up this project:

1. **Start here:** Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design
2. **Understand storage:** Review [OFFLINE_STORAGE.md](docs/OFFLINE_STORAGE.md)
3. **Check progress:** See [tasks.md](docs/tasks.md) for current state
4. **Next priorities:**
   - Enable debounced auto-sync (code ready, just needs activation)
   - Expose filter controls in UI
   - Implement app lifecycle sync

The foundation is solid. Most remaining work is UX polish and activation of already-built infrastructure.

## License

MIT

## Contact

For questions or issues, check the documentation first. Most answers are in `docs/`.
