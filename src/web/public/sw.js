/* Service worker — installable dashboard shell (network-first) PLUS an offline
   audio cache so saved tracks play with no connection (e.g. on a plane).
   API calls are never cached; saved mp3s are served cache-first. */
const CACHE = 'dash-shell-v3';
const AUDIO = 'sentinel-audio-v1'; // populated by the audio player's "Save offline"
const SHELL = ['/dashboard', '/', '/style.css', '/app.js', '/icon-192.png', '/icon-512.png', '/manifest.json', '/audio-app', '/offline.html', '/offline.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  const keep = [CACHE, AUDIO]; // never delete the offline audio cache
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Saved audio → cache-first so it plays offline. Serve the cached full file
  // even for the media element's Range requests (ignoreVary/ignoreSearch).
  if (url.pathname.startsWith('/audio/')) {
    e.respondWith(
      caches.open(AUDIO)
        .then((c) => c.match(url.pathname, { ignoreVary: true, ignoreSearch: true }))
        .then((hit) => hit || fetch(req)),
    );
    return;
  }

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
      .catch(() => caches.match(req).then((r) => {
        if (r) return r;
        // A page navigation with nothing cached → show the branded offline page.
        if (req.mode === 'navigate') return caches.match('/offline.html') || caches.match('/dashboard');
        return caches.match('/dashboard');
      })),
  );
});
