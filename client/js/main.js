/* client/js/main.js */
/* FIX v2 changes (search for FIX v2 to find all changes):
   1. PWA iOS: Show a proper visual step-by-step guide instead of hiding button
   2. OTP auto-submit: use form.submit() fallback for iOS < 15.4 where requestSubmit() fails
   3. CSRF retry: increased retry attempts for Safari's aggressive cookie handling
   4. apiFetch: better handling of 401 on iOS (avoid redirect loops)
   5. Session monitor: check session_expiry cookie more robustly
*/

/* ======================================
   LOADER QUESTIONS & ROTATION LOGIC
   ====================================== */
const loaderQuestions = [
  "Remember your favourite dish 🍕",
  "Imagine you are dancing with your celebrity crush ✨",
  "Which is your favourite movie? 🎬",
  "Who is your best friend?",
  "What was the last song that made you smile? 🎶",
  "What's your comfort food after a long day?",
  "Imagine you're at your favourite vacation spot right now 🌴",
  "Who's the first person you'd call with good news?",
  "Remember the last time you laughed uncontrollably?",
  "If today was a movie, what genre would it be?",
  "What's one small thing that made you happy recently?",
  "If you could pause time, what would you do first?",
  "Which place makes you feel instantly calm?",
  "What's your favourite childhood memory?",
  "What's something simple that always lifts your mood?"
];

let loaderInterval;

function startLoaderRotation() {
  const textElement = document.getElementById('loader-text');
  if (!textElement) return;
  let index = Math.floor(Math.random() * loaderQuestions.length);
  textElement.textContent = loaderQuestions[index];
  loaderInterval = setInterval(() => {
    textElement.classList.add('fade-out');
    setTimeout(() => {
      index = (index + 1) % loaderQuestions.length;
      textElement.textContent = loaderQuestions[index];
      textElement.classList.remove('fade-out');
    }, 500);
  }, 3000);
}

function hideAppLoader() {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.classList.add('hidden');
    if (loaderInterval) clearInterval(loaderInterval);
  }
}

