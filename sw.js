/* ===================================================================
   kml2gpx — service worker "brise-caches"
   Stratégie : network-first.
   - À chaque requête, le réseau est tenté en premier et la réponse
     fraîche remplace systématiquement celle en cache.
   - Le cache n'intervient qu'en secours, hors-ligne.
   - À chaque activation, TOUTES les anciennes versions de cache sont
     détruites : changer CACHE_VERSION à chaque déploiement garantit
     qu'aucun client ne reste bloqué sur une ressource périmée.
   =================================================================== */

const CACHE_VERSION = 'v1';                     // <-- à incrémenter à chaque déploiement
const CACHE_NAME = `kml2gpx-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/app.js',
  'icons/icon192.png',
  'icons/icon512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
