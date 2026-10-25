// Keeps the app's own files on the phone so it opens without a connection.
const CACHE = 'vob-shell-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'test-tone.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// network first for the page (so updates arrive), cache first for everything else
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // audio is requested in byte ranges; let those go to the network, the cached copy covers offline
  if (req.headers.get('range')){
    e.respondWith(fetch(req).catch(() => caches.match(req.url, { ignoreSearch: true }).then(r => r ? rangeFrom(r, req.headers.get('range')) : Response.error())));
    return;
  }
  if (req.mode === 'navigate'){
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
async function rangeFrom(resp, range){
  const buf = await resp.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': resp.headers.get('Content-Type') || 'audio/mpeg',
    'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
