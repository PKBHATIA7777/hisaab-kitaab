/* client/js/core/api-cache.js
 *
 * In-memory stale-while-revalidate cache for apiFetch.
 *
 * Rules:
 *  - GET requests only — mutations are never cached.
 *  - Cache is keyed by the full API path string (e.g. "/chapters").
 *  - Each entry has a TTL. After TTL expires the entry is "stale".
 *  - Stale entries are served immediately AND a background revalidation
 *    fetch is fired so the next render gets fresh data.
 *  - Any POST/PUT/PATCH/DELETE to a path invalidates related cache keys.
 *  - The cache lives only in memory — it is cleared on page reload.
 *    This is intentional: we never want to serve truly stale data across
 *    sessions, only within a single navigation session.
 *
 * TTLs (milliseconds):
 *  /auth/me          — 120 s  (user profile rarely changes mid-session)
 *  /chapters         — 60 s   (dashboard list)
 *  /chapters/:id     — 30 s   (chapter detail + members)
 *  /settlements      —  5 s   (settlement data must be near-real-time)
 *  /expenses/...     — 30 s   (expense list, summary)
 *  /friends          — 300 s  (address book, very rarely changes)
 *  /categories       — 600 s  (system + custom categories)
 *  everything else   — 20 s   (safe default)
 */

const ApiCache = (() => {
  const DB_NAME = 'HisaabKitaabCache';
  const DB_VERSION = 1;
  const STORE_NAME = 'api_responses';

  let dbPromise = null;

  function initDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return dbPromise;
  }

  async function idbGet(key) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("IndexedDB get error:", e);
      return null;
    }
  }

  async function idbPut(key, value) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("IndexedDB put error:", e);
    }
  }

  async function idbDelete(key) {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("IndexedDB delete error:", e);
    }
  }

  async function idbKeys() {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("IndexedDB keys error:", e);
      return [];
    }
  }

  async function idbClear() {
    try {
      const db = await initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("IndexedDB clear error:", e);
    }
  }

  // ── TTL rules ────────────────────────────────────────────────
  const TTL_RULES = [
    { pattern: /^\/auth\/me$/,                    ttl: 120_000 },
    { pattern: /^\/chapters$/,                    ttl:  60_000 },
    { pattern: /^\/chapters\/[^/]+$/,             ttl:  30_000 },
    // Settlements must never be stale longer than 5 s — financial accuracy is critical
    { pattern: /\/settlements/,                   ttl:   5_000 },
    { pattern: /^\/expenses\//,                   ttl:  30_000 },
    { pattern: /^\/friends/,                      ttl: 300_000 },
    { pattern: /^\/categories/,                   ttl: 600_000 },
  ];
  const DEFAULT_TTL = 20_000;

  function _ttlFor(path) {
    for (const rule of TTL_RULES) {
      if (rule.pattern.test(path)) return rule.ttl;
    }
    return DEFAULT_TTL;
  }

  // ── Invalidation rules ───────────────────────────────────────
  const INVALIDATION_MAP = [
    { mutationPrefix: '/chapters',   clearPrefixes: ['/chapters'] },
    { mutationPrefix: '/expenses',   clearPrefixes: ['/expenses'] },
    { mutationPrefix: '/friends',    clearPrefixes: ['/friends'] },
    { mutationPrefix: '/categories', clearPrefixes: ['/categories'] },
    { mutationPrefix: '/auth',       clearPrefixes: ['/auth/me'] },
  ];

  async function _invalidateFor(mutationPath) {
    const keys = await idbKeys();
    const keysToDelete = new Set();

    const chapterMatch = mutationPath.match(/^\/chapters\/(\d+)/);
    
    if (chapterMatch) {
      const id = chapterMatch[1];
      for (const key of keys) {
        if (key === '/chapters' || key.startsWith(`/chapters/${id}`) || key.startsWith(`/expenses/chapter/${id}`)) {
          keysToDelete.add(key);
        }
      }
    } else {
      for (const rule of INVALIDATION_MAP) {
        if (mutationPath.startsWith(rule.mutationPrefix)) {
          rule.clearPrefixes.forEach(prefix => {
            for (const key of keys) {
              if (key.startsWith(prefix)) {
                keysToDelete.add(key);
              }
            }
          });
        }
      }
    }

    for (const key of keysToDelete) {
      await idbDelete(key);
    }
  }

  // ── Public API ────────────────────────────────────────────────

  async function get(path) {
    const entry = await idbGet(path);
    if (!entry) return null;
    const age = Date.now() - entry.cachedAt;
    return {
      data: entry.data,
      isStale: age > entry.ttl,
    };
  }

  async function set(path, data) {
    await idbPut(path, {
      data,
      cachedAt: Date.now(),
      ttl: _ttlFor(path),
    });
  }

  async function invalidate(mutationPath) {
    await _invalidateFor(mutationPath);
  }

  async function clear() {
    await idbClear();
  }

  return { get, set, invalidate, clear };
})();

window.ApiCache = ApiCache;

// P2.12: Clear cache on page load to enforce in-memory behavior and prevent stale financial data across sessions
if (window.ApiCache) {
  window.ApiCache.clear().catch(e => console.warn('ApiCache clear failed:', e));
}
