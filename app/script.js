// Constants for Google API discovery and scopes
const DISCOVERY_DOCS = [
  'https://sheets.googleapis.com/$discovery/rest?version=v4',
];
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// OAuth2 token client and initialization state for GAPI & GIS
let tokenClient;
let gapiInited = false;
let gisInited = false;

// Called when the GAPI client library is loaded.
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

// Initializes the GAPI client with API key + discovery docs.
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: CONFIG.API_KEY,
    discoveryDocs: DISCOVERY_DOCS,
  });
  gapiInited = true;
}

// Called when the GIS client library is loaded.
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPES,
    callback: '', // defined at request time
  });
  gisInited = true;
}

// DOM elements
const urlList = document.getElementById('url-list');
const urlInput = document.getElementById('url-input');
const addBtn = document.getElementById('add-url');
const saveBtn = document.getElementById('save');
const loadBtn = document.getElementById('load');
const testShareBtn = document.getElementById('test-share');
const clearSwBtn = document.getElementById('clear-sw');

function handleAuthError(err) {
  console.error('Auth failed', err);
  if (err && err.error === 'popup_closed_by_user') {
    alert(
      'The sign-in popup was closed or blocked. Please allow pop-ups for this site and try again.',
    );
  }
}

addBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) return;
  const li = document.createElement('li');
  li.textContent = url;
  urlList.appendChild(li);
  urlInput.value = '';
});

saveBtn.addEventListener('click', () => {
  if (!gapiInited || !gisInited)
    return console.error('GAPI or GIS not initialized');
  tokenClient.callback = (resp) => {
    if (resp.error !== undefined) return handleAuthError(resp);
    saveToSheet();
  };
  if (!gapi.client.getToken()) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
});

loadBtn.addEventListener('click', () => {
  if (!gapiInited || !gisInited)
    return console.error('GAPI or GIS not initialized');
  tokenClient.callback = (resp) => {
    if (resp.error !== undefined) return handleAuthError(resp);
    loadFromSheet();
  };
  if (!gapi.client.getToken()) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
});

// Test Share Target functionality
testShareBtn.addEventListener('click', async () => {
  console.log('Testing share target...');

  // Create a form with share data
  const formData = new FormData();
  formData.append('title', 'Test Share Title');
  formData.append('text', 'This is a test share from the app');
  formData.append('url', 'https://example.com/test');

  try {
    // Send POST request to our own domain (should be intercepted by SW)
    const response = await fetch('/', {
      method: 'POST',
      body: formData,
    });

    console.log('Test share response:', response);

    if (response.redirected) {
      console.log('Redirected to:', response.url);
      window.location.href = response.url;
    } else {
      console.log('No redirect happened - SW might not be working');
    }
  } catch (error) {
    console.error('Test share failed:', error);
  }
});

// Clear Service Worker completely
clearSwBtn.addEventListener('click', async () => {
  console.log('Clearing service worker...');

  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      console.log('Unregistering SW:', registration.scope);
      await registration.unregister();
    }

    // Clear all caches
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      console.log('Deleting cache:', cacheName);
      await caches.delete(cacheName);
    }

    alert('Service worker and caches cleared! Reloading page...');
    window.location.reload();
  } catch (error) {
    console.error('Error clearing SW:', error);
    alert('Error clearing service worker: ' + error.message);
  }
});

function saveToSheet() {
  const items = Array.from(urlList.querySelectorAll('li')).map(
    (li) => li.textContent,
  );
  const values = items.map((item) => [item, '', '']);
  const params = {
    spreadsheetId: window.CONFIG.SPREADSHEET_ID,
    range: `Sheet1!A2:C${values.length + 1}`,
    valueInputOption: 'RAW',
  };
  const body = { values };
  gapi.client.sheets.spreadsheets.values
    .update(params, body)
    .then((response) => {
      console.log('Saved', response);
      // alert('Saved to Google Sheets.');
    })
    .catch((error) => console.error('Error saving data', error));
}

function loadFromSheet() {
  const params = {
    spreadsheetId: window.CONFIG.SPREADSHEET_ID,
    range: 'Sheet1!A2:A',
  };
  gapi.client.sheets.spreadsheets.values
    .get(params)
    .then((response) => {
      const rows = response.result.values || [];
      urlList.innerHTML = '';
      rows.forEach((row) => {
        const li = document.createElement('li');
        li.textContent = row[0];
        urlList.appendChild(li);
      });
    })
    .catch((error) => console.error('Error loading data', error));
}

// Handle Web Share Target POST redirect
function handleShareTarget() {
  console.log('Checking for share target data...');
  console.log('Current URL:', window.location.href);
  console.log('Search params:', window.location.search);
  console.log('Hash:', window.location.hash);

  const queryParams = new URLSearchParams(window.location.search);

  // Check if this was a share target redirect
  if (queryParams.has('share_target')) {
    console.log('🎯 Share target detected!');

    // Show mobile-friendly alert for debugging
    if (navigator.userAgent.match(/Mobile|Android|iPhone/i)) {
      alert('📱 Share detected! Check console for details.');
    }

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const url = hashParams.get('url');
    const title = hashParams.get('title');
    const text = hashParams.get('text');

    console.log('📦 Shared content received:', { title, text, url });

    // Show detailed mobile alert
    if (navigator.userAgent.match(/Mobile|Android|iPhone/i)) {
      alert(`📋 Shared data:\nTitle: ${title}\nText: ${text}\nURL: ${url}`);
    }

    if (url) {
      console.log('➕ Adding URL to list:', url);
      const li = document.createElement('li');
      // Create a link for the URL
      const a = document.createElement('a');
      a.href = url;
      a.textContent = title || url; // Use title, fallback to URL
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);

      // If there's extra text, add it as a paragraph
      if (text && text !== url && text.trim()) {
        const p = document.createElement('p');
        p.textContent = text;
        p.style.fontSize = '0.9em';
        p.style.color = '#666';
        p.style.margin = '5px 0 0 0';
        li.appendChild(p);
      }

      urlList.appendChild(li);

      console.log(
        '⏰ Waiting 3 seconds before cleaning URL (for debugging)...',
      );

      // Delay URL cleanup so you can see the URL change
      setTimeout(() => {
        console.log('🧹 Cleaning up URL now');
        history.replaceState(null, '', window.location.pathname);
        updateCurrentUrlDisplay(); // Update display after cleanup
      }, 3000);
    } else {
      console.log('❌ No URL found in shared data');

      // Even without URL, delay cleanup for debugging
      setTimeout(() => {
        console.log('🧹 Cleaning up URL (no URL found)');
        history.replaceState(null, '', window.location.pathname);
        updateCurrentUrlDisplay();
      }, 3000);
    }
  }
}

