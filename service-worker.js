// ============================================================
//  service-worker.js — Acadèmia Impulsa't PWA
//  Gestiona el cache per a funcionament offline bàsic
// ============================================================

const CACHE_NAME = 'impulsat-v1';

// Recursos essencials que es guarden al cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/supabase-config.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// ── Install: guarda assets estàtics ───────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => {
        // Intenta afegir cada asset, però no bloqueja si falla un
        return cache.add(url).catch(() => {
          console.warn('[SW] No s\'ha pogut guardar en cache:', url);
        });
      }));
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: neteja caches antics ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estratègia Network First, Cache Fallback ───────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Les peticions a Supabase sempre van per xarxa
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Sense connexió. Les dades no estan disponibles offline.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Per a la resta: Network First amb fallback a cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guarda una còpia al cache si la resposta és vàlida
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Si no hi ha xarxa, serveix des del cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback per a navegació: retorna index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Sense connexió', { status: 503 });
        });
      })
  );
});

// ── Missatge de versió ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
