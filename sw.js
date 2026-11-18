// Numora service worker: offline support. Pages: network first; assets: cache first.
const VERSION = 'numora-v2';
const CORE = ['./', 'index.html', 'calc.html', 'mortgage.html', 'debt.html', 'ask.html', 'saved.html', 'assets/styles.css',
  'assets/engine.js', 'assets/calcs.js', 'assets/locale.js', 'assets/ui.js', 'assets/parser.js', 'assets/insights.js',
  'assets/shell.js', 'assets/numi.js', 'assets/numi-brain.js', 'assets/home.js', 'assets/app-calc.js', 'assets/app-mortgage.js',
  'assets/app-debt.js', 'assets/favicon.svg', 'assets/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })));
});
