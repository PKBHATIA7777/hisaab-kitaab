// client/sw.js
self.addEventListener('install', (e) => {
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim()); // Claim clients immediately
});

self.addEventListener('fetch', (e) => {
    // Pass through all requests normally to avoid breaking any API/Auth logic
    e.respondWith(fetch(e.request));
});