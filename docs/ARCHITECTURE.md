# ReadLater2 Architecture

## Vision
A serverless, user-owned reading list system with offline-first PWA and Chrome extension. No backend infrastructure - users own their data through external storage providers (starting with Google Sheets).

## Core Principles
- **User Data Ownership**: Each user controls their data through their chosen storage provider
- **Serverless**: No backend infrastructure, minimal operational costs
- **Offline-First**: PWA works without internet, syncs when available
- **Modular Storage**: Pluggable sync engines for different storage providers

## System Architecture

### Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chrome Ext     │    │   PWA App       │    │ Storage Engines │
│                 │    │                 │    │                 │
│ - Save articles │    │ - Offline read  │    │ - Google Sheets │
│ - Page context  │◄──►│ - Local storage │◄──►│ - Future: DB,   │
│                 │    │ - Background    │    │   Cloud Storage │
│                 │    │   sync          │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ packages/core   │
                    │                 │
                    │ - Data types    │
                    │ - Interfaces    │
                    │ - Shared utils  │
                    └─────────────────┘
```

## Data Flow

### Article Storage Schema
```typescript
interface Article {
  url: string;           // Primary key
  title: string;
  notes: string;
  description: string;
  imageUrl: string;      // og:image
  timestamp: Date;
  tags: string[];
  archived: boolean;
  favorite: boolean;
}
```

### Save Article Flow
1. **Extension**: User clicks save → Extract page metadata → Save to storage engine → Show success/error
2. **PWA Mobile**: Share link → PWA opens → Save to local IndexedDB → Queue for sync
3. **Storage Engine**: Handle save operation with provider-specific logic

### Sync Strategy
- **PWA**: Local-first with periodic background sync (configurable interval + user-triggered)
- **Extension**: Direct save to storage engine (blocking on errors)
- **Conflict Resolution**: Create duplicate entries with timestamps for manual resolution

## Package Structure

### packages/app (PWA)
- **Technology**: React 19, Vite, TypeScript, Tailwind CSS 4.x, PWA features
- **Storage**: IndexedDB for offline data
- **Features**: Article reading, note-taking, tagging, offline support
- **Sync**: Background service for storage engine synchronization

### packages/extension (Chrome Extension)
- **Technology**: Manifest V3, React, Vite, @crxjs/vite-plugin
- **Features**: One-click article saving, page context awareness
- **Integration**: Direct storage engine communication
- **Phase 2**: Show existing notes/saved status for current page

### packages/google-spreadsheet-sync (Storage Engine)
- **Purpose**: Google Sheets integration with OAuth 2.0
- **Features**: Auto-create "ReadLater" spreadsheet, CRUD operations
- **Schema**: Maps Article interface to spreadsheet columns
- **Reusability**: Shared by both extension and PWA

### packages/core (Shared Library)
- **Data Types**: Article interface, sync interfaces
- **Utilities**: URL validation, metadata extraction
- **Interfaces**: Storage engine contracts, sync protocols

## Error Handling Strategy

### Extension
- **Blocking Errors**: All sync failures prevent save operation
- **User Feedback**: Clear error messages with retry options
- **Authentication**: Handle OAuth expiration gracefully

### PWA
- **Non-Blocking Sync**: Local operations always succeed
- **Sync Errors**: Visible in UI with manual resolution options
- **Offline Mode**: Full functionality without external connectivity

## Development Phases

### Phase 1: MVP
- PWA with offline reading lists
- Chrome extension for article saving
- Google Sheets sync engine
- Basic conflict resolution (duplicate entries)

### Phase 2: Enhanced Features
- Extension shows saved articles on page visit
- Multiple spreadsheet/list support
- Advanced conflict resolution UI
- Additional storage engines

### Phase 3: Advanced Features
- Full article content caching for offline reading
- Text highlighting and annotations
- Article preview and reading mode
- Enhanced tagging and search

## Technology Decisions

### Why Serverless?
- **Cost**: No server infrastructure costs
- **Scalability**: Inherently scales with user base
- **Privacy**: Users control their data storage
- **Simplicity**: Reduced operational complexity

### Why Google Sheets First?
- **Accessibility**: Users can view/edit data directly
- **Sharing**: Easy collaboration through existing Google features
- **Familiarity**: Users understand spreadsheet paradigm
- **API Maturity**: Well-documented Google Sheets API

### Why Monorepo?
- **Code Sharing**: Common types and utilities across packages
- **Consistency**: Unified build and development processes
- **Modularity**: Clear separation of concerns with reusable components