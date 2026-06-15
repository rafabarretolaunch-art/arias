// ari PWA — service worker
const VERSION = 'ari-v11';
const SHELL = VERSION + '-shell';
const MEDIA = VERSION + '-media';

// "shell" de la app (se precachea en la instalación → arranque instantáneo + offline)
const SHELL_ASSETS = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'vendor/react.production.min.js',
  'vendor/react-dom.production.min.js',
  'fonts/MonaSans-Regular.ttf',
  'fonts/MonaSans-Medium.ttf',
  'fonts/MonaSans-SemiBold.ttf',
  'fonts/MonaSans_SemiExpanded-SemiBold.ttf',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const isMedia = (url) =>
  url.pathname.includes('/photos/') ||
  url.hostname === 'fonts.gstatic.com' ||
  url.hostname === 'fonts.googleapis.com';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // navegación → network-first, fallback a index.html cacheado (offline)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // fotos + google fonts → cache-first en cache de media
  if (isMedia(url)) {
    e.respondWith(
      caches.open(MEDIA).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // resto (mismo origen) → cache-first con fallback a red
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
