const CACHE_NAME = 'cv-gen-cache-v1';
const CDN_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
const ASSETS = [
  '/',
  './',
  '/index.html',
  '/styles.css',
  '/script.js',
  CDN_PDF
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        try {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone)).catch(() => {});
        } catch (e) {}
        return resp;
      }).catch(() => cached);
    })
  );
});
/**
 * Simple service worker to enable offline usage and cache critical assets,
 * including the html2pdf.js CDN so Export PDF works without network.
 */
const CACHE_NAME = 'cv-gen-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css?v=2025-09-20.2',
  '/script.js?v=2025-09-20.2',
  // Pre-cache the CDN script so it works offline
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) return caches.delete(key);
    }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Try cache first for GET requests
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          // Cache a copy of same-origin or the specific CDN script
          const shouldCache = res.ok && (new URL(req.url).origin === self.location.origin || req.url.includes('html2pdf.bundle.min.js'));
          if (shouldCache) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        }).catch(() => cached || Response.error());
      })
    );
  }
});
