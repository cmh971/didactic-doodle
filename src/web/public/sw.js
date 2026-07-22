/* Minimal service worker — makes the dashboard installable as an app and gives
   a fast, offline-tolerant shell. Network-first for everything, falling back to
   cache so the app still opens without a connection. API calls are never cached. */
const CACHE = 'dash-shell-v1';
const SHELL = ['/dashboard', '/', '/style.css', '/app.js', '/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API / auth traffic — always hit the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') ||
      ['/login', '/callback', '/logout'].includes(url.pathname)) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/dashboard'))),
  );
});
