const CACHE_NAME = 'basetrack-cache-v10';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-48x48.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/images/basetrack-icon-transparent.png',
  '/images/basetrack-logo-transparent.png'
];

// Message Event: Allow web clients to trigger instant activation
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    console.log('[ServiceWorker] SKIP_WAITING recibido desde cliente web');
    self.skipWaiting();
  }
});

// Install Event: Cache Core Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Precaching fresh app shell assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up all outdated caches (v1 to v9)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing stale cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Offline-first for shell & navigation, network-first for APIs and Icons
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests, browser extensions, version checks, and Vite dev server requests
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.port === '4200' ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('@fs') ||
    url.pathname.includes('/.angular/') ||
    url.pathname.endsWith('/version.json')
  ) {
    return;
  }

  // 1. Navigation requests (SPA HTML fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 2. API Requests: Fast Network with 3.5s Timeout -> Immediate Cache Fallback (Never hang 25s+)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);

        // Controller with 3500ms timeout against sleeping/cold backend
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), 3500);

        try {
          const networkResponse = await fetch(request, { signal: controller.signal });
          clearTimeout(timerId);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          clearTimeout(timerId);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cached response exists, re-throw to allow component offline handlers to activate
          throw err;
        }
      })()
    );
    return;
  }

  // 3. Icons, Favicon, and Manifest: Network-first to ensure brand updates immediately
  if (url.pathname.includes('favicon') || url.pathname.includes('/icons/') || url.pathname.includes('manifest')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 4. Static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
