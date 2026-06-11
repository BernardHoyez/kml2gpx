
const CACHE="kml2gpx-v3";
const ASSETS=["./","./index.html","./app.js","./style.css","./manifest.json"];

self.addEventListener("install",e=>{
self.skipWaiting();
e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener("activate",e=>{
e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE&&caches.delete(k)))));
self.clients.claim();
});

self.addEventListener("fetch",e=>{
e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
