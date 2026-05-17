/* client/js/core/session.js */
/**
 * SessionManager — Client-side session state management.
 * Handles: expiry detection, cross-tab sync, refresh coordination.
 * 
 * Collaborative-ready: BroadcastChannel API used for cross-tab
 * session events (logout, expiry warnings) — foundation for
 * future real-time multi-device coordination.
 */
const SessionManager = (() => {
  const EXPIRY_COOKIE = 'session_expiry';
  const EXPIRY_SS_KEY = 'session_expiry_fallback';
  // BroadcastChannel for cross-tab communication
  // Falls back gracefully if not supported (iOS < 15.4, some Samsung browsers)
  let _channel = null;
  try {
    _channel = new BroadcastChannel('hk_session');
  } catch (_) { /* Not supported — single-tab mode */ }

  // ── Private helpers ──────────────────────────────────────
  function _readExpiry() {
    try {
      const cookie = document.cookie
        .split('; ')
        .find(r => r.startsWith(EXPIRY_COOKIE + '='));
      if (cookie) {
        const val = parseInt(cookie.split('=')[1], 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch (_) {}
    try {
      const ss = sessionStorage.getItem(EXPIRY_SS_KEY);
      if (ss) return parseInt(ss, 10);
    } catch (_) {}
    return 0;
  }

  function _isExpiringSoon(thresholdMs = 5 * 60 * 1000) {
    const expiry = _readExpiry();
    if (!expiry) return false;
    return (expiry - Date.now()) < thresholdMs && expiry > Date.now();
  }

  function _isExpired() {
    const expiry = _readExpiry();
    if (!expiry) return false;
    return Date.now() > expiry;
  }

  // ── Refresh coordination ─────────────────────────────────
  // Uses a lock to prevent multiple tabs from simultaneously
  // hitting the refresh endpoint — critical for future multi-tab use
  let _refreshInProgress = false;
  let _refreshPromise = null;

  async function attemptRefresh() {
    if (_refreshInProgress && _refreshPromise) return _refreshPromise;
    _refreshInProgress = true;
    _refreshPromise = (async () => {
      try {
        const apiBase = window.APP_CONFIG?.API_BASE || '/api';
        const res = await fetch(apiBase + '/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          // Notify other tabs that session was refreshed
          try { _channel?.postMessage({ type: 'SESSION_REFRESHED' }); } catch (_) {}
          return true;
        }
        return false;
      } catch (_) {
        return false;
      } finally {
        _refreshInProgress = false;
        _refreshPromise = null;
      }
    })();
    return _refreshPromise;
  }

  // ── Cross-tab event handling ─────────────────────────────
  // Foundation for future collaborative multi-device sync
  const _listeners = {};

  function on(event, callback) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(callback);
  }

  function _emit(event, data) {
    (_listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (_) {}
    });
  }

  if (_channel) {
    _channel.onmessage = (event) => {
      const { type, data } = event.data || {};
      switch (type) {
        case 'LOGOUT':
          // Another tab logged out — redirect this tab
          _emit('logout', data);
          break;
        case 'SESSION_REFRESHED':
          _emit('refreshed', data);
          break;
        case 'FORCE_RELOAD':
          // Future: collaborative sync trigger
          _emit('forceReload', data);
          break;
      }
    };
  }

  function broadcastLogout(deviceInfo) {
    try {
      _channel?.postMessage({ type: 'LOGOUT', data: deviceInfo });
    } catch (_) {}
  }

  function broadcastForceReload(reason) {
    try {
      _channel?.postMessage({ type: 'FORCE_RELOAD', data: { reason } });
    } catch (_) {}
  }

  // ── Public API ────────────────────────────────────────────
  return {
    getExpiry: _readExpiry,
    isExpiringSoon: _isExpiringSoon,
    isExpired: _isExpired,
    attemptRefresh,
    broadcastLogout,
    broadcastForceReload,
    on,
    // Expose channel for future collaborative features
    get channel() { return _channel; }
  };
})();

window.SessionManager = SessionManager;