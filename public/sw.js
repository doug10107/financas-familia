const CACHE_NAME = 'financas-familia-v2';

const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Network-first strategy: try network, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful same-origin responses (excluding API calls)
        if (
          networkResponse.ok &&
          event.request.url.startsWith(self.location.origin) &&
          !event.request.url.includes('/api/')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For navigation requests, try to serve the cached start page
          if (event.request.mode === 'navigate') {
            return caches.match('/').then((r) => r || new Response('Offline', { status: 503 }));
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
