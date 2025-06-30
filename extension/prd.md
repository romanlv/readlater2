# ReadLater Chrome Extension - Product Requirements Document

## 1. Executive Summary

The ReadLater Chrome Extension enables users to save articles for later reading with a single click, even when the main ReadLater PWA is not open. The extension integrates seamlessly with the existing PWA by sharing the same IndexedDB storage, providing a unified reading list experience across browsing and dedicated reading sessions.

## 2. Product Overview

### 2.1 Vision
Create a frictionless way for users to save interesting articles while browsing, ensuring they never lose valuable content and can access their reading list from any device.

### 2.2 Mission
Provide instant article saving capabilities that work offline-first, with seamless integration to the main ReadLater PWA for enhanced reading experiences.

### 2.3 Target Users
- **Primary**: Knowledge workers, researchers, and content consumers who discover articles throughout their browsing
- **Secondary**: Students, professionals, and anyone who wants to organize their reading materials

## 3. Core Features

### 3.1 One-Click Article Saving
- **Description**: Save current page as an article with a single click on the extension icon
- **User Story**: As a user browsing the web, I want to save interesting articles with one click so I can read them later without losing the content
- **Acceptance Criteria**:
  - Clicking extension icon saves the current page
  - Article metadata (title, URL, description) is automatically extracted
  - Visual feedback confirms successful save
  - No duplicate saves for the same URL

### 3.2 Context Menu Integration
- **Description**: Right-click context menu option to save links or selected text
- **User Story**: As a user, I want to save articles from links or selected text without navigating to the page first
- **Acceptance Criteria**:
  - Right-click on links shows "Save to ReadLater" option
  - Right-click on selected text shows "Save to ReadLater" option
  - Context menu works on any webpage

### 3.3 Offline-First Storage
- **Description**: Articles are saved to IndexedDB immediately, ensuring offline availability
- **User Story**: As a user, I want my saved articles to be available even when offline
- **Acceptance Criteria**:
  - Articles save instantly to local IndexedDB
  - No network dependency for saving articles
  - Articles persist across browser sessions

### 3.4 PWA Integration
- **Description**: Seamless integration with the main ReadLater PWA
- **User Story**: As a user, I want my saved articles to appear in the main ReadLater app
- **Acceptance Criteria**:
  - Extension and PWA share the same IndexedDB database
  - Articles saved via extension appear in PWA immediately
  - PWA can access all articles saved by extension

## 4. Technical Requirements

### 4.1 Architecture
- **Manifest V3**: Use latest Chrome extension manifest version
- **Service Worker**: Background service worker for persistent functionality
- **Content Scripts**: For page interaction and data extraction
- **IndexedDB**: Shared storage with PWA using same database schema

### 4.2 Data Model
```javascript
{
  url: string,           // Primary key
  title: string,         // Page title
  description: string,   // Meta description or extracted text
  timestamp: string,     // ISO timestamp
  domain: string,        // Hostname for organization
  content?: string,      // Optional: full article content
  tags?: string[],       // Optional: user tags
  notes?: string         // Optional: user notes
}
```

### 4.3 Permissions
- `activeTab`: Access current tab for article extraction
- `storage`: Access IndexedDB storage
- `scripting`: Execute content scripts
- `contextMenus`: Add context menu items

### 4.4 Host Permissions
- `<all_urls>`: Work on any website
- `http://localhost:*/*`: Development environment
- `https://readitlater-dev.10fold.dev/*`: Development environment
- `https://your-domain.com/*`: Production PWA domain

## 5. User Experience

### 5.1 Extension Icon States
- **Default**: Gray icon
- **Saving**: Loading spinner
- **Saved**: Green checkmark (temporary)
- **Error**: Red X (temporary)

### 5.2 Visual Feedback
- **Toast Notification**: Brief confirmation message
- **Badge Text**: Show save status on icon
- **Context Menu**: Clear labeling and icons

### 5.3 Error Handling
- **Network Errors**: Graceful degradation with offline storage
- **Permission Denied**: Clear instructions for enabling permissions
- **Storage Full**: Warning and cleanup suggestions

