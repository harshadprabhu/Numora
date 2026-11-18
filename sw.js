// Numora service worker: offline support. Pages network-first; assets cache-first.
const VERSION = 'numora-v3';
const CORE = ['./', 'index.html', 'assets/styles.css', 'assets/app.js', 'assets/calcs.js', 'assets/countries.js', 'assets/engine.js',
  'assets/i18n.js', 'assets/numi.js', 'assets/numi-brain.js', 'assets/parser.js', 'assets/ui.js', 'assets/favicon.svg', 'assets/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req)));
});
