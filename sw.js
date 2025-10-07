/**
 * Unified Service Worker (v3) - GitHub Pages Compatible
 * - GitHub Pages deployment optimizations
 * - Enhanced caching for deployment environments
 * - Fallback handling for restricted environments
 */
const CACHE_NAME = 'cv-gen-cache-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=2025-10-07.3',
  './script.js?v=2025-10-07.3',
  './html2pdf.bundle.min.js',
  './github-pages-fix.js'
];
const CDN_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

// On install cache everything needed for full offline export capability
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try { await cache.addAll(CORE_ASSETS); } catch (e) { /* ignore */ }
      // Try caching CDN copy too (best-effort)
      try { await cache.add(CDN_PDF); } catch (e) { /* offline or blocked */ }
      await self.skipWaiting();
    })()
  );
});

// Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Strategy:
//  - html2pdf scripts: cache-first (serve even offline)
//  - Core same-origin GET: stale-while-revalidate
//  - Others: network-first fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;  // ignore non-GET

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isPdfEngine = request.url.includes('html2pdf.bundle.min.js');

  if (isPdfEngine) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
            if (resp.ok) {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return resp;
        }).catch(() => cached || new Response('', { status: 503, statusText: 'PDF engine unavailable offline' }));
      })
    );
    return;
  }

  if (isSameOrigin) {
    // Stale-while-revalidate
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request, { ignoreSearch: true });
        const networkPromise = fetch(request).then(resp => {
          if (resp.ok) {
            cache.put(request, resp.clone());
          }
          return resp;
        }).catch(() => null);
        return cached || networkPromise || fetch(request); // fallback network if nothing cached
      })()
    );
    return;
  }

  // Default: network-first, fallback to cache
  event.respondWith(
    fetch(request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return resp;
    }).catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