// Call the function when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleShareTarget);
} else {
  handleShareTarget();
}

// Service Worker Debug Info
function checkServiceWorkerStatus() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        console.log('Service Worker is ready:', registration);
        console.log('Service Worker scope:', registration.scope);
        console.log('Service Worker active:', registration.active);

        // Add status to page for debugging
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `
        position: fixed; 
        top: 10px; 
        right: 10px; 
        background: #f0f0f0; 
        padding: 10px; 
        border: 1px solid #ccc; 
        font-size: 12px;
        max-width: 300px;
        z-index: 1000;
      `;
        statusDiv.innerHTML = `
        <strong>SW Status:</strong><br>
        Scope: ${registration.scope}<br>
        Active: ${!!registration.active}<br>
        State: ${registration.active?.state || 'none'}<br>
        <button onclick="this.parentElement.remove()">Close</button>
      `;
        document.body.appendChild(statusDiv);
      })
      .catch((err) => {
        console.error('Service Worker not ready:', err);
      });

    // Listen for service worker updates
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Message from SW:', event.data);

      // Show alerts for mobile debugging
      if (event.data.type === 'SHARE_TARGET_DETECTED') {
        alert(event.data.message);
      }
    });
  }
}

// Run the check
checkServiceWorkerStatus();

// Display current URL with all params in PWA mode
function updateCurrentUrlDisplay() {
  const currentUrlDiv = document.getElementById('current-url');
  if (!currentUrlDiv) {
    console.log('current-url div not found');
    return;
  }
  const url = window.location.href;
  console.log('Setting current-url div to:', url);
  currentUrlDiv.textContent = url || '[No URL found]';
}

// Update on load (after DOM is ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateCurrentUrlDisplay);
} else {
  updateCurrentUrlDisplay();
}
// Update on hash or search param changes
window.addEventListener('hashchange', updateCurrentUrlDisplay);
window.addEventListener('popstate', updateCurrentUrlDisplay);

// Clear Service Worker button handler
clearSwBtn.addEventListener('click', async () => {
  if ('serviceWorker' in navigator) {
    try {
      // Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }

      // Clear all caches
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      alert('Service Worker and cache cleared! Page will reload.');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing SW:', error);
      alert('Error clearing service worker: ' + error.message);
    }
  } else {
    alert('Service Workers not supported');
  }
});

// --- Service Worker Log Viewer ---

// Key for localStorage
const SW_LOGS_KEY = 'swLogs';

// Utility: get logs from localStorage
const getSwLogs = () => {
  try {
    return JSON.parse(localStorage.getItem(SW_LOGS_KEY)) || [];
  } catch {
    return [];
  }
};

// Utility: save logs to localStorage
const saveSwLogs = (logs) => {
  localStorage.setItem(SW_LOGS_KEY, JSON.stringify(logs));
};

// Utility: add a log
const addSwLog = (log) => {
  const logs = getSwLogs();
  logs.push({
    message: log,
    time: new Date().toISOString(),
  });
  saveSwLogs(logs);
  renderSwLogs();
};

// Utility: clear logs
const clearSwLogs = () => {
  localStorage.removeItem(SW_LOGS_KEY);
  renderSwLogs();
};

// Render logs in a log area
const renderSwLogs = () => {
  let logArea = document.getElementById('sw-log-area');
  if (!logArea) {
    logArea = document.createElement('div');
    logArea.id = 'sw-log-area';
    logArea.style.cssText = 'background:#111;color:#0f0;padding:1em;font-family:monospace;max-height:200px;overflow:auto;margin:1em 0;';
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear SW Logs';
    clearBtn.onclick = clearSwLogs;
    clearBtn.style.cssText = 'margin-bottom:0.5em;display:block;';
    logArea.appendChild(clearBtn);
    document.body.insertBefore(logArea, document.body.firstChild);
  } else {
    // Remove all except the button
    while (logArea.childNodes.length > 1) logArea.removeChild(logArea.lastChild);
  }
  const logs = getSwLogs();
  logs.forEach((entry) => {
    const div = document.createElement('div');
    div.textContent = `[${entry.time}] ${typeof entry.message === 'string' ? entry.message : JSON.stringify(entry.message)}`;
    logArea.appendChild(div);
  });
};

// Listen for SW_LOG messages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Message from SW:', event.data);
    if (event.data && event.data.type === 'SW_LOG') {
      event.data.args.forEach(addSwLog);
    }
  });
}

// Show logs on page load
window.addEventListener('DOMContentLoaded', renderSwLogs);
