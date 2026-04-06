/* client/js/main.js */

/* ======================================
   LOADER QUESTIONS & ROTATION LOGIC (PHASE 2)
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

    // Pick random start
    let index = Math.floor(Math.random() * loaderQuestions.length);
    textElement.textContent = loaderQuestions[index];

    loaderInterval = setInterval(() => {
        // Fade out
        textElement.classList.add('fade-out');
        
        setTimeout(() => {
            // Change text (sequential)
            index = (index + 1) % loaderQuestions.length;
            textElement.textContent = loaderQuestions[index];
            // Fade in
            textElement.classList.remove('fade-out');
        }, 500); // Wait for fade out
        
    }, 3000); // 3 seconds per question
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
     0. CONSTANTS & CONFIG (FIXED FOR VERCEL)
     ====================================== */
  const CONFIG = {
    // 1. Detect if we are on Localhost
    isLocal: window.location.hostname === "localhost" || 
             window.location.hostname === "127.0.0.1" ||
             window.location.port === "5500",

    // 2. Set API URL
    get API_BASE() {
        // 🟢 FIX: Dynamic Hostname Matching
        // If you are on 127.0.0.1, this becomes http://127.0.0.1:5001/api
        // If you are on localhost, this becomes http://localhost:5001/api
        return this.isLocal
          ? `http://${window.location.hostname}:5001/api`
          : "https://hisaab-kitaab-service-app.onrender.com/api";
    },
    
    TIMEOUTS: {
      TOAST_DURATION: 4000, 
      DEBOUNCE_DELAY: 300,  
      SESSION_CHECK: 60000, 
      SESSION_WARN: 300000, 
      GOOGLE_INIT_DELAY: 500,
      REQUEST_TIMEOUT: 10000, // ✅ NEW: 10 second request timeout
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
  let csrfToken = null; 
  let csrfPromise = null;
  
  // ✅ CHANGE 1: Modified initCSRF to accept optional forceRefresh parameter
  function initCSRF(forceRefresh = false) {
    // If forcing refresh, clear existing state to guarantee fresh fetch
    if (forceRefresh) {
      csrfToken = null;
      csrfPromise = null;
    }
    
    // Return cached token if available and not forcing refresh
    if (!forceRefresh && csrfToken) {
      return Promise.resolve(csrfToken);
    }
    
    // Return existing promise if available and not forcing refresh
    if (!forceRefresh && csrfPromise) {
      return csrfPromise;
    }

    // Fetch fresh token from server
    csrfPromise = fetch(CONFIG.API_BASE + "/csrf-token", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.csrfToken) {
          csrfToken = data.csrfToken;
          return csrfToken;
        }
        throw new Error("No token received");
      })
      .catch(err => {
        console.warn("CSRF Init failed", err);
        csrfPromise = null;
        return null;
      });
      
    return csrfPromise;
  }
  
  // Debounce Utility
  window.debounce = function(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  // ✅ UPDATED: apiFetch with AbortController timeout + Content-Type validation
  window.apiFetch = async function(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
    
    // ✅ CHANGE 1: Force token refresh on mutation requests
    if (isMutation) {
      await initCSRF(true);
    } else {
      await initCSRF();
    }

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

    // ✅ CHANGE 1: Implement AbortController for request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUTS.REQUEST_TIMEOUT);
    
    let res;
    try {
      res = await fetch(CONFIG.API_BASE + path, {
        method: method,
        headers: headers,
        credentials: "include",
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal, // ✅ Attach abort signal
      });
      clearTimeout(timeoutId); // ✅ Clear timeout on successful response
    } catch (err) {
      clearTimeout(timeoutId); // ✅ Always clear timeout
      
      // ✅ Handle timeout/abort errors specifically
      if (err.name === 'AbortError') {
        const error = new Error("Request timed out. Please check your connection and try again.");
        error.status = 408;
        error.isTimeout = true;
        throw error;
      }
      
      // ✅ Handle network errors (offline, DNS failure, etc.)
      if (!window.navigator.onLine || err.message.includes('Failed to fetch')) {
        const error = new Error("Network error. Please check your internet connection.");
        error.status = 0;
        error.isNetworkError = true;
        throw error;
      }
      
      throw err; // Re-throw other errors
    }

    // ✅ CHANGE 3: Strengthened 403 retry logic
    if (res.status === 403) {
      let shouldRetry = false;
      
      if (isMutation) {
        shouldRetry = true;
      } else {
        // Only attempt JSON parse for non-mutation if content-type suggests JSON
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.clone().json().catch(() => ({}));
          shouldRetry = json.message && json.message.includes("CSRF");
        }
      }
      
      if (shouldRetry) {
        // Clear stale token state and force fresh fetch
        csrfToken = null;
        csrfPromise = null;
        await initCSRF(true);
        
        // Rebuild headers with fresh token
        const retryHeaders = {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        };
        if (csrfToken) retryHeaders["X-CSRF-Token"] = csrfToken;
        
        // Retry the request once with fresh token (with timeout)
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), CONFIG.TIMEOUTS.REQUEST_TIMEOUT);
        
        try {
          res = await fetch(CONFIG.API_BASE + path, {
            method: method,
            headers: retryHeaders,
            credentials: "include",
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);
        } catch (err) {
          clearTimeout(retryTimeoutId);
          if (err.name === 'AbortError') {
            const error = new Error("Request timed out. Please check your connection and try again.");
            error.status = 408;
            error.isTimeout = true;
            throw error;
          }
          throw err;
        }
      }
    }

    // ✅ CHANGE 2: Check for new CSRF token in response headers on successful mutation
    if (isMutation && res.ok) {
      const newToken = res.headers.get("X-CSRF-Token");
      if (newToken && newToken !== csrfToken) {
        csrfToken = newToken;
      }
    }

    if (res.status === 401) {
      if (!window.location.pathname.includes("login.html") && 
          !window.location.pathname.includes("index.html") &&
          !window.location.pathname.includes("signup.html")) {
        window.location.href = "login.html?expired=true";
        return; 
      }
    }
    
    // ✅ Handle Rate Limit (429) with user-friendly error
    if (res.status === 429) {
      const error = new Error("You're adding expenses too fast, please wait a moment.");
      error.status = 429;
      error.isRateLimit = true;
      throw error;
    }
    
    // ✅ Handle server errors (502, 503, etc.) with generic message
    if (res.status >= 500 && res.status < 600) {
      const error = new Error("Server is temporarily unavailable. Please try again.");
      error.status = res.status;
      error.isServerError = true;
      throw error;
    }

    // ✅ CHANGE 2: Validate Content-Type before parsing JSON
    const contentType = res.headers.get("content-type") || "";
    let data;
    
    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch (parseErr) {
        console.warn("JSON parse failed for valid content-type", parseErr);
        data = { message: "Invalid response format from server" };
      }
    } else {
      // ✅ Server returned non-JSON (likely HTML error page from proxy/hosting)
      const text = await res.text().catch(() => "");
      console.warn("Expected JSON but received:", contentType, 
                   "Preview:", text.substring(0, 200) + (text.length > 200 ? "..." : ""));
      
      // Provide meaningful error based on status code
      if (res.status >= 500) {
        data = { message: "Server is temporarily unavailable. Please try again." };
      } else if (res.status === 404) {
        data = { message: "Endpoint not found. Please refresh the page." };
      } else if (res.status === 502 || res.status === 504) {
        data = { message: "Gateway error. The server is taking too long to respond." };
      } else {
        data = { message: "Invalid server response. Please try again." };
      }
    }
    
    if (!res.ok) {
      const error = new Error(data.message || "Request failed");
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  };

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
        callback: window.handleGoogleCredential
      });
  
      window.google.accounts.id.renderButton(
        googleBtnContainer,
        { theme: "outline", size: "large", width: "100%" } 
      );
    } catch (err) {
      // ✅ Handle specific error types for better UX
      if (err.isTimeout || err.isNetworkError || err.isServerError) {
        window.showToast(err.message, "error");
      } else {
        console.error("Failed to init Google Auth", err);
        window.showToast("Failed to initialize sign-in. Please refresh.", "error");
      }
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
      // ✅ Handle specific error types for better UX
      if (err.isTimeout || err.isNetworkError || err.isServerError) {
        window.showToast(err.message, "error");
      } else {
        window.showToast(err.message || "Google sign-in failed", "error");
      }
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
      const expiryStr = getCookie("session_expiry");
      if (!expiryStr) return; 

      const expiresAt = parseInt(expiryStr, 10);
      const timeLeft = expiresAt - Date.now();

      // Use Constant
      if (timeLeft > 0 && timeLeft < CONFIG.TIMEOUTS.SESSION_WARN) {
        const lastWarned = sessionStorage.getItem("sessionWarned");
        if (!lastWarned) {
          window.showToast("⚠️ Session expires soon. Please save work.", "info");
          sessionStorage.setItem("sessionWarned", "true");
        }
      }
    }, CONFIG.TIMEOUTS.SESSION_CHECK); 
  }

  /* ======================================
     3. UI HELPERS (Preserved from original)
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
      firstError.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      firstError.focus({ preventScroll: true });
      firstError.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => {
        firstError.style.animation = '';
      }, 500);
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

  /* ✅ UPDATED: Instant Touch Response + Haptic Feedback */
  function initPasswordToggles() {
    document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
      // 1. Clean slate: Clone to remove old listeners
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      const toggle = (e) => {
        // Prevent default to stop:
        // 1. The input from losing focus (keyboard closing)
        // 2. Double-firing if both touchstart and click happen
        if (e.cancelable) e.preventDefault();

        const input = newBtn.previousElementSibling;
        const isPass = input.type === 'password';
        
        input.type = isPass ? 'text' : 'password';
        newBtn.textContent = isPass ? '🙈' : '👁️';

        // 3. Add Haptic Tick (The "Physical" Feel)
        if (navigator.vibrate) navigator.vibrate(10);
      };

      // 4. Use 'touchstart' for instant mobile response
      // Fallback to 'click' for desktop users
      newBtn.addEventListener('touchstart', toggle, { passive: false });
      newBtn.addEventListener('click', toggle);
    });
  }

  function initPasswordValidation() {
    document.querySelectorAll('input[type="password"]').forEach(input => {
      const wrapper = input.closest('.password-wrapper');
      if (!wrapper) return;
      const hint = wrapper.nextElementSibling;
      if (hint && hint.classList.contains('password-hint')) {
        input.addEventListener('input', () => {
          const isValid = input.value.length >= 8;
          if (isValid) {
            hint.classList.remove('invalid');
            hint.classList.add('valid');
            hint.textContent = "✓ Password is 8 characters or more";
          } else {
            hint.classList.remove('valid');
            hint.classList.add('invalid');
            hint.textContent = "Password must be at least 8 characters long";
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
    
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (Math.abs(diffSecs) < 60) return "just now";
    
    if (Math.abs(diffSecs) < 3600) {
      return rtf.format(Math.round(diffSecs / 60), 'minute');
    }
    if (Math.abs(diffSecs) < 86400) {
      return rtf.format(Math.round(diffSecs / 3600), 'hour');
    }
    if (Math.abs(diffSecs) < 2592000) {
      return rtf.format(Math.round(diffSecs / 86400), 'day');
    }
    if (Math.abs(diffSecs) < 31536000) {
      return rtf.format(Math.round(diffSecs / 2592000), 'month');
    }
    
    return rtf.format(Math.round(diffSecs / 31536000), 'year');
  };

  /* ======================================
     4. TOAST NOTIFICATIONS (Using CONFIG)
     ====================================== */
  window.showToast = function(message, type = 'info') {
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

    toast.innerHTML = `${iconHtml}<span>${message}</span>`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    // Use Constant
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

  // NEW: Initialize app logic including loader
  async function initializeApp() {
    try {
      await initCSRF(); // This fetches /csrf-token and sets up token
      // ... you can add more setup here if needed ...
    } catch (err) {
      console.error("App initialization failed", err);
      // ✅ Show user-friendly error for timeout/network issues
      if (err.isTimeout || err.isNetworkError) {
        window.showToast(err.message, "error");
      }
    } finally {
      // Hide loader whether success or failure
      hideAppLoader();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Start loader rotation immediately
    startLoaderRotation();

    // Initialize app (CSRF + hide loader)
    initializeApp();

    // Rest of your existing init
    initGoogleAuth(); 
    initSessionMonitor();
    initMobileTweaks();
    initPasswordToggles();
    initPasswordValidation();
    
    if (window.location.search.includes("expired=true")) {
      window.showToast("Session expired. Please log in again.", "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Mobile Haptics (Updated for Step 6)
    document.addEventListener('click', (e) => {
      // Add all clickable elements here
      const target = e.target.closest('button, a, .chapter-card, .expense-card, .nav-icon-btn, .fab-btn');
      
      if (target && navigator.vibrate) {
        // 1. Light tap vibration
        navigator.vibrate(10); 
        
        // 2. Add a visual "click" effect to non-buttons (like cards)
        if (target.classList.contains('expense-card')) {
           target.style.transform = "scale(0.98)";
           setTimeout(() => target.style.transform = "scale(1)", 100);
        }
      }
    });
    
    window.addEventListener('resize', window.debounce(initMobileTweaks, CONFIG.TIMEOUTS.DEBOUNCE_DELAY));
  });

  /* ======================================
     7. REGISTER PWA SERVICE WORKER
     ====================================== */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }

  /* ======================================
     8. PWA INSTALL PROMPT LOGIC
     ====================================== */
  document.addEventListener("DOMContentLoaded", () => {
    let deferredPrompt;
    const pwaPopup = document.getElementById('pwa-install-prompt');
    const pwaInstallBtn = document.getElementById('pwa-install-btn');
    const pwaCloseBtn = document.getElementById('pwa-close-btn');
    const pwaInstructions = document.getElementById('pwa-instructions');

    if (!pwaPopup) return; // Exit if popup HTML isn't on this page

    // 1. Detect Device & Install Status
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

    // 2. Function to show popup safely
    function showPopup() {
      // Only show if the app is NOT already installed
      if (!isStandalone) {
        // Show after 1.5 seconds for a smooth user experience
        setTimeout(() => {
          pwaPopup.classList.remove('hidden');
        }, 1500);
      }
    }

    // 3. Handle Android / Windows / Mac (Chrome & Edge)
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      deferredPrompt = e;
      
      if (pwaInstructions) {
        pwaInstructions.textContent = "Add to your home screen for quick access!";
      }
      showPopup();
    });

    // 4. Handle iOS (Safari)
    // Apple strictly blocks `beforeinstallprompt`, so we guide them manually
    if (isIOS && !isStandalone) {
      if (pwaInstructions) {
        pwaInstructions.innerHTML = "To install: tap the <b>Share</b> icon below and select <b>Add to Home Screen</b>.";
      }
      if (pwaInstallBtn) {
        pwaInstallBtn.style.display = 'none'; // Hide the install button because iOS requires manual action
      }
      showPopup();
    }

    // 5. Button Listeners
    if (pwaInstallBtn) {
      pwaInstallBtn.addEventListener('click', async () => {
        pwaPopup.classList.add('hidden'); // Hide our custom popup
        
        if (deferredPrompt) {
          deferredPrompt.prompt(); // Show the native browser install prompt
          
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`User response to install prompt: ${outcome}`);
          
          deferredPrompt = null; // Can only be used once
        }
      });
    }

    if (pwaCloseBtn) {
      pwaCloseBtn.addEventListener('click', () => {
        pwaPopup.classList.add('hidden');
      });
    }
  });

})();


/* ======================================
   6. MEMBER AUTOCOMPLETE COMPONENT (NEW)
   ====================================== */
class MemberAutocomplete {
  constructor(inputElement, options = {}) {
    this.input = inputElement;
    this.options = {
      friends: [], // Array of friend objects
      onSelect: null, // Callback({name, friendId})
      allowGuest: true,
      allowCreate: true,
      ...options
    };
    
    this.init();
  }

  init() {
    // 1. Wrap Input
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'autocomplete-wrapper';
    this.input.parentNode.insertBefore(this.wrapper, this.input);
    this.wrapper.appendChild(this.input);

    // 2. Create Dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'autocomplete-dropdown';
    this.wrapper.appendChild(this.dropdown);

    // 3. Events
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('focus', () => this.handleInput());
    
    // Hide on blur (delayed to allow click)
    this.input.addEventListener('blur', () => {
      setTimeout(() => this.dropdown.classList.remove('active'), 200);
    });
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

    // A. Filter Friends
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

    // B. "Add as Guest" Option (Always show if term exists)
    // Only show if term doesn't perfectly match a friend's name
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

    // C. Show/Hide
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
      e.preventDefault(); // Prevent blur
      this.selectItem(type, data);
    });
    
    this.dropdown.appendChild(item);
  }

  selectItem(type, data) {
    if (type === 'friend') {
      this.input.value = data.name;
      this.input.dataset.friendId = data.id; // Store ID
      this.input.dataset.mode = 'friend';
    } else {
      // Guest
      this.input.value = data.name; // Keep typed name
      delete this.input.dataset.friendId; // Clear ID
      this.input.dataset.mode = 'guest';
    }

    this.dropdown.classList.remove('active');
    this.input.classList.remove('dropdown-open');

    // Trigger Callback
    if (this.options.onSelect) {
      this.options.onSelect({ 
        type, 
        name: this.input.value, 
        friendId: this.input.dataset.friendId 
      });
    }
  }
}

// Make it global
window.MemberAutocomplete = MemberAutocomplete;