const CACHE_NAME = 'readitlater-cache-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/config.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  console.log('[SW] Fetch event:', event.request.method, event.request.url);

  // Handle Web Share Target POST - do not cache
  if (event.request.method === 'POST' && new URL(event.request.url).pathname === '/') {
    console.log('[SW] Handling Web Share Target POST');
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const title = formData.get('title') || '';
          const url = formData.get('text') || '';
          console.log('[SW] Received share:', { title, text, url });
          
          try {
            new URL(url); // Will throw if invalid URL
            const redirectUrl = `/?share_target=1#title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
            console.log('[SW] Redirecting to:', redirectUrl);
            return Response.redirect(redirectUrl, 303);
          } catch (e) {
            console.log('[SW] Invalid URL, not redirecting');
            return Response.redirect('/', 303);
          }
        } catch (error) {
          console.error('[SW] Error handling share:', error);
          return Response.redirect('/', 303);
        }
      })()
    );
    return;
  }
  
  // For other requests, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('[SW] Found in cache:', event.request.url);
          return response;
        }
        console.log('[SW] Not in cache, fetching:', event.request.url);
        return fetch(event.request);
      })
  );
}); 