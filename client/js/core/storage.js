/* client/js/core/storage.js */
/**
 * Safe Storage Abstraction
 * 
 * Handles:
 * - Safari Private mode (throws on write)
 * - Firefox strict tracking protection
 * - Storage quota exceeded
 * - Embedded WebViews
 * 
 * Priority: localStorage → sessionStorage → in-memory
 */
const SafeStorage = (() => {
  const _memStore = new Map(); // Last-resort in-memory store

  function tryLS(op, key, value) {
    try {
      if (op === "get") return { ok: true, value: localStorage.getItem(key) };
      if (op === "set") { localStorage.setItem(key, value); return { ok: true }; }
      if (op === "remove") { localStorage.removeItem(key); return { ok: true }; }
    } catch (_) { return { ok: false }; }
  }

  function trySS(op, key, value) {
    try {
      if (op === "get") return { ok: true, value: sessionStorage.getItem(key) };
      if (op === "set") { sessionStorage.setItem(key, value); return { ok: true }; }
      if (op === "remove") { sessionStorage.removeItem(key); return { ok: true }; }
    } catch (_) { return { ok: false }; }
  }

  return {
    // Persistent storage (survives browser close)
    get(key) {
      const r = tryLS("get", key);
      if (r.ok) return r.value;
      const s = trySS("get", key);
      if (s.ok) return s.value;
      return _memStore.get(key) ?? null;
    },
    set(key, value) {
      const r = tryLS("set", key, value);
      if (!r.ok) {
        const s = trySS("set", key, value);
        if (!s.ok) _memStore.set(key, value);
      }
    },
    remove(key) {
      tryLS("remove", key);
      trySS("remove", key);
      _memStore.delete(key);
    },

    // Session storage (cleared on browser close)
    session: {
      get(key) {
        const s = trySS("get", key);
        return s.ok ? s.value : (_memStore.get(`__ss_${key}`) ?? null);
      },
      set(key, value) {
        const s = trySS("set", key, value);
        if (!s.ok) _memStore.set(`__ss_${key}`, value);
      },
      remove(key) {
        trySS("remove", key);
        _memStore.delete(`__ss_${key}`);
      },
    },
  };
})();

window.SafeStorage = SafeStorage;