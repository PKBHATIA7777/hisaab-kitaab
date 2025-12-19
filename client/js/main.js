// client/js/main.js

/* ======================================
   1. CORE CONFIGURATION & NETWORK
   ====================================== */

// HELPER: Debounce (prevents functions from firing too often)
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// AUTOMATIC ENVIRONMENT SWITCHING
// Uses Localhost backend when you are developing, and Render backend when on Vercel/Web.
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5001/api"
  : "https://hisaab-kitaab-service-app.onrender.com/api";

// GLOBAL CSRF TOKEN STORAGE
// We store the token here because Vercel (Frontend) cannot read cookies set by Render (Backend).
let globalCsrfToken = "";

// INITIALIZE CSRF ON LOAD
(async function initCSRF() {
  try {
    // We hit this endpoint which does two things:
    // 1. Sets the 'Secure' cookie in the browser (for the backend to verify later).
    // 2. Returns the token in the JSON body (so we can send it in headers).
    const res = await fetch(API_BASE + "/csrf-token", { credentials: "include" });
    const data = await res.json();
    
    if (data.csrfToken) {
      globalCsrfToken = data.csrfToken;
      console.log("CSRF Token initialized via API");
    }
  } catch (e) {
    console.error("CSRF Init Error", e);
  }
})();

// SHARED FETCH WRAPPER (ROBUST VERSION)
async function apiFetch(path, options = {}) {
  // Simple guard: If the token hasn't arrived yet, wait 500ms.
  // This prevents race conditions on immediate page loads.
  if (!globalCsrfToken) {
    await new Promise(r => setTimeout(r, 500)); 
  }

  const res = await fetch(API_BASE + path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      // CRITICAL: Send the token from our variable, not document.cookie
      "X-CSRF-Token": globalCsrfToken, 
      ...(options.headers || {}),
    },
    credentials: "include", // Essential: Sends the HTTP-only cookie along with the request
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = res.status;
    throw error;
  }
  
  return data;
}

/* ======================================
   2. GOOGLE SIGN-IN
   ====================================== */
async function handleGoogleCredential(response) {
  try {
    const idToken = response.credential;

    const data = await apiFetch("/auth/google", {
      method: "POST",
      body: { idToken },
    });

    showToast("Logged in as " + data.user.username, "success");
    
    // Slight delay so user sees the toast before redirect
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);
    
  } catch (err) {
    showToast(err.message || "Google sign-in failed", "error");
  }
}

// Expose globally so Google's script can call it
window.handleGoogleCredential = handleGoogleCredential;
window.apiFetch = apiFetch;

/* ======================================
   3. MOBILE KEYBOARD & ROTATION HELPER
   ====================================== */

let isMobileMode = false;

function handleMobileFocus(e) {
  const target = e.target;
  // Only act if it's a text input
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    // Wait 300ms for the keyboard to slide up
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }
}

function initMobileTweaks() {
  const width = window.innerWidth;
  const shouldBeMobile = width < 768;

  // If entering mobile mode for the first time
  if (shouldBeMobile && !isMobileMode) {
    document.addEventListener('focusin', handleMobileFocus);
    isMobileMode = true;
    console.log("Mobile optimizations enabled");
  } 
  // If switching to desktop (e.g. rotation), clean up
  else if (!shouldBeMobile && isMobileMode) {
    document.removeEventListener('focusin', handleMobileFocus);
    isMobileMode = false;
    console.log("Mobile optimizations disabled");
  }
}

// 1. Run on startup
initMobileTweaks();

// 2. Run on resize (Debounced to save battery)
window.addEventListener('resize', debounce(() => {
  initMobileTweaks();
}, 250));

/* ======================================
   4. TOAST NOTIFICATIONS SYSTEM
   ====================================== */
window.showToast = function(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Add simple icons based on type
  let icon = '';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'info') icon = 'ℹ️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  // Remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
};

/* ======================================
   5. BUTTON LOADING HELPER
   ====================================== */
window.setBtnLoading = function(btn, isLoading) {
  if (!btn) return;

  if (isLoading) {
    btn.classList.add("btn-loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
};

/* ======================================
   6. SESSION MONITOR
   ====================================== */
function initSessionMonitor() {
  setInterval(() => {
    const expiresAt = localStorage.getItem("sessionExpiresAt");
    if (!expiresAt) return;

    const timeLeft = parseInt(expiresAt) - Date.now();
    
    // Warn if less than 5 minutes left (300,000ms) but not yet expired
    if (timeLeft > 0 && timeLeft < 300000) {
      // Check if we already warned recently to avoid spamming
      const lastWarned = localStorage.getItem("sessionWarnedAt");
      if (!lastWarned || Date.now() - parseInt(lastWarned) > 60000) {
        showToast("⚠️ Your session will expire in 5 minutes.", "info");
        localStorage.setItem("sessionWarnedAt", Date.now());
      }
    }
  }, 60 * 1000); // Check every minute
}

initSessionMonitor();

/* ======================================
   7. INLINE VALIDATION HELPER
   ====================================== */
/**
 * @param {HTMLInputElement} input - The input element to validate
 * @param {Function} validateFn - Returns error string if invalid, null if valid
 */
window.setupInlineValidation = function(input, validateFn) {
  if (!input) return;

  const errorId = input.name + "-error-msg";
  let errorEl = document.getElementById(errorId);

  // 1. Create error message element dynamically if missing
  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.id = errorId;
    errorEl.className = "input-error-msg";
    // Insert right after the input
    input.parentNode.insertBefore(errorEl, input.nextSibling);
  }

  // 2. The Check Function
  const check = () => {
    const errorMsg = validateFn(input.value);
    
    if (errorMsg) {
      input.classList.add("input-invalid");
      input.classList.remove("input-valid");
      errorEl.textContent = errorMsg;
      errorEl.style.display = "block";
      return false;
    } else {
      input.classList.remove("input-invalid");
      // Only show green if not empty
      if (input.value.trim().length > 0) {
        input.classList.add("input-valid");
      }
      errorEl.style.display = "none";
      return true;
    }
  };

  // 3. Attach Listeners
  input.addEventListener("input", check); // Check while typing
  input.addEventListener("blur", check);  // Check when leaving field
  
  return check; // Return function so form can call it on submit
};