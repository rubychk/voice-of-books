// Keeps the app and the libraries it needs on the phone, so it opens without a connection.
// Books, audio and progress are kept by the app itself (IndexedDB) and in Google Drive.
const CACHE = 'vob-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'lib/pdf.min.js', 'lib/pdf.worker.min.js', 'lib/jszip.min.js'];
const CACHEABLE = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL);
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // the app page: newest from the network, the saved copy when offline
  if (req.mode === 'navigate' && url.origin === location.origin){
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // the app's own files and the libraries/fonts: saved copy first, refreshed in the background
  if (url.origin === location.origin || CACHEABLE.test(req.url)){
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    }));
  }
  // everything else (Google sign-in and Drive) goes straight to the network
});