## 6. Integration Points

### 6.1 Google Sheets Integration - Implementation Details

The extension integrates directly with Google Sheets API for data storage, eliminating the need for a separate backend service.

#### 6.1.1 Authentication Setup

**OAuth 2.0 Configuration in manifest.json:**
```json
{
  "permissions": [
    "activeTab",
    "storage", 
    "scripting",
    "identity"
  ],
  "host_permissions": [
    "<all_urls>",
    "https://sheets.googleapis.com/*",
    "https://www.googleapis.com/*"
  ],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.metadata.readonly"
    ]
  }
}
```

**Authentication Implementation:**
```javascript
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}
```

#### 6.1.2 Spreadsheet Management

**Auto-Creation of ReadLater Spreadsheet:**
```javascript
async function getOrCreateReadLaterSpreadsheet(token) {
  const spreadsheetName = 'ReadLater';
  
  // Search for existing spreadsheet
  try {
    const existingId = await findSpreadsheetByName(token, spreadsheetName);
    if (existingId) {
      await chrome.storage.local.set({ readlater_spreadsheet_id: existingId });
      return existingId;
    }
  } catch (error) {
    // Fallback to stored ID
    const stored = await chrome.storage.local.get(['readlater_spreadsheet_id']);
    if (stored.readlater_spreadsheet_id) {
      return stored.readlater_spreadsheet_id;
    }
  }
  
  // Create new spreadsheet
  const spreadsheetResponse = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: spreadsheetName }
      })
    }
  );
  
  const spreadsheet = await spreadsheetResponse.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  
  // Add headers and store ID
  await addHeadersToSpreadsheet(token, spreadsheetId);
  await chrome.storage.local.set({ readlater_spreadsheet_id: spreadsheetId });
  
  return spreadsheetId;
}
```

**Header Setup:**
```javascript
async function addHeadersToSpreadsheet(token, spreadsheetId) {
  const headers = [
    'URL', 'Title', 'Tags', 'Notes', 'Description', 
    'Featured Image', 'Timestamp', 'Domain', 'Archived', 'Favorite'
  ];
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:J1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [headers]
      })
    }
  );
}
```

#### 6.1.3 Data Persistence

**Article Saving Implementation:**
```javascript
async function saveToGoogleSheets(article) {
  const token = await getAuthToken();
  const spreadsheetId = await getOrCreateReadLaterSpreadsheet(token);
  
  // Find next empty row
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  let nextRow = 1;
  if (getResponse.ok) {
    const data = await getResponse.json();
    if (data.values && data.values.length > 0) {
      nextRow = data.values.length + 1;
    }
  }
  
  // Save article data
  const requestBody = {
    majorDimension: 'ROWS',
    values: [[
      article.url || '',
      article.title || '',
      article.tags ? article.tags.join(', ') : '',
      article.notes || '',
      article.description || '',
      article.featuredImage || '',
      article.timestamp || '',
      article.domain || '',
      article.archived ? '1' : '',
      article.favorite ? '1' : ''
    ]]
  };
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A${nextRow}:J${nextRow}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to save to Google Sheets: ${response.statusText}`);
  }
}
```

#### 6.1.4 Page Data Extraction

**Content Extraction Logic:**
```javascript
function extractPageData() {
  const url = window.location.href;
  const title = document.title || url;
  
  let description = '';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    description = metaDesc.content;
  }
  
  let featuredImage = '';
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    featuredImage = ogImage.content;
  }
  
  return {
    url,
    title,
    description,
    featuredImage,
    timestamp: new Date().toISOString(),
    domain: new URL(url).hostname
  };
}
```

#### 6.1.5 Configuration Setup

**Configuration (config.js):**
```javascript
const CONFIG = {
  // Extension configuration - OAuth client_id is configured in manifest.json
  // No pre-configuration needed - spreadsheet is created automatically per user
};
```

**Google Cloud Console Setup Steps:**
1. Create new project in Google Cloud Console
2. Enable Google Sheets API and Google Drive API
3. Create OAuth 2.0 credentials (Web application type)
4. Add authorized JavaScript origins:
   - `chrome-extension://YOUR_EXTENSION_ID`