(function() {

  /* ======================================
     0. CONSTANTS & CONFIG
     ====================================== */
const CONFIG = {
    isLocal: window.location.hostname === "localhost" ||
             window.location.hostname === "127.0.0.1" ||
             window.location.port === "5500",
    get API_BASE() {
      return this.isLocal
        ? `http://${window.location.hostname}:5001/api`
        : "/api";
    },
    TIMEOUTS: {
      TOAST_DURATION: 4000,
      DEBOUNCE_DELAY: 300,
      SESSION_CHECK: 60000,
      SESSION_WARN: 300000,
      GOOGLE_INIT_DELAY: 500,
      REQUEST_TIMEOUT: 15000, // FIX v2: increased to 15s for slow Render cold starts
    },
    SELECTORS: {
      TOAST_CONTAINER: 'toast-container',
      GOOGLE_BTN: '.g_id_signin',
    }
  };

  window.APP_CONFIG = CONFIG;

  /* ======================================
     1. NETWORK STACK
     ====================================== */

  window.debounce = function(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  // ── Exponential backoff helper ──────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Pages where a 401 is EXPECTED and should NOT redirect
  const AUTH_PAGES = ["login.html", "index.html", "signup.html", "forgot.html", "set-password.html"];
  function isAuthPage() {
    return AUTH_PAGES.some(p => window.location.pathname.includes(p));
  }

  window.apiFetch = async function(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

    const makeRequest = async (attempt = 0) => {
      const csrfToken = window.CSRFManager ? window.CSRFManager.get() : null;

      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };
      if (csrfToken && isMutation) {
        headers["X-CSRF-Token"] = csrfToken;
      }

      const controller = new AbortController();
      // Render cold starts can take 30-60s on free tier.
      // OTP endpoints need extra time for cold Render starts (can take 60s)
      // We give 90s for OTP specifically, 70s for other auth, 30s for data
      const isAuthEndpoint = path.includes('/auth/');
      const isOtpEndpoint = path.includes('/otp') || path.includes('request-otp');
      const timeoutMs = isOtpEndpoint ? 90000 : (isAuthEndpoint ? 70000 : 30000);
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let res;
      try {
        res = await fetch(CONFIG.API_BASE + path, {
          method,
          headers,
          credentials: "include",
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (err) {
        clearTimeout(timeoutId);
        
        // ── OFFLINE QUEUE FOR EXPENSE CREATION ─────────────────
        // If offline and trying to add an expense, queue it for later sync
        if (!navigator.onLine && options.body && options.method === "POST") {
          const isExpenseAdd = path === "/expenses";
          if (isExpenseAdd && window.OfflineQueue) {
            await window.OfflineQueue.enqueue({
              path,
              method: options.method,
              body: options.body,
            });
            if (window.showToast) {
              window.showToast("Saved offline — will sync when connected", "info");
            }
            // Return a synthetic success-like response to prevent rollback
            return { ok: true, offline: true, expense: { id: `offline-${Date.now()}`, ...options.body } };
          }
        }
        // ── END OFFLINE QUEUE ─────────────────────────────────

        if (err.name === "AbortError") {
          // If server might be sleeping, retry automatically for auth endpoints
          const isAuthPath = path.includes('/auth/');
          if (isAuthPath && attempt < 2) {
            console.log(`Auth request timed out, retrying (attempt ${attempt + 1})...`);
            await sleep(3000);
            return makeRequest(attempt + 1);
          }
          const error = new Error(
            "The server is starting up (this takes ~30 seconds on first use). " +
            "Please wait a moment and try again."
          );
          error.status = 408;
          error.isTimeout = true;
          throw error;
        }
        if (!navigator.onLine) {
          const error = new Error("You appear to be offline. Please check your connection.");
          error.status = 0;
          error.isOffline = true;
          throw error;
        }
        // Network error — retry with backoff. Auth endpoints get more attempts
        // because the server may be cold-starting.
        const maxNetworkRetries = path.includes('/auth/') ? 3 : 2;
        if (attempt < maxNetworkRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1})...`);
          await sleep(delay);
          return makeRequest(attempt + 1);
        }
        throw err;
      }

      // Server echoes the current CSRF token in every response header.
      const freshCSRF = res.headers.get("X-CSRF-Token");
      if (freshCSRF) {
        window.CSRFManager && window.CSRFManager.capture(res.headers);
      }

      // CSRF mismatch — server returns {csrfError: true}
      // Retry once after a short wait (cookie needs time to propagate in Safari)
      if (res.status === 403 && isMutation && attempt < 2) {
        let body = {};
        try { body = await res.clone().json(); } catch (_) {}
        if (body.csrfError) {
          await sleep(Math.pow(2, attempt) * 600); // 600ms, 1200ms
          return makeRequest(attempt + 1);
        }
      }

      // 401 handling — only redirect if NOT on an auth page and NOT a background check
  if (res.status === 401) {
  if (!isAuthPage() && !options._silent) {
    // Attempt silent refresh before redirecting
    const refreshed = window.SessionManager
      ? await window.SessionManager.attemptRefresh()
      : false;

    if (refreshed && attempt < 1) {
      // Retry the original request once with fresh cookies
      return makeRequest(attempt + 1);
    }

    // Refresh failed — redirect to login
    setTimeout(() => {
      window.location.href = "login.html?expired=true";
    }, 200);
    return;
  }
  // On auth pages or silent: fall through to normal error
}

      // Rate limit
      if (res.status === 429) {
        // Retry after the server's suggested wait time
        const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
        if (attempt < 1) {
          await sleep(Math.min(retryAfter * 1000, 5000)); // Max 5s wait in UI
          return makeRequest(attempt + 1);
        }
        const error = new Error("You're doing this too fast — please wait a moment.");
        error.status = 429;
        error.isRateLimit = true;
        throw error;
      }

      // Server errors — retry with backoff for transient failures
      if (res.status >= 500 && attempt < 2) {
        await sleep(Math.pow(2, attempt) * 1000); // 1s, 2s
        return makeRequest(attempt + 1);
      }
      if (res.status >= 500) {
        const error = new Error("Server is temporarily unavailable. Please try again.");
        error.status = res.status;
        error.isServerError = true;
        throw error;
      }

      // Parse response
      const contentType = res.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        try { data = await res.json(); }
        catch (_) { data = { message: "Invalid response from server." }; }
      } else {
        await res.text(); // Drain body
        data = { message: res.ok ? "OK" : `Server error (${res.status})` };
      }

      if (!res.ok) {
        const error = new Error(data.message || `Request failed (${res.status})`);
        error.status = res.status;
        error.data = data;
        throw error;
      }
      return data;
    };

    return makeRequest(0);
  };

  /* ── Server Wake-Up System ──────────────────────────────────
   * Render free tier sleeps after 15min inactivity. This pings
   * the server as soon as the page loads so it's awake by the
   * time the user fills the form (30-60 seconds to wake up).
   */
  let serverIsAwake = false;
  let wakeUpPromise = null;

  async function wakeUpServer() {
    if (serverIsAwake) return true;
    if (wakeUpPromise) return wakeUpPromise;

    wakeUpPromise = (async () => {
      const maxAttempts = 6;
      const delayBetween = 10000; // 10 seconds between attempts

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          
          const res = await fetch(CONFIG.API_BASE + '/auth/me', {
            method: 'GET',
            credentials: 'include',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          // Any response (even 401) means server is awake
          if (res.status !== 0) {
            serverIsAwake = true;
            console.log(`Server awake after ${attempt} attempt(s)`);
            
            // Capture CSRF from response header
            const csrfHeader = res.headers.get('X-CSRF-Token');
            if (csrfHeader) {
              window.CSRFManager && window.CSRFManager.capture(res.headers);
            }
            return true;
          }
        } catch (err) {
          console.log(`Wake-up attempt ${attempt}/${maxAttempts} failed:`, err.message);
          if (attempt < maxAttempts) {
            await sleep(delayBetween);
          }
        }
      }
      console.warn('Server may still be starting. Proceeding anyway.');
      return false;
    })();

    return wakeUpPromise;
  }

  window.wakeUpServer = wakeUpServer;
  window.isServerAwake = () => serverIsAwake;

  /* ======================================
     2. SESSION & AUTH
     ====================================== */
  async function initGoogleAuth() {
    const googleBtnContainer = document.querySelector(CONFIG.SELECTORS.GOOGLE_BTN);
    if (!googleBtnContainer) return;
    try {
      const { googleClientId } = await window.apiFetch("/config");
      if (!window.google) {
        setTimeout(initGoogleAuth, CONFIG.TIMEOUTS.GOOGLE_INIT_DELAY);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: window.handleGoogleCredential,
        // FIX v2: use_fedcm_for_prompt helps on iOS Safari
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.renderButton(
        googleBtnContainer,
        { theme: "outline", size: "large", width: "100%" }
      );
    } catch (err) {
      console.error("Failed to init Google Auth", err);
    }
  }

  window.handleGoogleCredential = async function(response) {
    try {
      const data = await window.apiFetch("/auth/google", {
        method: "POST",
        body: { idToken: response.credential },
      });
      window.showToast("Logged in as " + data.user.username, "success");
      setTimeout(() => { window.location.href = "dashboard.html"; }, 1000);
    } catch (err) {
      window.showToast(err.message || "Google sign-in failed", "error");
    }
  };

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function initSessionMonitor() {
    setInterval(() => {
      // Try cookie first, then sessionStorage fallback
      const expiryStr = getCookie("session_expiry") || sessionStorage.getItem("session_expiry_fallback");
      if (!expiryStr) return;
      
      const expiresAt = parseInt(expiryStr, 10);
      if (!expiresAt || isNaN(expiresAt) || expiresAt <= 0) return;
      
      const timeLeft = expiresAt - Date.now();
      if (timeLeft > 0 && timeLeft < CONFIG.TIMEOUTS.SESSION_WARN) {
        const lastWarned = sessionStorage.getItem("sessionWarned");
        if (!lastWarned) {
          showToast("⚠️ Session expires soon. Please save your work.", "info");
          sessionStorage.setItem("sessionWarned", "true");
        }
      }
    }, CONFIG.TIMEOUTS.SESSION_CHECK);
  }

  /* ======================================
     3. UI HELPERS
     ====================================== */
  let isMobileMode = false;

  function handleMobileFocus(e) {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, CONFIG.TIMEOUTS.DEBOUNCE_DELAY);
    }
  }

  function initMobileTweaks() {
    const width = window.innerWidth;
    const shouldBeMobile = width < 768;
    if (shouldBeMobile && !isMobileMode) {
      document.addEventListener('focusin', handleMobileFocus);
      isMobileMode = true;
    } else if (!shouldBeMobile && isMobileMode) {
      document.removeEventListener('focusin', handleMobileFocus);
      isMobileMode = false;
    }
  }

  window.setBtnLoading = function(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.classList.add("btn-loading");
      btn.disabled = true;
      btn.style.pointerEvents = "none";
    } else {
      btn.innerHTML = btn.dataset.originalText || btn.textContent;
      btn.classList.remove("btn-loading");
      btn.disabled = false;
      btn.style.pointerEvents = "";
      delete btn.dataset.originalText;
    }
  };

  window.scrollToFirstError = function() {
    const firstError = document.querySelector('.input-invalid, .input-error-msg:not([style*="display: none"]), :invalid');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstError.focus({ preventScroll: true });
      firstError.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => { firstError.style.animation = ''; }, 500);
    }
  };

  window.setupInlineValidation = function(input, validateFn) {
    if (!input) return;
    const errorId = input.name + "-error-msg";
    let errorEl = document.getElementById(errorId);
    if (!errorEl) {
      errorEl = document.createElement("div");
      errorEl.id = errorId;
      errorEl.className = "input-error-msg";
      errorEl.setAttribute("aria-live", "assertive");
      input.parentNode.insertBefore(errorEl, input.nextSibling);
      input.setAttribute("aria-describedby", errorId);
    }
    const check = () => {
      const errorMsg = validateFn(input.value);
      if (errorMsg) {
        input.classList.add("input-invalid");
        input.classList.remove("input-valid");
        input.setAttribute("aria-invalid", "true");
        errorEl.textContent = errorMsg;
        errorEl.style.display = "block";
        return false;
      } else {
        input.classList.remove("input-invalid");
        input.setAttribute("aria-invalid", "false");
        if (input.value.trim().length > 0) input.classList.add("input-valid");
        errorEl.style.display = "none";
        return true;
      }
    };
    input.addEventListener("input", check);
    input.addEventListener("blur", check);
    return check;
  };

  window.trapFocus = function(modalElement) {
    const focusableSelectors = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    const getFocusable = () => Array.from(modalElement.querySelectorAll(focusableSelectors));

    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    // Return cleanup function
    modalElement.addEventListener('keydown', handler);
    return () => modalElement.removeEventListener('keydown', handler);
  };

  window.openModalWithFocus = function(modalEl, firstFocusSelector) {
    modalEl.classList.add('active');
    const cleanup = window.trapFocus(modalEl);
    modalEl._focusTrapCleanup = cleanup;

    // Focus first interactive element
    setTimeout(() => {
      const target = firstFocusSelector 
        ? modalEl.querySelector(firstFocusSelector) 
        : modalEl.querySelector('button, input, select, textarea, [tabindex]');
      target?.focus();
    }, 50);
  };

  window.closeModalWithFocus = function(modalEl, returnFocusEl) {
    modalEl.classList.remove('active');
    if (modalEl._focusTrapCleanup) {
      modalEl._focusTrapCleanup();
      delete modalEl._focusTrapCleanup;
    }
    returnFocusEl?.focus();
  };

  function initPasswordToggles() {
    document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      const toggle = (e) => {
        if (e.cancelable) e.preventDefault();
        const input = newBtn.previousElementSibling;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        newBtn.textContent = isPass ? '🙈' : '👁️';
        if (navigator.vibrate) navigator.vibrate(10);
      };
      newBtn.addEventListener('touchstart', toggle, { passive: false });
      newBtn.addEventListener('click', toggle);
    });
  }

  // 🔐 UPDATED: Hardened password validation (AUTH-015)
function initPasswordValidation() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    const wrapper = input.closest('.password-wrapper');
    if (!wrapper) return;
    const hint = wrapper.nextElementSibling;
    if (hint && hint.classList.contains('password-hint')) {
      input.addEventListener("input", () => {
        const pwd = input.value;
        const isValid = pwd.length >= 8;

        if (!pwd) {
          hint.textContent = "At least 8 characters";
          hint.className = "password-hint";
          return;
        }
        if (isValid) {
          hint.textContent = "✓ Good password";
          hint.className = "password-hint valid";
        } else {
          const remaining = 8 - pwd.length;
          hint.textContent = `${remaining} more character${remaining !== 1 ? "s" : ""} needed`;
          hint.className = "password-hint invalid";
        }
      });
    }
  });
}

  window.getAvatarColor = function(name) {
    if (!name) return "#ccc";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 60%)`;
  };

  window.timeAgo = function(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date - now;
    const diffSecs = Math.round(diffMs / 1000);
    try {
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      if (Math.abs(diffSecs) < 60) return "just now";
      if (Math.abs(diffSecs) < 3600) return rtf.format(Math.round(diffSecs / 60), 'minute');
      if (Math.abs(diffSecs) < 86400) return rtf.format(Math.round(diffSecs / 3600), 'hour');
      if (Math.abs(diffSecs) < 2592000) return rtf.format(Math.round(diffSecs / 86400), 'day');
      if (Math.abs(diffSecs) < 31536000) return rtf.format(Math.round(diffSecs / 2592000), 'month');
      return rtf.format(Math.round(diffSecs / 31536000), 'year');
    } catch (e) {
      // Fallback for very old iOS that doesn't support Intl.RelativeTimeFormat
      const days = Math.abs(Math.round(diffSecs / 86400));
      if (days === 0) return "today";
      if (days === 1) return "yesterday";
      return `${days} days ago`;
    }
  };

  /* ======================================
     4. TOAST NOTIFICATIONS
     ====================================== */
  window.showToast = function(message, type = 'info', options = null) {
    const container = document.getElementById(CONFIG.SELECTORS.TOAST_CONTAINER);
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconHtml = '';
    if (type === 'success') {
      iconHtml = `<div class="checkmark-circle"><div class="background"></div><div class="draw"></div></div>`;
    } else if (type === 'error') {
      iconHtml = `<span style="margin-right:10px; font-size:1.2rem;">⚠️</span>`;
    } else if (type === 'info') {
      iconHtml = `<span style="margin-right:10px; font-size:1.2rem;">ℹ️</span>`;
    }

    let actionHtml = '';
    if (options && options.label && typeof options.callback === 'function') {
      actionHtml = `<button class="toast-action-btn" style="
        margin-left:12px; background:none; border:1px solid rgba(255,255,255,0.4);
        color:#fff; padding:3px 10px; border-radius:6px; cursor:pointer;
        font-family:var(--font-main); font-size:0.8rem; font-weight:600;
        white-space:nowrap; flex-shrink:0;">
        ${options.label}
      </button>`;
    }

    toast.innerHTML = `${iconHtml}<span style="flex:1;">${message}</span>${actionHtml}`;
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    container.appendChild(toast);

    if (options && options.callback) {
      const btn = toast.querySelector('.toast-action-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          options.callback();
          toast.remove();
        });
      }
    }

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        if (toast.parentElement) toast.remove();
      });
    }, CONFIG.TIMEOUTS.TOAST_DURATION);
  };

  /* ======================================
     5. INITIALIZATION
     ====================================== */
  async function initializeApp() {
    try {
      // Start waking up the server immediately in the background
      // so it's ready by the time user fills the form
      wakeUpServer().catch(() => {}); // fire and forget, never block UI
    } catch (err) {
      console.error("App initialization failed", err);
    } finally {
      hideAppLoader();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.CSRFManager && window.CSRFManager.init();
    if (!document.getElementById("toast-container")) {
      const tc = document.createElement("div");
      tc.id = "toast-container";
      tc.className = "toast-container";
      document.body.appendChild(tc);
    }

    startLoaderRotation();
    initializeApp();
    initGoogleAuth();
    initSessionMonitor();
    initMobileTweaks();
    initPasswordToggles();
    initPasswordValidation();

    if (window.location.search.includes("expired=true")) {
      window.showToast("Session expired. Please log in again.", "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, a, .chapter-card, .expense-card, .nav-icon-btn, .fab-btn');
      if (target && navigator.vibrate) {
        navigator.vibrate(10);
        if (target.classList.contains('expense-card')) {
          target.style.transform = "scale(0.98)";
          setTimeout(() => target.style.transform = "scale(1)", 100);
        }
      }
    });

    window.addEventListener('resize', window.debounce(initMobileTweaks, CONFIG.TIMEOUTS.DEBOUNCE_DELAY));

    // Step 5.3 — Fix offline indicator: Persistent offline banner
    function updateOnlineStatus() {
      const existingBanner = document.getElementById('offline-banner');
      if (!navigator.onLine) {
        if (!existingBanner) {
          const banner = document.createElement('div');
          banner.id = 'offline-banner';
          banner.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; z-index: 99999;
            background: #ff1744; color: #fff; text-align: center;
            padding: 8px 16px; font-family: var(--font-main); font-size: 0.85rem;
            font-weight: 600; letter-spacing: 0.3px;
          `;
          banner.textContent = "⚠️ You are offline. Changes may not be saved.";
          document.body.prepend(banner);
        }
      } else {
        existingBanner?.remove();
      }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    // Initial check
    updateOnlineStatus();

    // ── Server Status Banner ───────────────────────────────────
    // Shows a non-intrusive banner while the server is cold-starting
    function showServerStartingBanner() {
      if (document.getElementById('server-starting-banner')) return;
      const banner = document.createElement('div');
      banner.id = 'server-starting-banner';
      banner.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.85); color: #fff;
        padding: 12px 20px; border-radius: 12px;
        font-family: var(--font-main); font-size: 0.85rem;
        z-index: 99998; text-align: center;
        border: 1px solid rgba(208,0,255,0.4);
        backdrop-filter: blur(10px);
        display: flex; align-items: center; gap: 10px;
        max-width: 90vw;
        animation: slideIn 0.3s ease-out;
      `;
      banner.innerHTML = `
        <div style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);
          border-top:2px solid #d000ff;border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0;"></div>
        <span>Server is starting up... (~30 sec on first use)</span>
      `;
      document.body.appendChild(banner);
    }

    function hideServerStartingBanner() {
      const banner = document.getElementById('server-starting-banner');
      if (banner) {
        banner.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => banner.remove(), 300);
      }
    }

    window.showServerStartingBanner = showServerStartingBanner;
    window.hideServerStartingBanner = hideServerStartingBanner;

    // Show banner if server isn't awake and we're on an auth page
    const isAuthPage = ['login.html', 'signup.html', 'forgot.html', 'index.html']
      .some(p => window.location.pathname.includes(p));
    
    if (isAuthPage) {
      // Check server status after a short delay
      setTimeout(async () => {
        if (!window.isServerAwake || !window.isServerAwake()) {
          showServerStartingBanner();
          if (window.wakeUpServer) {
            await window.wakeUpServer().catch(() => {});
          }
          hideServerStartingBanner();
        }
      }, 1500);
    }
  });

  /* ======================================
     6. SERVICE WORKER
     ====================================== */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              showToast("App updated! Reload for the latest version.", "info", {
                label: "Reload",
                callback: () => {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              });
            }
          });
        });
      }).catch(err => console.log('ServiceWorker registration failed:', err));
    });
  }

  /* ======================================
     7. PWA INSTALL PROMPT — FIX v2
     ======================================
     
     iOS REALITY: 
     - beforeinstallprompt NEVER fires on iOS Safari (Apple blocks it entirely)
     - iOS users must manually: Safari → Share button → "Add to Home Screen"
     - We show an animated visual guide specifically for iOS
     
     ANDROID/CHROME:
     - beforeinstallprompt fires normally → we trigger native install dialog
     
     FIX: Show iOS users a clear visual step-by-step guide with an animated
     arrow pointing to where the Share button actually is on their screen.
     ====================================== */
  // document.addEventListener("DOMContentLoaded", () => {
  //   let deferredPrompt;
  //   const pwaPopup = document.getElementById('pwa-install-prompt');
  //   if (!pwaPopup) return;

  //   const pwaInstallBtn = document.getElementById('pwa-install-btn');
  //   const pwaCloseBtn = document.getElementById('pwa-close-btn');
  //   const pwaInstructions = document.getElementById('pwa-instructions');
  //   const pwaIcon = pwaPopup.querySelector('.pwa-icon');
  //   const pwaTitle = pwaPopup.querySelector('h4');

  //   const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  //   const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  //   const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  //   // Already installed — don't show
  //   if (isStandalone) return;

  //   // Check if dismissed recently (don't annoy users)
  //   const lastDismissed = localStorage.getItem('pwa_dismissed_at');
  //   if (lastDismissed && Date.now() - parseInt(lastDismissed) < 3 * 24 * 60 * 60 * 1000) return;

  //   function showPopup() {
  //     setTimeout(() => {
  //       pwaPopup.classList.remove('hidden');
  //     }, 3000); // FIX v2: increased to 3s so page loads first
  //   }

  //   if (isIOS && isSafari) {
  //     // ── iOS Safari: Show visual step-by-step guide ──────────
  //     if (pwaTitle) pwaTitle.textContent = 'Install Hisaab';
  //     if (pwaIcon) pwaIcon.textContent = '📲';

  //     // Replace the install button with a "How to Install" button
  //     if (pwaInstallBtn) {
  //       pwaInstallBtn.textContent = 'How to Install';
  //       pwaInstallBtn.style.background = '#007AFF'; // iOS blue
  //       pwaInstallBtn.addEventListener('click', showIOSInstallGuide);
  //     }

  //     if (pwaInstructions) {
  //       pwaInstructions.innerHTML = 'Tap <strong>Share ↑</strong> → <strong>Add to Home Screen</strong>';
  //     }

  //     showPopup();

  //   } else {
  //     // ── Android/Chrome: Use native beforeinstallprompt ──────
  //     window.addEventListener('beforeinstallprompt', (e) => {
  //       e.preventDefault();
  //       deferredPrompt = e;
  //       if (pwaInstructions) pwaInstructions.textContent = "Add to your home screen for quick access!";
  //       if (pwaInstallBtn) pwaInstallBtn.textContent = 'Install';
  //       showPopup();
  //     });

  //     if (pwaInstallBtn) {
  //       pwaInstallBtn.addEventListener('click', async () => {
  //         pwaPopup.classList.add('hidden');
  //         if (deferredPrompt) {
  //           deferredPrompt.prompt();
  //           const { outcome } = await deferredPrompt.userChoice;
  //           console.log(`PWA install outcome: ${outcome}`);
  //           deferredPrompt = null;
  //         }
  //       });
  //     }
  //   }

  //   if (pwaCloseBtn) {
  //     pwaCloseBtn.addEventListener('click', () => {
  //       pwaPopup.classList.add('hidden');
  //       localStorage.setItem('pwa_dismissed_at', Date.now().toString());
  //     });
  //   }
  // });

  /* ======================================
     8. iOS INSTALL GUIDE MODAL
     Shows a bottom-sheet with animated arrows pointing to iOS Share button
     ====================================== */
  function showIOSInstallGuide() {
    const existing = document.getElementById('ios-install-guide');
    if (existing) { existing.remove(); return; }

    const guide = document.createElement('div');
    guide.id = 'ios-install-guide';
    guide.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      background: #fff;
      border-radius: 20px 20px 0 0;
      padding: 24px 20px 40px;
      z-index: 99999;
      box-shadow: 0 -10px 40px rgba(0,0,0,0.3);
      font-family: var(--font-main, -apple-system, sans-serif);
      animation: slideUpGuide 0.3s ease-out;
    `;

    guide.innerHTML = `
      <style>
        @keyframes slideUpGuide {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        .ios-guide-step {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .ios-guide-step:last-of-type { border-bottom: none; }
        .ios-step-num {
          width: 28px; height: 28px;
          background: #007AFF;
          color: #fff;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem; font-weight: 700;
          flex-shrink: 0;
        }
        .ios-step-text { font-size: 0.92rem; color: #333; line-height: 1.4; }
        .ios-step-text strong { color: #000; }
        .share-arrow {
          display: inline-block;
          font-size: 1.1rem;
          animation: bounceDown 1.2s ease-in-out infinite;
        }
      </style>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3 style="margin:0; font-size:1.1rem; color:#000;">Add to Home Screen</h3>
        <button onclick="document.getElementById('ios-install-guide').remove()"
          style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#666; padding:4px;">×</button>
      </div>

      <div class="ios-guide-step">
        <div class="ios-step-num">1</div>
        <div class="ios-step-text">
          Tap the <strong>Share</strong> button <span class="share-arrow">⬆️</span> at the bottom of Safari
          <div style="font-size:0.78rem; color:#999; margin-top:2px;">(the box with an arrow pointing up)</div>
        </div>
      </div>

      <div class="ios-guide-step">
        <div class="ios-step-num">2</div>
        <div class="ios-step-text">
          Scroll down in the share menu and tap <strong>"Add to Home Screen"</strong>
          <div style="font-size:0.78rem; color:#999; margin-top:2px;">It looks like a plus (+) icon in a square</div>
        </div>
      </div>

      <div class="ios-guide-step">
        <div class="ios-step-num">3</div>
        <div class="ios-step-text">
          Tap <strong>"Add"</strong> in the top right corner
          <div style="font-size:0.78rem; color:#999; margin-top:2px;">Hisaab-Kitaab will appear on your home screen!</div>
        </div>
      </div>

      <div style="margin-top:20px; background:#f0f7ff; border-radius:12px; padding:12px 14px; display:flex; gap:10px; align-items:flex-start;">
        <span style="font-size:1.2rem;">💡</span>
        <p style="margin:0; font-size:0.82rem; color:#444; line-height:1.5;">
          Once installed, Hisaab-Kitaab opens full-screen without the Safari toolbar — 
          just like a native app. No App Store needed!
        </p>
      </div>

      <!-- Visual arrow pointing to bottom of screen where Share button lives -->
      <div style="text-align:center; margin-top:16px; color:#007AFF; font-size:0.85rem; font-weight:600;">
        <div style="font-size:2rem; animation: bounceDown 1s ease-in-out infinite;">↓</div>
        Share button is at the bottom of your screen
      </div>
    `;

    document.body.appendChild(guide);

    // Close when tapping outside
    setTimeout(() => {
      document.addEventListener('click', function closeGuide(e) {
        const g = document.getElementById('ios-install-guide');
        if (g && !g.contains(e.target)) {
          g.remove();
          document.removeEventListener('click', closeGuide);
        }
      });
    }, 100);
  }

  window.showIOSInstallGuide = showIOSInstallGuide;

})();


/* ======================================
   6. MEMBER AUTOCOMPLETE COMPONENT
   ====================================== */
class MemberAutocomplete {
  constructor(inputElement, options = {}) {
    this.input = inputElement;
    this.options = {
      friends: [],
      onSelect: null,
      allowGuest: true,
      allowCreate: true,
      ...options
    };
    this.init();
  }

  init() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'autocomplete-wrapper';
    this.input.parentNode.insertBefore(this.wrapper, this.input);
    this.wrapper.appendChild(this.input);

    this.dropdown = document.createElement('div');
    this.dropdown.className = 'autocomplete-dropdown';
    this.wrapper.appendChild(this.dropdown);

    // Store handler references for cleanup
    this._inputHandler = () => this.handleInput();
    this._focusHandler = () => this.handleInput();
    this._blurHandler = () => {
      setTimeout(() => this.dropdown.classList.remove('active'), 200);
    };

    this.input.addEventListener('input', this._inputHandler);
    this.input.addEventListener('focus', this._focusHandler);
    this.input.addEventListener('blur', this._blurHandler);
  }

  handleInput() {
    const term = this.input.value.trim().toLowerCase();
    this.dropdown.innerHTML = '';

    if (!term) {
      this.dropdown.classList.remove('active');
      this.input.classList.remove('dropdown-open');
      return;
    }

    let hasMatches = false;

    const matches = this.options.friends.filter(f =>
      f.name.toLowerCase().includes(term) ||
      f.username.toLowerCase().includes(term)
    );

    matches.forEach(friend => {
      hasMatches = true;
      this.renderItem({
        type: 'friend',
        data: friend,
        html: `
          <div class="ac-avatar" style="background:${window.getAvatarColor(friend.name)}">
            ${friend.name.charAt(0).toUpperCase()}
          </div>
          <div class="ac-info">
            <div class="ac-name">${friend.name}</div>
            <div class="ac-sub">@${friend.username}</div>
          </div>
        `
      });
    });

    const exactMatch = matches.find(f => f.name.toLowerCase() === term);
    if (!exactMatch && this.options.allowGuest) {
      hasMatches = true;
      this.renderItem({
        type: 'guest',
        data: { name: this.input.value },
        className: 'guest-option',
        html: `
          <div class="guest-icon">+</div>
          <div class="ac-info">
            <div class="ac-name">Add "${this.input.value}"</div>
            <div class="ac-sub">Guest (Not in friends)</div>
          </div>
        `
      });
    }

    if (hasMatches) {
      this.dropdown.classList.add('active');
      this.input.classList.add('dropdown-open');
    } else {
      this.dropdown.classList.remove('active');
      this.input.classList.remove('dropdown-open');
    }
  }

  renderItem({ type, data, html, className = '' }) {
    const item = document.createElement('div');
    item.className = `autocomplete-item ${className}`;
    item.innerHTML = html;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.selectItem(type, data);
    });
    this.dropdown.appendChild(item);
  }

  selectItem(type, data) {
    if (type === 'friend') {
      this.input.value = data.name;
      this.input.dataset.friendId = data.id;
      this.input.dataset.mode = 'friend';
    } else {
      this.input.value = data.name;
      delete this.input.dataset.friendId;
      this.input.dataset.mode = 'guest';
    }

    this.dropdown.classList.remove('active');
    this.input.classList.remove('dropdown-open');

    if (this.options.onSelect) {
      this.options.onSelect({
        type,
        name: this.input.value,
        friendId: this.input.dataset.friendId
      });
    }
  }

  destroy() {
    this.input.removeEventListener('input', this._inputHandler);
    this.input.removeEventListener('focus', this._focusHandler);
    this.input.removeEventListener('blur', this._blurHandler);
    this.dropdown?.remove();
  }
}

window.MemberAutocomplete = MemberAutocomplete;