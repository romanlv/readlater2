# ReadLater2

A serverless, privacy-first article saving system that puts you in control of your data. Think Pocket or Instapaper, but without the backend—your articles sync via Google Sheets, eliminating hosting costs and third-party data concerns.

## Project Status: **Functional MVP** 🚀

The core system is working and deployed. Both the Chrome extension and PWA are functional with offline-first architecture.

### ✅ What Works Today

**Chrome Extension** (Complete)
- One-click article saving from any webpage
- Metadata extraction (title, description, images, domain)
- Tags and notes support
- Direct Google Sheets sync with OAuth 2.0
- CRX packaged with stable extension ID

**PWA Application** (Core Complete - 80% Done)
- Full offline functionality with IndexedDB
- CRUD operations (create, read, update, delete)
- Google Sheets sync with OAuth 2.0
- Manual "Sync Now" with Last-Write-Wins conflict resolution
- Search with relevance scoring
- Advanced filtering (tags, domain, archived, favorite)
- Cursor-based pagination for performance
- Dark mode support
- YouTube video support with embedded player
- Deployed to GitHub Pages with CI/CD

**Sync Engine** (Complete)
- Auto-creation of "ReadLater" spreadsheet
- Conflict-free merging with timestamp-based resolution
- Offline-first: all operations work without internet
- Background sync to Google Sheets

### ⏳ In Progress (Polish & UX)

- Debounced auto-sync (infrastructure ready, not active)
- "Load more" pagination UI (repo supports it, UI pending)
- Filter controls in UI (filters work, not exposed yet)
- Sync progress indicators with pending change counts
- App lifecycle sync (on close/background)

### 📋 Future Enhancements

- Background Sync API integration (service worker-based)
- Multiple spreadsheets/lists support
- Full article content caching for offline reading
- Text highlighting and annotations
- Chrome Web Store publication

## Why ReadLater2?

**Motivation:**
- **User-owned data:** Your articles live in your Google Sheets—you control access, backups, and retention
- **Zero infrastructure:** No servers to maintain, no hosting bills, no vendor lock-in
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
**Build:** Vite 6, TypeScript 5.8, pnpm workspaces
**State:** @tanstack/react-query, minimal Zustand
**Storage:** Dexie.js (IndexedDB), Google Sheets API
**PWA:** VitePWA plugin, Workbox, Service Workers
**Extension:** Manifest V3, @crxjs/vite-plugin
**Testing:** Vitest, React Testing Library, fake-indexeddb
**Deployment:** GitHub Pages (PWA), manual CRX distribution (extension)

## Project Structure

```
packages/
├── app/                          # PWA (React + Vite + IndexedDB)
│   ├── src/features/articles/    # Article management
│   │   ├── repository.ts         # Dexie operations
│   │   ├── sync-service.ts       # Sync orchestration
│   │   ├── google-sheets.ts      # PWA auth/sync
│   │   ├── hooks.ts              # React Query hooks
│   │   └── list.tsx              # UI components
│   └── src/components/ui/        # shadcn components
│
├── extension/                    # Chrome Extension (Manifest V3)
│   ├── src/background.ts         # Service worker
│   ├── src/popup.tsx             # Extension UI
│   └── manifest.json             # Extension config
│
├── google-sheets-sync/           # Shared sync engine
│   ├── src/auth/                 # OAuth providers
│   ├── src/spreadsheet/          # Sheets API operations
│   └── src/sync/                 # Sync engine
│
└── core/                         # Shared types/utilities
    ├── src/types/                # TypeScript definitions
    └── src/utils/                # Shared utilities
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
- Sync service (conflict resolution, queue management)
- Google Sheets integration
- Component rendering

```bash
pnpm test           # Run all tests
pnpm app test       # PWA tests only
pnpm ext test       # Extension tests only
```

See [docs/testing-guide.md](docs/testing-guide.md) for detailed testing guidance.

## Deployment

**PWA:** Auto-deploys to GitHub Pages on push to `main` branch
**Extension:** Manual build with `pnpm ext build:crx` creates `readlater-extension.crx`

The PWA is live at: [your-github-pages-url]

## What's Next?

If you're picking up this project:

1. **Start here:** Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design
2. **Understand storage:** Review [OFFLINE_STORAGE.md](docs/OFFLINE_STORAGE.md)
3. **Check progress:** See [tasks.md](docs/tasks.md) for current state
4. **Next priorities:**
   - Enable debounced auto-sync (code ready, just needs activation)
   - Add "load more" UI for pagination
   - Expose filter controls in UI
   - Implement app lifecycle sync

The foundation is solid. Most remaining work is UX polish and activation of already-built infrastructure.

## License

MIT

## Contact

For questions or issues, check the documentation first. Most answers are in `docs/`.
