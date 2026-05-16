/* client/js/core/csrf.js */
/**
 * CSRF Token Manager
 * Maintains a stable in-memory copy of the CSRF token.
 * Sources (in priority order):
 *   1. Response header X-CSRF-Token (most fresh)
 *   2. Cookie csrf_token (stable, refreshed by server)
 *   3. SessionStorage fallback (iOS ITP recovery)
 */
const CSRFManager = (() => {
  let _token = null;

  function getFromCookie() {
    const value = `; ${document.cookie}`;
    const parts = value.split("; csrf_token=");
    if (parts.length === 2) {
      const t = parts.pop().split(";").shift();
      if (t && t.length >= 32) return t;
    }
    return null;
  }

  function getFromSession() {
    try { return sessionStorage.getItem("__csrf") || null; } catch (_) { return null; }
  }

  function persist(token) {
    if (!token) return;
    _token = token;
    try { sessionStorage.setItem("__csrf", token); } catch (_) {}
  }

  // Call after every API response to capture the freshest token
  function capture(responseHeaders) {
    const fromHeader = responseHeaders.get("X-CSRF-Token");
    if (fromHeader && fromHeader.length >= 32) {
      persist(fromHeader);
      return;
    }
    // Fallback: read from cookie (server always sets it)
    const fromCookie = getFromCookie();
    if (fromCookie) persist(fromCookie);
  }

  function get() {
    return _token || getFromCookie() || getFromSession();
  }

  // Initialize on load
  function init() {
    const initial = getFromCookie() || getFromSession();
    if (initial) _token = initial;
  }

  return { get, capture, init };
})();

window.CSRFManager = CSRFManager;