# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReadLater2 is a multi-platform article saving system consisting of:
- **PWA Application**: React-based Progressive Web App with offline reading capabilities
- **Chrome Extension**: Browser extension for one-click article saving
- **Legacy App**: Original vanilla JavaScript implementation (deprecated)

The system uses Google Sheets API for data persistence and synchronization across devices.

## Architecture

### Monorepo Structure
- **packages/app/**: React PWA with Vite, TypeScript, Tailwind CSS, and PWA features
- **packages/extension/**: Chrome extension with React and Vite build system
- **packages/google-spreadsheet-sync/**: Shared Google Sheets integration library
- **app/**: Legacy vanilla JavaScript implementation (deprecated)
- **extension/**: Legacy extension files (deprecated)

### Technology Stack
- **Build System**: Vite with TypeScript
- **Frontend**: React 19, Tailwind CSS 4.x
- **Components**: shadcn components 
- **PWA**: VitePWA plugin with service worker injection
- **Extension**: Manifest V3 with @crxjs/vite-plugin
- **Package Management**: pnpm workspace
- **Data Storage**: Google Sheets API with OAuth 2.0

### Data Integration
Articles are stored in Google Sheets with this schema:
- URL (primary key), Title, Tags, Notes, Description, Featured Image, Timestamp, Domain, Archived, Favorite
- Auto-creation of "ReadLater" spreadsheet per user
- OAuth 2.0 authentication with Google Sheets API scopes

## Development Commands

use `context7` mcp to get up to date documentation and code examples for the libraries and tools used in the project

### Root Level
- `pnpm dev` - Start development servers for all packages
- `pnpm build` - Build all packages for production
- `pnpm lint` - Run ESLint across all packages

### PWA App (packages/app/)
- `pnpm dev` - Start development server with HMR
- `pnpm build` - TypeScript compilation + Vite production build
- `pnpm lint` - ESLint code quality checks
- `pnpm preview` - Preview production build
- `pnpm generate-pwa-icons` - Generate PWA icon assets

### Chrome Extension (packages/extension/)
- `pnpm dev` - Start extension development with hot reload
- `pnpm build` - Build extension for production/distribution
- `pnpm lint` - ESLint validation
- `pnpm preview` - Preview built extension

## Key Implementation Details

### PWA Features
- Service worker with workbox for offline functionality
- Manifest injection strategy for PWA capabilities
- Tailwind CSS 4.x with Vite plugin integration
- Radix UI components with shadcn/ui patterns

### Extension Architecture
- Manifest V3 with service worker background scripts
- Content scripts for page data extraction
- OAuth 2.0 identity integration for Google Sheets
- Context menu and browser action integrations
- Auto-detection and creation of Google Sheets per user

### Google Sheets Integration
- OAuth client configuration in extension manifest
- Automatic spreadsheet creation with proper headers
- Real-time synchronization between extension and PWA
- Offline-first with eventual consistency model

### Migration Status
The codebase is transitioning from legacy implementations (app/, extension/) to modern packages structure. The packages/ directory contains the current active development with proper TypeScript, modern React, and build tooling.