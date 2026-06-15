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
  // Map<string, { data: any, cachedAt: number, ttl: number }>
  const _store = new Map();

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
  // When a mutation happens on a path, which cache keys should be cleared?
  // Keys are matched by prefix or exact string.
  const INVALIDATION_MAP = [
    // Mutating /chapters or /chapters/:id clears all chapter-related cache
    { mutationPrefix: '/chapters',   clearPrefixes: ['/chapters'] },
    // Mutating /expenses clears expense lists, summaries, settlements
    { mutationPrefix: '/expenses',   clearPrefixes: ['/expenses'] },
    // Mutating /friends clears friend list
    { mutationPrefix: '/friends',    clearPrefixes: ['/friends'] },
    // Mutating /categories clears category list
    { mutationPrefix: '/categories', clearPrefixes: ['/categories'] },
    // Mutating /auth (profile update, logout) clears user cache
    { mutationPrefix: '/auth',       clearPrefixes: ['/auth/me'] },
  ];

  function _invalidateFor(mutationPath) {
    for (const rule of INVALIDATION_MAP) {
      if (mutationPath.startsWith(rule.mutationPrefix)) {
        rule.clearPrefixes.forEach(prefix => {
          for (const key of _store.keys()) {
            if (key.startsWith(prefix)) {
              _store.delete(key);
            }
          }
        });
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * get(path) → { data, isStale } | null
   * Returns cached data if it exists (even if stale).
   * Returns null if nothing is cached for this path.
   */
  function get(path) {
    const entry = _store.get(path);
    if (!entry) return null;
    const age = Date.now() - entry.cachedAt;
    return {
      data: entry.data,
      isStale: age > entry.ttl,
    };
  }

  /**
   * set(path, data)
   * Stores a fresh response in the cache.
   */
  function set(path, data) {
    _store.set(path, {
      data,
      cachedAt: Date.now(),
      ttl: _ttlFor(path),
    });
  }

  /**
   * invalidate(mutationPath)
   * Called after any POST/PUT/PATCH/DELETE.
   * Clears all cache entries related to the mutated resource.
   */
  function invalidate(mutationPath) {
    _invalidateFor(mutationPath);
  }

  /**
   * clear()
   * Wipes the entire cache. Useful after logout.
   */
  function clear() {
    _store.clear();
  }

  /**
   * invalidateExact(path)
   * Removes a single exact cache key.
   */
  function invalidateExact(path) {
    _store.delete(path);
  }

  return { get, set, invalidate, clear, invalidateExact };
})();

window.ApiCache = ApiCache;
