// Keeps a copy of the app on the phone so it opens offline. Online, it always fetches the
// latest files (with a short timeout for patchy gym signal) and refreshes the copy as it goes.
// Your data isn't here; it lives in IndexedDB (see js/sqlite.js).

const CACHE = 'show-up-club';
const TIMEOUT_MS = 3000;

// Every file the app needs. ./deploy refuses to run if a file in public/ is missing here.
const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'fonts/fonts.css',
  'fonts/dm-sans-latin.woff2',
  'fonts/dm-sans-latin-ext.woff2',
  'fonts/fraunces-latin.woff2',
  'fonts/fraunces-latin-ext.woff2',
  'fonts/fraunces-italic-latin.woff2',
  'fonts/fraunces-italic-latin-ext.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'vendor/sql-wasm.js',
  'vendor/sql-wasm.wasm',
  'js/app.js',
  'js/api.js',
  'js/backend.js',
  'js/dates.js',
  'js/db.js',
  'js/reactive.js',
  'js/seed.js',
  'js/sqlite.js',
  'js/store.js',
  'js/views/chrome.js',
  'js/views/history.js',
  'js/views/home.js',
  'js/views/library.js',
  'js/views/settings.js',
  'js/views/sheet.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const url = request.url.split('#')[0];
  const network = fetch(url, { cache: 'no-cache' }).then((response) => {
    if (response.ok) cache.put(url, response.clone());
    return response;
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS));

  try {
    return await Promise.race([network, timeout]);
  } catch {
    const cached =
      (await cache.match(url, { ignoreSearch: true })) ??
      (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    return cached ?? network; // nothing cached: keep waiting for the network
  }
}