5. Copy client ID to manifest.json oauth2.client_id

**How It Works:**
- Each user gets their own "ReadLater" spreadsheet created automatically
- Extension searches for existing "ReadLater" spreadsheet on first use
- If not found, creates new spreadsheet with proper headers
- Spreadsheet ID is stored locally for subsequent uses

### 6.2 Data Schema

The extension uses a 10-column schema in Google Sheets:

| Column | Field | Type | Description |
|--------|-------|------|-------------|
| A | URL | String | Primary identifier |
| B | Title | String | Page title |
| C | Tags | String | Comma-separated tags |
| D | Notes | String | User notes |
| E | Description | String | Meta description |
| F | Featured Image | String | OpenGraph image URL |
| G | Timestamp | String | ISO datetime |
| H | Domain | String | Website hostname |
| I | Archived | String | '1' if archived |
| J | Favorite | String | '1' if favorited |

## 7. Success Metrics

### 7.1 User Engagement
- **Daily Active Users**: Number of users saving articles daily
- **Save Frequency**: Average articles saved per user per day
- **Retention**: Users who continue using after first week

### 7.2 Technical Performance
- **Save Speed**: < 500ms from click to confirmation
- **Reliability**: 99%+ successful saves
- **Storage Efficiency**: Minimal IndexedDB usage

### 7.3 User Satisfaction
- **Ease of Use**: Time to first successful save
- **Error Rate**: Percentage of failed save attempts
- **Feature Adoption**: Usage of context menu vs. icon click

## 8. Development Phases

### Phase 1: MVP (Week 1-2)
- Basic extension with icon click to save
- IndexedDB integration
- Simple article extraction
- Basic PWA integration

### Phase 2: Enhanced UX (Week 3-4)
- Context menu integration
- Better visual feedback
- Error handling
- Popup interface

### Phase 3: Advanced Features (Week 5-6)
- Content extraction
- Tags and notes
- Batch operations
- Advanced settings

### Phase 4: Polish & Testing (Week 7-8)
- Performance optimization
- Cross-browser testing
- User testing
- Store submission

## 9. Technical Constraints

### 9.1 Browser Limitations
- Manifest V3 requirements
- Service worker lifecycle
- Content script isolation
- Storage quotas

### 9.2 Security Considerations
- Minimal permission requirements
- Secure data handling
- Privacy compliance
- Regular security audits

## 10. Future Enhancements

### 10.1 Advanced Features
- **Smart Categorization**: Auto-tag articles by domain/topic
- **Reading Progress**: Track reading status
- **Export Options**: PDF, markdown, etc.
- **Social Features**: Share reading lists

### 10.2 Platform Expansion
- **Firefox Extension**: Cross-browser compatibility
- **Mobile Integration**: Native app integration
- **API Access**: Third-party integrations
- **Enterprise Features**: Team collaboration

## 11. Risk Assessment

### 11.1 Technical Risks
- **IndexedDB Compatibility**: Browser version differences
- **Performance Impact**: Extension overhead on browsing
- **Storage Limits**: Large article collections

### 11.2 User Experience Risks
- **Permission Fatigue**: Users declining permissions
- **Learning Curve**: New users understanding features
- **Competition**: Existing read-later solutions

### 11.3 Mitigation Strategies
- **Progressive Enhancement**: Core features work without advanced permissions
- **Clear Onboarding**: Guided first-time user experience
- **Performance Monitoring**: Regular performance audits
- **User Feedback**: Continuous improvement based on usage data

## 12. Success Criteria

### 12.1 Launch Criteria
- [ ] Extension installs and runs without errors
- [ ] Articles save successfully to IndexedDB
- [ ] PWA integration works seamlessly
- [ ] Basic error handling implemented
- [ ] User documentation complete

### 12.2 Post-Launch Goals
- [ ] 100+ active users within first month
- [ ] 90%+ successful save rate
- [ ] < 2% error rate
- [ ] Positive user feedback (> 4.0 rating)
- [ ] Successful Chrome Web Store listing

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Next Review**: [Date + 2 weeks]
