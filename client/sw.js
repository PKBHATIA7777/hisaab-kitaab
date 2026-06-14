/* client/sw.js — Production-Grade Service Worker */

// Cache version strategy: increment the number manually when you deploy
// changes to app shell files (HTML, CSS, JS). The date suffix is set
// automatically at server startup via the /sw.js route — no build step needed.
// If you forget to bump the number, the date suffix still forces a cache bust
// on the first deploy of each new day.
const CACHE_VERSION = "v13"; // ← Bumped to force cache bust on all devices

const SHELL_CACHE = `hk-shell-${CACHE_VERSION}`;
const DATA_CACHE = `hk-data-${CACHE_VERSION}`;

// Core assets that MUST be cached for offline fallback to work.
// Keep this list small and reliable — only files that definitely exist.
// HTML pages are intentionally NOT pre-cached — they are served network-first
// so users always get the latest version immediately after a deploy.
const SHELL_ASSETS = [
  "/offline.html",
];

// Additional assets to warm-cache opportunistically (failures don't block SW install)
// NOTE: These are cached with no-cache headers from Vercel, so the SW will
// always revalidate them on the next fetch — serving fresh files after every deploy.
const WARM_CACHE_ASSETS = [
  "/css/base.css",
  "/css/chapter-page.css",
  "/css/features.css",
  "/js/core/sanitize.js",
  "/js/core/storage.js",
  "/js/core/csrf.js",
  "/js/core/session.js",
  "/js/core/api-cache.js",
  "/js/main.js",
  "/js/pwa/install-manager.js",
  "/js/pwa/offline-queue.js",
];

// ── INSTALL: Force immediate activation, cache app shell ────────────
self.addEventListener("install", (e) => {
  // Force this SW to become active immediately without waiting
  self.skipWaiting();
  
  e.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.addAll(SHELL_ASSETS);
      
      const warmResults = await Promise.allSettled(
        WARM_CACHE_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`SW warm-cache miss for ${url}: ${err.message}`);
          })
        )
      );
      
      const warmed = warmResults.filter(r => r.status === 'fulfilled').length;
      console.log(`SW installed: ${warmed}/${WARM_CACHE_ASSETS.length} warm-cache assets ready`);
    })
  );
});

// ── ACTIVATE: Clean old caches, take control immediately ──
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((k) => (k.startsWith("hk-shell-") || k.startsWith("hk-data-")) && k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      );
      // Claim all open clients immediately so the new SW serves them
      // without requiring a page reload.
      return self.clients.claim();
    })
  );
});

// ── FETCH: Strategy per resource type ────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // 1. API calls — Network only, no cache
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(
          JSON.stringify({ ok: false, message: "You are offline. Please reconnect." }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "X-Served-By": "service-worker-offline",
            },
          }
        );
      })
    );
    return;
  }

  // 2. HTML pages — Network first, NO cache storage.
  // Always fetch fresh HTML from the server. This ensures users get the
  // latest page immediately after a deploy — no stale HTML ever served.
  // Falls back to offline page only when truly offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .catch(async () => {
          // Truly offline — serve the offline page
          const cached = await caches.match(e.request);
          if (cached) return cached;
          return caches.match("/offline.html");
        })
    );
    return;
  }

  // 3. JS/CSS — Network first with cache fallback.
  // Tries network; if it fails (offline) serves from cache so the app shell works.
  // Cache is updated on every successful network response.
  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        try {
          const response = await fetch(e.request);
          if (response.ok) {
            cache.put(e.request, response.clone());
          }
          return response;
        } catch (_) {
          // Offline — serve from cache
          const cached = await cache.match(e.request);
          return cached || new Response('/* offline */', {
            headers: { 'Content-Type': 'text/javascript' }
          });
        }
      })
    );
    return;
  }

  // 4. Fonts — Cache first, network fallback (fonts never change)
  if (url.pathname.match(/\.(woff2?)$/) || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(SHELL_CACHE).then((cache) => {
        return cache.match(e.request).then((cached) => {
          return cached || fetch(e.request).then((response) => {
            if (response.ok) cache.put(e.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // 5. Images — Cache first, network fallback
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)) {
    e.respondWith(
      caches.open(SHELL_CACHE).then((cache) => {
        return cache.match(e.request).then((cached) => {
          return cached || fetch(e.request).then((response) => {
            if (response.ok) cache.put(e.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // 6. Everything else — Network first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ── MESSAGES ─────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  // SKIP_WAITING kept for backward compatibility but no longer needed
  // since install now calls skipWaiting() automatically
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (e.data?.type === "PING") {
    e.ports[0]?.postMessage({ type: "PONG", version: CACHE_VERSION });
  }
});