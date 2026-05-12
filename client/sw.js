// Cache version — increment this on every deployment
// Format: v{MAJOR}.{DEPLOY_TIMESTAMP} for easy debugging
const CACHE_VERSION = "v2";
const CACHE_NAME = `hisaab-kitaab-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/login.html",
  "/signup.html",
  "/chapter.html",
  "/about.html",
  "/privacy.html",
  "/css/base.css",
  "/css/features.css",
  "/js/main.js",
  "/js/dashboard.js",
  "/js/chapter.js",
  "/js/feature-settlements.js",
  "/js/feature-bulk-event.js",
  "/js/feature-categories.js",
  "/js/feature-creator-label.js",
  "/js/feature-personal-chapter.js",
  "/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("hisaab-kitaab-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache API calls
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ ok: false, message: "You are offline." }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    return;
  }

  // Network-first for HTML pages (always get latest app shell)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, toCache));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets (CSS, JS, images)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, toCache));
        return response;
      });
    })
  );
});

// Handle skip waiting message from the app
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});