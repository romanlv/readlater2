# Optional Backend Server — PRD

## TL;DR (Read This First)

- ReadLater2 gets an **optional** Fastify backend server (`backend/`) that unlocks server-side features when configured
- **Phase 1**: URL metadata extraction — when adding a URL in the PWA, the backend fetches the page and extracts title, description, og:image, domain automatically
- The app works fully without the backend; when enabled, features **progressively enhance** (e.g., auto-populated metadata fields)
- Users configure the backend URL in app Settings — defaults to `http://localhost:4080` for local development
- **Phase 2 (future)**: full page content extraction, AI-powered summarization/rewriting, reading mode
- Backend lives at `backend/` (root level, separate from `packages/` workspace) to keep it decoupled from frontend packages
- Architecture mirrors the jumbo-chat Fastify setup: feature-based routing, TypeBox validation, Pino logging

---

## Overview

Currently, rich metadata extraction (title, description, og:image) only works when saving articles through the Chrome extension, which has access to the page DOM via content scripts. When users add URLs directly in the PWA — via the add button, paste shortcut, or share target — they must manually fill in title and description.

An optional backend server solves this by fetching the target URL server-side and extracting metadata, giving the PWA the same rich-save experience as the extension.

---

## Problem Statement

**What**: PWA users who add URLs manually get a degraded experience — no auto-populated title, description, or featured image.

**Why it exists**: The PWA runs in the browser and can't fetch arbitrary URLs due to CORS restrictions. The extension bypasses this via content scripts, but not everyone uses the extension.

**Cost of not solving**: Users adding articles via PWA (mobile, desktop without extension, share target) must manually type metadata or accept bare-bones entries with just a URL and domain.

---

## Goals

1. **Auto-populate metadata** when adding a URL in the PWA, matching the extension's save quality
2. **Zero disruption** — the app must work identically without the backend configured
3. **Simple local setup** — `pnpm dev` in packages/backend starts the server, no external dependencies required for Phase 1
4. **Extensible** — the backend architecture supports future features (content extraction, AI processing) without restructuring
5. **Under 200ms** metadata extraction response time for typical web pages

---

## User Stories

### PWA User
- Pastes a URL in the add dialog → metadata fields auto-populate within seconds
- Sees a subtle indicator when backend is connected vs. not
- Can still save articles without backend — just fills fields manually as before

### Self-Hoster / Power User
- Configures backend URL in Settings once → all future saves use it
- Runs `pnpm dev` from monorepo root → backend starts alongside the app
- Can point the app at a remote backend (e.g., deployed on a VPS)

---

## Functional Requirements

### FR1: Backend Server Package

A new `backend/` package with:
- Fastify 5.x server with TypeBox type provider
- Feature-based folder structure (`src/features/metadata/`)
- Pino logging with pretty-print in development
- CORS configured for the app origin
- Health check endpoint (`GET /health`)
- Configurable via environment variables (PORT, HOST, CORS origin)

**Acceptance criteria**: `pnpm dev` in packages/backend starts a Fastify server; `GET /health` returns `{ status: "ok" }`

### FR2: Metadata Extraction Endpoint

`POST /api/metadata` — accepts a URL, fetches the page, returns extracted metadata.

**Request**:
```json
{ "url": "https://example.com/article" }
```

**Response**:
```json
{
  "title": "Article Title",
  "description": "Meta description or og:description",
  "featuredImage": "https://example.com/og-image.jpg",
  "domain": "example.com"
}
```

**Error responses**:
- `400` — missing or invalid URL: `{ "error": "Invalid URL", "message": "A valid HTTP(S) URL is required" }`
- `422` — URL unreachable or fetch failed: `{ "error": "Fetch failed", "message": "Could not fetch URL: connection timeout" }`
- `504` — fetch timeout (>10s): `{ "error": "Timeout", "message": "Page took too long to respond" }`

**Extraction priority**:
1. `og:title` → `<title>` tag → first `<h1>`
2. `og:description` → `<meta name="description">` → first `<p>` (truncated to 300 chars)
3. `og:image` → `twitter:image` → first large `<img>` (>200px width if detectable)
4. Domain extracted from URL hostname

