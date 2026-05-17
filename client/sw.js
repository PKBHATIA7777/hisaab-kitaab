/* client/sw.js — Production-Grade Service Worker */
const CACHE_VERSION = "v4"; // Increment on every deploy
const SHELL_CACHE = `hk-shell-${CACHE_VERSION}`;
const DATA_CACHE = `hk-data-${CACHE_VERSION}`;

// Assets that form the "app shell" — loaded on install
const SHELL_ASSETS = [
  "/offline.html",
  "/css/base.css",
  "/css/chapter-page.css",
  "/css/features.css",
  "/js/core/sanitize.js",
  "/js/core/csrf.js",
  "/js/core/session.js",
  "/js/core/storage.js",
  "/js/pwa/install-manager.js",
  "/js/main.js",
  "/manifest.json",
];

// ── INSTALL: Cache app shell, do NOT skipWaiting ────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // addAll is all-or-nothing — if any file fails, install fails
      // We use individual adds with error handling for resilience
      const results = await Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`SW: Failed to cache ${url}:`, err.message);
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > SHELL_ASSETS.length * 0.2) {
        // More than 20% failed — abort install to avoid broken SW
        throw new Error(`Too many cache failures: ${failed.length}/${SHELL_ASSETS.length}`);
      }
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
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request, { credentials: "include" }).catch(() => {
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