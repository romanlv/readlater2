const CACHE_NAME = 'readitlater-cache-v9';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/config.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Add swLog function at the top
function swLog(...args) {
  // Send logs to all clients (open tabs)
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_LOG', args });
    });
  });
  // Also log to SW console for when DevTools is open
  // console.log('[SW]', ...args);
}

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
        return self.skipWaiting();
      }),
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  swLog('Fetch event:', event.request.method, event.request.url);

  // Handle Web Share Target POST - do not cache
  if (
    event.request.method === 'POST' &&
    new URL(event.request.url).pathname === '/'
  ) {
    swLog('✅ Web Share Target POST detected!');
    swLog('Request URL:', event.request.url);
    swLog('Request method:', event.request.method);

    event.respondWith(
      (async () => {
        try {
          swLog('📝 Extracting form data...');
          const formData = await event.request.formData();

          // Log all form data for debugging
          swLog('📋 All form entries:');
          for (const [key, value] of formData.entries()) {
            swLog(`   ${key}: ${value}`);
          }

          const title = formData.get('title') || '';
          const text = formData.get('text') || '';
          const url = formData.get('url') || formData.get('text') || '';

          swLog('🎯 Extracted data:', { title, text, url });

          // Try to extract a valid URL
          let validUrl = '';
          if (url) {
            try {
              new URL(url); // Will throw if invalid URL
              validUrl = url;
              swLog('✅ Valid URL found:', validUrl);
            } catch (e) {
              swLog('❌ Invalid URL format:', url);
            }
          }

          // Build redirect URL with all available data
          const redirectUrl = `/?share_target=1#title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&url=${encodeURIComponent(validUrl)}`;
          swLog('🔄 Redirecting to:', redirectUrl);

          return Response.redirect(redirectUrl, 303);
        } catch (error) {
          swLog('❌ Error handling share:', error);
          return Response.redirect(
            '/?share_target=1#error=processing_failed',
            303,
          );
        }
      })(),
    );
    return;
  }

  // For other requests, use cache-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        // console.log('[SW] Found in cache:', event.request.url);
        return response;
      }
      // console.log('[SW] Not in cache, fetching:', event.request.url);
      return fetch(event.request);
    }),
  );
});
