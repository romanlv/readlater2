# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a simple front-end web application that allows users to save and manage URLs using Google Sheets as storage. The app uses vanilla JavaScript with the Google Sheets API for data persistence.

## Architecture

- **Frontend**: Pure HTML/CSS/JavaScript with no build process
- **API Integration**: Google Sheets API v4 for CRUD operations
- **Authentication**: Google OAuth 2.0 for accessing user's Google Sheets
- **Data Storage**: Google Sheets as backend database

### Key Files

- `index.html`: Main HTML structure with Google API script loading
- `script.js`: Core application logic with Google API integration
- `config.js`: User credentials (CLIENT_ID, API_KEY, SPREADSHEET_ID) - not tracked in git
- `config.js.example`: Template for required configuration
- `style.css`: Styling for the simple UI

### Data Flow

1. User authenticates with Google OAuth when loading/saving
2. URLs are stored in memory as DOM list items
3. Save operation writes all URLs to Google Sheets starting at row 2 (columns A-C for URL, Tags, Notes)
4. Load operation reads column A from Google Sheets and populates the UI

## Development Commands

- **Serve locally**: `npx serve .` 
- **Setup**: `cp config.js.example config.js` then fill in Google API credentials

## Google API Requirements

- Requires Google Sheets API enabled in Google Cloud Console
- OAuth 2.0 client ID with authorized JavaScript origins
- API key for Google Sheets access
- Target spreadsheet must have first sheet named "Sheet1"