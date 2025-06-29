# ReadLater Chrome Extension Setup

## Installation

1. **Configure Google API credentials:**
   ```bash
   # Copy your credentials from the main PWA config.js
   cp ../config.js config.js
   ```
   
   Or manually edit `config.js` with your:
   - `CLIENT_ID` 
   - `API_KEY`
   - `SPREADSHEET_ID`

2. **Load extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select this extension folder

3. **Grant permissions:**
   - Click the extension icon to trigger OAuth flow
   - Grant access to Google Sheets

## Usage

- Click the ReadLater extension icon to save the current page
- Visual feedback: ... (saving) → ✓ (saved) → default
- Articles are appended to your Google Sheets

## Files

- `manifest.json` - Extension configuration
- `background.js` - Main extension logic  
- `content.js` - Page content extraction
- `config.js` - Google API credentials (not in git)