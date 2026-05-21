/* client/sw.js — Production-Grade Service Worker */
const CACHE_VERSION = "v6"; // ← INCREMENT THIS ON EVERY DEPLOY

// Deployment checklist reminder (logged to DevTools console)
// This helps catch forgotten cache version bumps during development
if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
  console.log(`%c[SW] Running cache version: ${CACHE_VERSION}`, 'color: #d000ff; font-weight: bold');
  console.log('%c[SW] REMEMBER: Increment CACHE_VERSION before every production deploy!', 'color: orange');
}

const SHELL_CACHE = `hk-shell-${CACHE_VERSION}`;
const DATA_CACHE = `hk-data-${CACHE_VERSION}`;

// Core assets that MUST be cached for offline fallback to work.
// Keep this list small and reliable — only files that definitely exist.
// Aggressive caching of app files happens via the stale-while-revalidate
// strategy in the fetch handler below.
const SHELL_ASSETS = [
  "/offline.html",
  "/manifest.json",
];

// Additional assets to warm-cache opportunistically (failures don't block SW install)
const WARM_CACHE_ASSETS = [
  "/css/base.css",
  "/css/chapter-page.css",
  "/css/features.css",
  "/js/core/sanitize.js",
  "/js/core/storage.js",
  "/js/core/csrf.js",
  "/js/core/session.js",
  "/js/main.js",
  "/js/pwa-install.js",
  "/js/pwa/offline-queue.js",  // ← Added: offline request queue for background sync
];

// ── INSTALL: Cache app shell, do NOT skipWaiting ────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // Critical assets — must succeed or SW install fails
      // (these are minimal so failure is unlikely)
      await cache.addAll(SHELL_ASSETS);
      
      // Warm cache — best effort, failures don't block installation
      const warmResults = await Promise.allSettled(
        WARM_CACHE_ASSETS.map(url =>
          cache.add(url).catch(err => {
            // Log but don't throw — these are optional
            console.warn(`SW warm-cache miss for ${url}: ${err.message}`);
          })
        )
      );
      
      const warmed = warmResults.filter(r => r.status === 'fulfilled').length;
      console.log(`SW installed: ${warmed}/${WARM_CACHE_ASSETS.length} warm-cache assets ready`);
    })
    // NOTE: No self.skipWaiting() here — controlled activation
  );
});

// ── ACTIVATE: Clean old caches, take control only when safe ──
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((k) => (k.startsWith("hk-shell-") || k.startsWith("hk-data-")) && k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      );
      // Only claim clients after caches are ready
      // skipWaiting() is called via message from the update toast
      // self.clients.claim() is safe here since old caches are gone
      return self.clients.claim();
    })
  );
});

// ── FETCH: Strategy per resource type ────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // 1. API calls — Network only, no cache
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

  // 2. HTML pages — Network first, fall back to offline page
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Update cache in background for next visit
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(e.request, clone));
          return response;
        })
        .catch(async () => {
          // Check if we have this page cached
          const cached = await caches.match(e.request);
          if (cached) return cached;
          // Serve offline page
          return caches.match("/offline.html");
        })
    );
    return;
  }

  // 3. JS/CSS/Fonts — Stale-while-revalidate
  // Serve from cache immediately, update in background
  if (url.pathname.match(/\.(js|css|woff2?)$/)) {
    e.respondWith(
      caches.open(SHELL_CACHE).then((cache) => {
        return cache.match(e.request).then((cached) => {
          const fetchPromise = fetch(e.request)
            .then((response) => {
              if (response.ok) cache.put(e.request, response.clone());
              return response;
            })
            .catch(() => cached); // Network failed, serve stale

          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // 4. Images — Cache first, network fallback
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

  // 5. Everything else — Network first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ── MESSAGES ─────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting(); // Only called when user clicks "Reload" in update toast
  }
  if (e.data?.type === "PING") {
    e.ports[0]?.postMessage({ type: "PONG", version: CACHE_VERSION });
  }
});