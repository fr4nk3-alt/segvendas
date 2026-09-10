const CACHE = 'seg-vendas-v5-9-14';
self.addEventListener('install', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
