/* client/js/main.js */

/* ======================================
   1. CORE CONFIGURATION & NETWORK
   ====================================== */

// HELPER: Debounce
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ENVIRONMENT
const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5001/api"
  : "https://hisaab-kitaab-service-app.onrender.com/api";

// ✅ NEW: ROBUST CSRF HANDLING (Promise-based)
let csrfPromise = null; 

function initCSRF() {
  // If we are already fetching, return the existing promise (prevents double calls)
  if (csrfPromise) return csrfPromise;

  console.log("🔄 Initializing CSRF...");
  
  csrfPromise = fetch(API_BASE + "/csrf-token", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (data.csrfToken) {
        console.log("✅ CSRF Token loaded:", data.csrfToken);
        return data.csrfToken;
      }
      throw new Error("No token received");
    })
    .catch(err => {
      console.warn("⏳ Server is waking up or CSRF failed. Will retry...");
      csrfPromise = null; // Reset so apiFetch can try again
      return null; 
    });
    
  return csrfPromise;
}

// Start immediately on load
initCSRF();

// ✅ UPDATED FETCH WRAPPER
async function apiFetch(path, options = {}) {
  // 1. WAIT for the token. This line pauses code until server responds.
  let token = await initCSRF();

  // 2. If token is null (server error?), try ONE more time forcefully
  if (!token) {
    console.log("⚠️ Token missing, retrying init...");
    token = await initCSRF();
  }

  // 3. Proceed with request
  const res = await fetch(API_BASE + path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": token || "", // Send what we have
      ...(options.headers || {}),
    },
    credentials: "include",
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
   2. GOOGLE SIGN-IN & UTILS
   ====================================== */
async function handleGoogleCredential(response) {
  try {
    const idToken = response.credential;
    const data = await apiFetch("/auth/google", {
      method: "POST",
      body: { idToken },
    });
    showToast("Logged in as " + data.user.username, "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1000);
  } catch (err) {
    showToast(err.message || "Google sign-in failed", "error");
  }
}

// Expose globals
window.handleGoogleCredential = handleGoogleCredential;
window.apiFetch = apiFetch;

/* ======================================
   3. MOBILE KEYBOARD & ROTATION HELPER
   ====================================== */
let isMobileMode = false;
function handleMobileFocus(e) {
  const target = e.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
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
initMobileTweaks();
window.addEventListener('resize', debounce(initMobileTweaks, 250));

/* ======================================
   4. TOAST NOTIFICATIONS SYSTEM
   ====================================== */
window.showToast = function(message, type = 'info', action = null) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  let html = `<span>${icon}</span> <span style="flex-grow:1">${message}</span>`;
  if (action) {
    html += `<button id="toast-action-btn" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:5px 12px;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.85rem;margin-left:10px;">${action.label}</button>`;
  }
  toast.innerHTML = html;
  container.appendChild(toast);

  if (action) {
    const btn = toast.querySelector('#toast-action-btn');
    btn.addEventListener('click', () => { action.callback(); toast.remove(); });
  }

  const duration = action ? 6000 : 3500;
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
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
    if (timeLeft > 0 && timeLeft < 300000) {
      const lastWarned = localStorage.getItem("sessionWarnedAt");
      if (!lastWarned || Date.now() - parseInt(lastWarned) > 60000) {
        showToast("⚠️ Your session will expire in 5 minutes.", "info");
        localStorage.setItem("sessionWarnedAt", Date.now());
      }
    }
  }, 60 * 1000);
}
initSessionMonitor();

/* ======================================
   7. INLINE VALIDATION HELPER
   ====================================== */
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

/* ======================================
   8. PASSWORD UX HELPERS
   ====================================== */
function initPasswordToggles() {
  document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const input = newBtn.previousElementSibling;
      if (input.type === 'password') {
        input.type = 'text';
        newBtn.textContent = '🙈';
      } else {
        input.type = 'password';
        newBtn.textContent = '👁️';
      }
    });
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

