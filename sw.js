/**
 * Enhanced Service Worker (v4) - Improved Caching
 * - Smart caching strategy with versioning
 * - Better offline support
 * - Cache invalidation and updates
 * - Performance optimizations
 */
const CACHE_NAME = 'cv-gen-cache-v4';
const CACHE_VERSION = '2025-10-07-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  `./styles.css?v=${CACHE_VERSION}`,
  `./script.js?v=${CACHE_VERSION}`,
  './html2pdf.bundle.min.js',
  './github-pages-fix.js',\n  './enhanced-print.js'
];
const CDN_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
const JSDELIVR_PDF = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Enhanced install with better error handling
self.addEventListener('install', (event) => {
  console.log('SW: Installing with enhanced caching...');
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        
        // Cache core assets
        console.log('SW: Caching core assets...');
        for (const asset of CORE_ASSETS) {
          try {
            await cache.add(asset);
            console.log('SW: Cached:', asset);
          } catch (e) {
            console.warn('SW: Failed to cache:', asset, e);
          }
        }
        
        // Try caching PDF libraries
        console.log('SW: Caching PDF libraries...');
        const pdfLibs = [CDN_PDF, JSDELIVR_PDF];
        for (const lib of pdfLibs) {
          try {
            await cache.add(lib);
            console.log('SW: Cached PDF lib:', lib);
          } catch (e) {
            console.warn('SW: PDF lib cache failed:', lib, e);
          }
        }
        
        await self.skipWaiting();
        console.log('SW: Installation complete');
      } catch (error) {
        console.error('SW: Installation failed:', error);
      }
    })()
  );
});

// Enhanced activation with cache cleanup
self.addEventListener('activate', (event) => {
  console.log('SW: Activating with cache cleanup...');
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames
          .filter(name => name.startsWith('cv-gen-cache-') && name !== CACHE_NAME)
          .map(name => {
            console.log('SW: Deleting old cache:', name);
            return caches.delete(name);
          });
        
        await Promise.all(deletePromises);
        await self.clients.claim();
        console.log('SW: Activation complete');
      } catch (error) {
        console.error('SW: Activation failed:', error);
      }
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
