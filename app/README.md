# Read It Later (Google Sheets)

This is a simple front-end app to track a list of URLs (and later tags/notes) using Google Sheets as storage.

## Setup

1. **Copy config template**
   ```bash
   cp config.js.example config.js
   ```
2. **Fill in your credentials** in `config.js`:
   - `CLIENT_ID`: OAuth 2.0 client ID
   - `API_KEY`: Google API key
   - `SPREADSHEET_ID`: ID of your Google Spreadsheet (first sheet tab should be named `Sheet1`)
3. **Include Google API & Identity scripts**  
   The HTML template already includes these before the closing `</body>` tag:
   ```html
   <script src="config.js"></script>
   <script src="script.js"></script>
   <script src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
   <script src="https://accounts.google.com/gsi/client" async defer onload="gisLoaded()"></script>
   ```

4. **Enable Sheets API & create credentials**
   - In the Cloud Console, go to **APIs & Services → Library**, search for **Google Sheets API**, and click **Enable**.
   - Go to **APIs & Services → Credentials → Create Credentials → API key** and copy the key into `config.js` as `API_KEY`.
   - Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**, choose **Web application**, then under **Authorized JavaScript origins** add your local URL(s), e.g. `http://localhost:8000` (or whatever port you’ll use).
     - _Do not_ add `localhost` under the OAuth consent screen’s **Authorized domains** (Google disallows non-public domains there).
   - Copy the generated OAuth **Client ID** into `config.js` as `CLIENT_ID`.
5. **Prepare your Google Sheet**
   - Create a new Google Spreadsheet or use an existing one.
   - Ensure the first sheet tab is named `Sheet1`.
   - (Optional) add headers in row 1: `URL`, `Tags`, `Notes`.
6. **Serve the app**
   You need to host the files over HTTP so Google API can authorize.
   ```bash
   # with npm (install serve globally or via npx)
   npx serve .

   # or using Python 3
   python3 -m http.server 8000
   ```
7. **Open in browser**
   Visit `http://localhost:8000` (or the port you chose) and use the interface.

## Usage

- Click **Load from Google Sheets** to fetch saved URLs.
- Enter a URL and click **Add URL** to add to the list.
- Click **Save to Google Sheets** to persist the current list.

## Extending

> You can extend the app to capture tags/notes by adding more input fields and updating the ranges in `script.js`.

## Troubleshooting