document.addEventListener("DOMContentLoaded", () => {
  initPasswordToggles();
  initPasswordValidation();
});

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
  const seconds = Math.floor((now - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "Just now";
};

// Mobile Haptics
document.addEventListener('click', (e) => {
  const target = e.target.closest('button, a, .chapter-card');
  if (target && navigator.vibrate) {
    navigator.vibrate(50);
  }
});


// // client/js/main.js

// /* ======================================
//    1. CORE CONFIGURATION & NETWORK
//    ====================================== */

// // HELPER: Debounce (prevents functions from firing too often)
// function debounce(func, wait) {
//   let timeout;
//   return function(...args) {
//     clearTimeout(timeout);
//     timeout = setTimeout(() => func.apply(this, args), wait);
//   };
// }

// // AUTOMATIC ENVIRONMENT SWITCHING
// // Uses Localhost backend when you are developing, and Render backend when on Vercel/Web.
// const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
//   ? "http://localhost:5001/api"
//   : "https://hisaab-kitaab-service-app.onrender.com/api";

// // GLOBAL CSRF TOKEN STORAGE
// // We store the token here because Vercel (Frontend) cannot read cookies set by Render (Backend).
// let globalCsrfToken = "";

// // INITIALIZE CSRF ON LOAD
// (async function initCSRF() {
//   try {
//     // We hit this endpoint which does two things:
//     // 1. Sets the 'Secure' cookie in the browser (for the backend to verify later).
//     // 2. Returns the token in the JSON body (so we can send it in headers).
//     const res = await fetch(API_BASE + "/csrf-token", { credentials: "include" });
//     const data = await res.json();
    
//     if (data.csrfToken) {
//       globalCsrfToken = data.csrfToken;
//       console.log("CSRF Token initialized via API");
//     }
//   } catch (e) {
//     console.error("CSRF Init Error", e);
//   }
// })();

// // SHARED FETCH WRAPPER (ROBUST VERSION)
// async function apiFetch(path, options = {}) {
//   // Simple guard: If the token hasn't arrived yet, wait 500ms.
//   // This prevents race conditions on immediate page loads.
//   if (!globalCsrfToken) {
//     await new Promise(r => setTimeout(r, 500)); 
//   }

//   const res = await fetch(API_BASE + path, {
//     method: options.method || "GET",
//     headers: {
//       "Content-Type": "application/json",
//       // CRITICAL: Send the token from our variable, not document.cookie
//       "X-CSRF-Token": globalCsrfToken, 
//       ...(options.headers || {}),
//     },
//     credentials: "include", // Essential: Sends the HTTP-only cookie along with the request
//     body: options.body ? JSON.stringify(options.body) : undefined,
//   });

//   const data = await res.json().catch(() => ({}));
  
//   if (!res.ok) {
//     const error = new Error(data.message || "Request failed");
//     error.status = res.status;
//     throw error;
//   }
  
//   return data;
// }

// /* ======================================
//    2. GOOGLE SIGN-IN
//    ====================================== */
// async function handleGoogleCredential(response) {
//   try {
//     const idToken = response.credential;

//     const data = await apiFetch("/auth/google", {
//       method: "POST",
//       body: { idToken },
//     });

//     showToast("Logged in as " + data.user.username, "success");
    
//     // Slight delay so user sees the toast before redirect
//     setTimeout(() => {
//       window.location.href = "dashboard.html";
//     }, 1000);
    
//   } catch (err) {
//     showToast(err.message || "Google sign-in failed", "error");
//   }
// }

// // Expose globally so Google's script can call it
// window.handleGoogleCredential = handleGoogleCredential;
// window.apiFetch = apiFetch;

// /* ======================================
//    3. MOBILE KEYBOARD & ROTATION HELPER
//    ====================================== */

// let isMobileMode = false;

// function handleMobileFocus(e) {
//   const target = e.target;
//   // Only act if it's a text input
//   if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
//     // Wait 300ms for the keyboard to slide up
//     setTimeout(() => {
//       target.scrollIntoView({ behavior: 'smooth', block: 'center' });
//     }, 300);
//   }
// }

// function initMobileTweaks() {
//   const width = window.innerWidth;
//   const shouldBeMobile = width < 768;

//   // If entering mobile mode for the first time
//   if (shouldBeMobile && !isMobileMode) {
//     document.addEventListener('focusin', handleMobileFocus);
//     isMobileMode = true;
//     console.log("Mobile optimizations enabled");
//   } 
//   // If switching to desktop (e.g. rotation), clean up
//   else if (!shouldBeMobile && isMobileMode) {
//     document.removeEventListener('focusin', handleMobileFocus);
//     isMobileMode = false;
//     console.log("Mobile optimizations disabled");
//   }
// }

// // 1. Run on startup
// initMobileTweaks();

// // 2. Run on resize (Debounced to save battery)
// window.addEventListener('resize', debounce(() => {
//   initMobileTweaks();
// }, 250));

// /* ======================================
//    4. TOAST NOTIFICATIONS SYSTEM
//    ====================================== */
// window.showToast = function(message, type = 'info', action = null) {
//   let container = document.querySelector('.toast-container');
//   if (!container) {
//     container = document.createElement('div');
//     container.className = 'toast-container';
//     document.body.appendChild(container);
//   }

//   const toast = document.createElement('div');
//   toast.className = `toast ${type}`;
  
//   let icon = 'ℹ️';
//   if (type === 'success') icon = '✅';
//   if (type === 'error') icon = '❌';

//   // Basic Text
//   let html = `<span>${icon}</span> <span style="flex-grow:1">${message}</span>`;
  
//   // ✅ NEW: Action Button (e.g., Undo)
//   if (action) {
//     html += `<button id="toast-action-btn" style="
//       background: rgba(255,255,255,0.2); 
//       border: none; 
//       color: #fff; 
//       padding: 5px 12px; 
//       border-radius: 4px; 
//       cursor: pointer; 
//       font-weight: 600;
//       font-size: 0.85rem;
//       margin-left: 10px;
//     ">${action.label}</button>`;
//   }

//   toast.innerHTML = html;
//   container.appendChild(toast);

//   // Attach click listener for action
//   if (action) {
//     const btn = toast.querySelector('#toast-action-btn');
//     btn.addEventListener('click', () => {
//       action.callback();
//       toast.remove(); // Close immediately on click
//     });
//   }

//   // Remove after delay (longer if there is an action)
//   const duration = action ? 6000 : 3500;
  
//   const timer = setTimeout(() => {
//     toast.classList.add('hiding');
//     toast.addEventListener('animationend', () => toast.remove());
//   }, duration);
// };

// /* ======================================
//    5. BUTTON LOADING HELPER
//    ====================================== */
// window.setBtnLoading = function(btn, isLoading) {
//   if (!btn) return;

//   if (isLoading) {
//     btn.classList.add("btn-loading");
//     btn.disabled = true;
//   } else {
//     btn.classList.remove("btn-loading");
//     btn.disabled = false;
//   }
// };

// /* ======================================
//    6. SESSION MONITOR
//    ====================================== */
// function initSessionMonitor() {
//   setInterval(() => {
//     const expiresAt = localStorage.getItem("sessionExpiresAt");
//     if (!expiresAt) return;

//     const timeLeft = parseInt(expiresAt) - Date.now();
    
//     // Warn if less than 5 minutes left (300,000ms) but not yet expired
//     if (timeLeft > 0 && timeLeft < 300000) {
//       // Check if we already warned recently to avoid spamming
//       const lastWarned = localStorage.getItem("sessionWarnedAt");
//       if (!lastWarned || Date.now() - parseInt(lastWarned) > 60000) {
//         showToast("⚠️ Your session will expire in 5 minutes.", "info");
//         localStorage.setItem("sessionWarnedAt", Date.now());
//       }
//     }
//   }, 60 * 1000); // Check every minute
// }

// initSessionMonitor();

// /* ======================================
//    7. INLINE VALIDATION HELPER
//    ====================================== */
// /**
//  * @param {HTMLInputElement} input - The input element to validate
//  * @param {Function} validateFn - Returns error string if invalid, null if valid
//  */
// window.setupInlineValidation = function(input, validateFn) {
//   if (!input) return;

//   const errorId = input.name + "-error-msg";
//   let errorEl = document.getElementById(errorId);

//   if (!errorEl) {
//     errorEl = document.createElement("div");
//     errorEl.id = errorId;
//     errorEl.className = "input-error-msg";
//     // ✅ NEW: Live Region for Screen Readers
//     errorEl.setAttribute("aria-live", "assertive"); 
//     input.parentNode.insertBefore(errorEl, input.nextSibling);
    
//     // Link input to error message
//     input.setAttribute("aria-describedby", errorId);
//   }

//   const check = () => {
//     const errorMsg = validateFn(input.value);
    
//     if (errorMsg) {
//       input.classList.add("input-invalid");
//       input.classList.remove("input-valid");
//       // ✅ NEW: ARIA Invalid State
//       input.setAttribute("aria-invalid", "true");
//       errorEl.textContent = errorMsg;
//       errorEl.style.display = "block";
//       return false;
//     } else {
//       input.classList.remove("input-invalid");
//       input.setAttribute("aria-invalid", "false");
//       if (input.value.trim().length > 0) {
//         input.classList.add("input-valid");
//       }
//       errorEl.style.display = "none";
//       return true;
//     }
//   };

//   input.addEventListener("input", check);
//   input.addEventListener("blur", check);
  
//   return check;
// };

// /* ======================================
//    8. PASSWORD UX HELPERS
//    ====================================== */

// // 1. Toggle Visibility
// function initPasswordToggles() {
//   document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
//     // Remove old listener to be safe (if re-initialized)
//     const newBtn = btn.cloneNode(true);
//     btn.parentNode.replaceChild(newBtn, btn);
    
//     newBtn.addEventListener('click', (e) => {
//       e.preventDefault(); // Prevent form submit
//       const input = newBtn.previousElementSibling;
//       if (input.type === 'password') {
//         input.type = 'text';
//         newBtn.textContent = '🙈'; // Closed eye / Hide
//       } else {
//         input.type = 'password';
//         newBtn.textContent = '👁️'; // Open eye / Show
//       }
//     });
//   });
// }

// // 2. Live Validation (Length Check)
// function initPasswordValidation() {
//   document.querySelectorAll('input[type="password"]').forEach(input => {
//     // Look for the hint text immediately after the wrapper
//     const wrapper = input.closest('.password-wrapper');
//     if (!wrapper) return;
    
//     const hint = wrapper.nextElementSibling;
//     if (hint && hint.classList.contains('password-hint')) {
//       input.addEventListener('input', () => {
//         const isValid = input.value.length >= 8;
//         if (isValid) {
//           hint.classList.remove('invalid');
//           hint.classList.add('valid');
//           hint.textContent = "✓ Password is 8 characters or more";
//         } else {
//           hint.classList.remove('valid');
//           hint.classList.add('invalid');
//           hint.textContent = "Password must be at least 8 characters long";
//         }
//       });
//     }
//   });
// }

// // Auto-run on page load
// document.addEventListener("DOMContentLoaded", () => {
//   initPasswordToggles();
//   initPasswordValidation();
// });

// // ✅ NEW: Generate consistent pastel color from any string
// window.getAvatarColor = function(name) {
//   if (!name) return "#ccc";
//   let hash = 0;
//   for (let i = 0; i < name.length; i++) {
//     hash = name.charCodeAt(i) + ((hash << 5) - hash);
//   }
//   // Hue: 0-360, Saturation: 70%, Lightness: 60% (Pastel)
//   const h = Math.abs(hash) % 360;
//   return `hsl(${h}, 70%, 60%)`;
// };

// // ✅ NEW: Relative Time (e.g. "2 days ago")
// window.timeAgo = function(dateString) {
//   if (!dateString) return "";
//   const date = new Date(dateString);
//   const now = new Date();
//   const seconds = Math.floor((now - date) / 1000);
  
//   let interval = seconds / 31536000;
//   if (interval > 1) return Math.floor(interval) + "y ago";
//   interval = seconds / 2592000;
//   if (interval > 1) return Math.floor(interval) + "mo ago";
//   interval = seconds / 86400;
//   if (interval > 1) return Math.floor(interval) + "d ago";
//   interval = seconds / 3600;
//   if (interval > 1) return Math.floor(interval) + "h ago";
//   interval = seconds / 60;
//   if (interval > 1) return Math.floor(interval) + "m ago";
//   return "Just now";
// };

// /* client/js/main.js - Bottom of file */

// // ✅ NEW: Mobile Haptics
// // Automatically vibrate on any button or link click
// document.addEventListener('click', (e) => {
//   // Check if the clicked element is a button or link
//   const target = e.target.closest('button, a, .chapter-card');
  
//   if (target && navigator.vibrate) {
//     // 50ms vibration (light tap)
//     navigator.vibrate(50);
//   }
// });
