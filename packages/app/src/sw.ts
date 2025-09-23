/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Add swLog function for debugging
function swLog(...args: unknown[]) {
  // Send logs to all clients (open tabs)
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_LOG', args });
    });
  });
}

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

let allowlist: RegExp[] | undefined
// in dev mode, we disable precaching to avoid caching issues
if (import.meta.env.DEV)
  allowlist = [/^\/$/]

// Handle Web Share Target BEFORE NavigationRoute
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only log relevant requests to avoid spam
  if (event.request.method === 'POST' || url.pathname === '/') {
    swLog('Fetch event:', event.request.method, event.request.url);
  }

  // Handle Web Share Target POST - use consistent BASE_PATH
  const basePath = import.meta.env.BASE_PATH || '/';
  // Handle both with and without trailing slash
  const isShareTarget = event.request.method === 'POST' &&
    (url.pathname === basePath || url.pathname === basePath.slice(0, -1));
  if (isShareTarget) {
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
              new URL(url as string); // Will throw if invalid URL
              validUrl = url as string;
              swLog('✅ Valid URL found:', validUrl);
            } catch {
              swLog('❌ Invalid URL format:', url);
            }
          }

          // Build redirect URL with all available data
          const redirectUrl = `${self.location.origin}${basePath}?share_target=1#title=${encodeURIComponent(title as string)}&text=${encodeURIComponent(text as string)}&url=${encodeURIComponent(validUrl)}`;
          swLog('🔄 Redirecting to:', redirectUrl);

          return Response.redirect(redirectUrl, 303);
        } catch (error) {
          swLog('❌ Error handling share:', error);
          swLog('Error details:', error instanceof Error ? error.message : String(error));
          swLog('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          
          // Return to app with error info for debugging
          return Response.redirect(`${self.location.origin}${basePath}?share_target=1#error=processing_failed`, 303);
        }
      })(),
    );
    return;
  }
});

// Register NavigationRoute AFTER fetch event listener
// to allow work offline
registerRoute(new NavigationRoute(
  createHandlerBoundToURL('index.html'),
  { allowlist },
))

self.skipWaiting()
clientsClaim()