**Constraints**:
- Fetch timeout: 10 seconds per URL
- Response body limit: 5MB (don't download massive files)
- Only fetch `text/html` content types
- Follow redirects (up to 5 hops)
- Set a proper User-Agent header

### FR3: App Settings — Backend Configuration

Extend `AppSettings` with backend server configuration:

```typescript
interface AppSettings {
  autoSync: boolean;
  openInPreview: boolean;
  // New
  backendUrl: string;       // e.g., "http://localhost:4080"
  backendEnabled: boolean;  // Whether to use backend features
}
```

**Settings UI additions**:
- "Backend Server" section in Settings page
- Toggle: "Enable backend server"
- Text input: "Server URL" (shown when enabled)
- Connection status indicator: tests `GET /health` and shows connected/disconnected
- Defaults: disabled, URL = `http://localhost:4080`

**Acceptance criteria**: User can enable backend, set URL, and see real-time connection status

### FR4: PWA Integration — Auto-Metadata on URL Add

When backend is enabled and a URL is entered in the article add/edit form:
1. Debounce URL input (500ms after typing stops)
2. Call `POST /api/metadata` with the URL
3. Auto-populate empty title, description, and featuredImage fields
4. Show a loading spinner on the fields while fetching
5. Don't overwrite fields the user has already filled in
6. If backend is unavailable or returns an error, silently fall back to manual entry

**Acceptance criteria**: User types/pastes a URL → empty fields populate automatically; manually entered fields are preserved

---

## Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| EC1 | Backend configured but unreachable | Show "disconnected" in settings; metadata fetch silently fails; user fills fields manually |
| EC2 | URL returns non-HTML (PDF, image) | Return `422` with message "URL does not point to an HTML page" |
| EC3 | URL requires authentication / returns 403 | Return whatever metadata is available (often none); don't retry |
| EC4 | Page has no meta tags at all | Return partial response — at minimum domain from URL; title falls back to URL path |
| EC5 | User types URL then immediately submits | Cancel in-flight metadata fetch; save with whatever data is available |
| EC6 | Very slow page (>10s) | Backend returns 504; app falls back to manual entry |
| EC7 | User disables backend while fetch is in-flight | Cancel/ignore the response; fields remain as-is |

---

## Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR1 | Metadata extraction latency | < 200ms server processing + page fetch time |
| NFR2 | Backend startup time | < 2 seconds |
| NFR3 | Memory usage (idle) | < 50MB RSS |
| NFR4 | No external dependencies for Phase 1 | No database, no API keys, no Docker |

---

## API Summary

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check — returns `{ status: "ok" }` |
| `POST` | `/api/metadata` | Extract metadata from a URL |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Fastify 5.x | Fast, TypeScript-native, plugin ecosystem, consistent with jumbo-chat reference |
| Validation | TypeBox | Integrates with Fastify's type provider, compile-time + runtime safety |
| HTML parsing | cheerio | Lightweight, no browser engine needed, standard for server-side HTML parsing |
| Logging | Pino | Fastify's built-in logger, structured JSON logs, pino-pretty for dev |
| Package manager | pnpm | Matches monorepo; bun not used for compatibility |
| No database | — | Phase 1 needs no persistence; metadata is returned directly to the client |
| Optional by design | Feature flag in settings | Backend adds value but isn't a dependency; app must never break without it |

---

## Phase 2 — Future Scope (Not in this PRD)

These are captured for architectural awareness but are **out of scope** for Phase 1:

- **Full content extraction**: fetch readable article text (like Readability.js) for offline reading mode
- **AI summarization**: send article content to an LLM for TLDR generation
- **AI rewriting**: reformat/simplify articles
- **Batch metadata refresh**: re-fetch metadata for existing articles
- **Alternative deployment targets**: Cloudflare Workers, Docker, serverless
- **Authentication**: API keys or tokens for non-local deployments
- **Caching**: cache metadata responses to avoid re-fetching the same URL

---

## Implementation Checklist

### Backend Package Setup
- [ ] Create `backend/` with Fastify, TypeScript, Pino
- [ ] Configure `package.json` with dev/build/start/test/lint/typecheck scripts
- [ ] Add to pnpm workspace and root-level dev command
- [ ] Set up tsconfig.json (ESNext, strict, bundler resolution)
- [ ] Environment config (PORT, HOST, CORS_ORIGIN)
- [ ] CORS plugin configured for app origin
- [ ] Health check endpoint (`GET /health`)

### Metadata Feature
- [ ] `src/features/metadata/routes.ts` — POST /api/metadata route
- [ ] `src/features/metadata/service.ts` — fetch URL and extract metadata
- [ ] `src/features/metadata/types.ts` — TypeBox request/response schemas
- [ ] HTML parsing with cheerio (og tags, meta tags, title, fallbacks)
- [ ] Timeout handling (10s), redirect following, content-type checking
- [ ] Unit tests for metadata extraction logic
- [ ] Integration test for the endpoint

### App Settings Integration
- [ ] Extend `AppSettings` with `backendUrl` and `backendEnabled`
- [ ] Add "Backend Server" section to Settings page
- [ ] Connection status check (ping `/health`)
- [ ] Backend API client utility in app

### App — Auto-Metadata on URL Add
- [ ] Hook/utility to fetch metadata from backend when URL is entered
- [ ] Debounced trigger on URL field change (500ms)
- [ ] Auto-populate empty fields, preserve user-filled fields
- [ ] Loading state on metadata fields
- [ ] Graceful fallback when backend unavailable
