// sw.js — Service Worker untuk Diferensiasi
// Tujuan: bikin aplikasi bisa "dipasang" (PWA) dan tampilannya tetap muncul
// walau koneksi terputus sebentar. TIDAK membuat fitur generate bisa offline —
// itu tetap wajib online karena butuh Google Gemini di server.

const CACHE_NAME = 'diferensiasi-shell-v1';

// Hanya app shell (tampilan) yang di-cache. Sengaja TIDAK memasukkan /api/generate
// ke daftar ini, dan logic di bawah memastikan permintaan ke /api/ selalu lewat
// jaringan langsung, tidak pernah diambil dari cache.
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // Aturan #1 — WAJIB: permintaan ke API (proses generate) tidak pernah disentuh
  // service worker. Selalu langsung ke jaringan, apa adanya.
  if (url.pathname.startsWith('/api/')) {
    return; // biarkan browser menangani sendiri, tanpa campur tangan cache
  }

  // Selain itu (file tampilan): coba cache dulu supaya cepat & tetap tampil offline,
  // sambil diam-diam memperbarui cache dari jaringan kalau sedang online
  // (stale-while-revalidate).
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      const network = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      }).catch(function () {
        return cached; // offline & tidak ada di cache -> biarkan gagal wajar
      });
      return cached || network;
    })
  );
});
