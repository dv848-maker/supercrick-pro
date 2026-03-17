// Sai-Crick Pro — Service Worker v3
const CACHE_NAME = 'sai-crick-pro-v3';
const ASSETS = [
  './index.html','./css/app.css','./css/scoring.css','./css/field.css','./css/components.css',
  './js/app.js','./js/db.js','./js/scoring.js','./js/scorecard.js','./js/field-positions.js',
  './js/player.js','./js/stats.js','./js/match.js','./js/search.js','./js/export.js',
  './js/history.js','./js/utils.js','./manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() =>
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'APP_UPDATED', version: CACHE_NAME }))
      )
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('open-meteo.com') || url.hostname.includes('nominatim')) return;
  if (e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(r => { caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r && r.status === 200) caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => e.request.destination === 'document' ? caches.match('./index.html') : undefined);
    })
  );
});
