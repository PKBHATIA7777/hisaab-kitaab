// STEP 6: Pre-fetch CSRF token on page load for iOS Safari
// iOS ITP may block the cookie on first visit, so we fetch it explicitly
// and store fallback in sessionStorage
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(window.APP_CONFIG?.API_BASE + '/auth/me' || '/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    const csrfHeader = res.headers.get('X-CSRF-Token');
    if (csrfHeader) {
      window.__csrfToken = csrfHeader;
      // Fallback for iOS ITP cookie blocking
      try { sessionStorage.setItem('__csrf_fallback', csrfHeader); } catch(_) {}
    }
  } catch(_) { /* ignore — just priming the cookie */ }
});

let signupEmail = "";

// STEP 5 Part C: Prevent duplicate OTP/email submissions
let otpRequestInFlight = false;

// STEP 15 — Fix Double OTP Submission Race (AUTH-010)
// Module-level guard for OTP auto-submit
let _otpAutoSubmitInFlight = false;

const els = {
  step1: document.getElementById('step-1'),
  step2: document.getElementById('step-2'),
  step3: document.getElementById('step-3'),
  inputEmail: document.getElementById('input-email'),
  inputOtp: document.getElementById('input-otp'),
  inputName: document.getElementById('input-name'),
  displayEmail: document.getElementById('display-email'),
  btnResend: document.getElementById('btn-resend')
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.initPasswordToggles) initPasswordToggles();
  els.inputEmail.focus();
});

/* --- STEP 1: EMAIL --- */
async function handleEmailSubmit(e) {
  // STEP 5 Part C: Prevent duplicate submissions
  if (otpRequestInFlight) return;
  otpRequestInFlight = true;
  
  e.preventDefault();
  const email = els.inputEmail.value.trim();
  const btn = document.getElementById('btn-email');
  if (!email) return;
  setBtnLoading(btn, true);

  try {
    // Wake server before OTP request
    if (window.wakeUpServer && !window.isServerAwake()) {
      btn.innerHTML = 'Connecting...';
      try {
        await Promise.race([
          window.wakeUpServer(),
          new Promise(resolve => setTimeout(resolve, 40000))
        ]);
      } catch (_) {}
    }

    await apiFetch("/auth/register/request-otp", {
      method: "POST",
      body: { email }
    });

    signupEmail = email;
    els.displayEmail.textContent = email;
    slide(els.step1, els.step2);

    // STEP 14: Start countdown timer after OTP is sent successfully
    startOtpCountdown(600);

    setTimeout(() => {
      if (els.inputOtp) els.inputOtp.focus();
    }, 400);

    startResendTimer();
    attachOtpAutoSubmit();

  } catch (err) {
    const msg = err.message || "Failed to send code";
    if (err.status === 503 || err.retryable) {
      showToast(msg + " Please try again.", "error");
    } else if (err.isTimeout) {
      showToast("Request timed out — please try again.", "error");
    } else {
      showToast(msg, "error");
    }
    document.querySelector('.auth-card').classList.add('shake-card');
    setTimeout(() => document.querySelector('.auth-card').classList.remove('shake-card'), 500);
  } finally {
    // STEP 5 Part C: Reset the in-flight flag
    otpRequestInFlight = false;
    setBtnLoading(btn, false);
  }
}

/* --- STEP 14: OTP Countdown Timer Function (AUTH-UX-002, AUTH-UX-003) --- */
let countdownTimer = null;

function startOtpCountdown(durationSeconds = 600) {
  // Remove existing countdown if any
  document.getElementById("otp-countdown")?.remove();

  const countdownEl = document.createElement("div");
  countdownEl.id = "otp-countdown";
  countdownEl.style.cssText = `
    text-align:center; font-size:0.82rem; color:#888;
    margin-top:8px; font-family:var(--font-main);
  `;

  // Insert after the OTP input in step 2
  const otpForm = document.getElementById("form-otp");
  if (otpForm) otpForm.insertAdjacentElement("beforeend", countdownEl);

  let remaining = durationSeconds;

  function tick() {
    if (remaining <= 0) {
      countdownEl.innerHTML =
        `<span style="color:#ff1744;">⏰ Code expired — <button
          style="background:none;border:none;color:#d000ff;font-weight:600;
          cursor:pointer;font-family:var(--font-main);"
          onclick="resendOtp()">Request a new one</button></span>`;
      clearInterval(countdownTimer);
      return;
    }
    const mins = Math.floor(remaining / 60);
    const secs = String(remaining % 60).padStart(2, "0");
    countdownEl.textContent = `Code expires in ${mins}:${secs}`;
    remaining--;
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* --- OTP AUTO-SUBMIT (safe for all iOS versions) --- */
function attachOtpAutoSubmit() {
  const old = els.inputOtp;
  if (!old) return;
  const fresh = old.cloneNode(true);
  old.parentNode.replaceChild(fresh, old);
  els.inputOtp = fresh;

  setTimeout(() => fresh.focus(), 120);

  // STEP 15: Wrap auto-submit with race condition guard
 fresh.addEventListener('input', function() {
  const clean = this.value.replace(/\D/g, '').slice(0, 6);
  if (this.value !== clean) this.value = clean;
  
  if (clean.length === 6 && !_otpAutoSubmitInFlight) {
    _otpAutoSubmitInFlight = true;
    this.blur();
    const form = document.getElementById('form-otp');
    if (form) {
      if (typeof form.requestSubmit === 'function') {
        try { 
          form.requestSubmit(); 
          return;
        } catch(_) {}
      }
      handleOtpSubmit({ preventDefault: () => {} }).catch(() => {
        _otpAutoSubmitInFlight = false;
      });
    } else {
      _otpAutoSubmitInFlight = false;
    }
  }
});
}

/* --- STEP 2: OTP VERIFY --- */
async function handleOtpSubmit(e) {
  e.preventDefault();
  const otp = els.inputOtp.value.replace(/\D/g, '');
  if (otp.length !== 6) {
    showToast("Please enter the complete 6-digit code", "error");
    return;
  }
  const btn = document.getElementById('btn-otp');
  setBtnLoading(btn, true);

  try {
    // STEP 7: Handle signup token fallback for iOS ITP
    const data = await apiFetch("/auth/register/verify-otp", {
      method: "POST",
      body: { email: signupEmail, otp }
    });

    // AUTH-01 FIX: Store only the opaque session ID (not a signed JWT) in sessionStorage.
    // An opaque random ID has no value to an attacker — the actual session data
    // lives server-side. This eliminates the XSS risk of storing a signed JWT.
    if (data._signupSessionId) {
      try { sessionStorage.setItem('_st', data._signupSessionId); } catch(_) {}
    }

    // Store verification proof in sessionStorage as fallback for iOS ITP
    sessionStorage.setItem('email_verified', signupEmail);
    sessionStorage.setItem('verify_time', Date.now().toString());

    slide(els.step2, els.step3);
    
    // STEP 14: Add back button to step 3 (only once)
    if (!document.getElementById('btn-back-step3')) {
      els.step3.insertAdjacentHTML("afterbegin", `
        <button type="button" id="btn-back-step3" onclick="goBackToStep2()"
          style="background:none;border:none;color:#666;font-family:var(--font-main);
          font-size:0.9rem;cursor:pointer;padding:0;margin-bottom:15px;
          display:flex;align-items:center;gap:5px;">
          ← Back
        </button>
      `);
    }
    
    setTimeout(() => {
      if (els.inputName) els.inputName.focus();
    }, 400);

  } catch (err) {
    showToast(err.message || "Invalid code", "error");
    els.inputOtp.classList.add('shake-card');
    setTimeout(() => els.inputOtp.classList.remove('shake-card'), 500);
    els.inputOtp.value = "";
  } finally {
    // STEP 15: Reset the auto-submit guard
    _otpAutoSubmitInFlight = false;
    setBtnLoading(btn, false);
  }
}

/* --- STEP 3: DETAILS --- */
async function handleDetailsSubmit(e) {
  e.preventDefault();
  const formData = new FormData(document.getElementById('form-details'));
  const btn = document.getElementById('btn-finish');
  setBtnLoading(btn, true);

  try {
    // AUTH-01 FIX: Get the opaque session ID (not a signed JWT) for iOS ITP fallback
    let signupSessionId = null;
    try { signupSessionId = sessionStorage.getItem('_st'); } catch(_) {}

    await apiFetch("/auth/register/complete", {
      method: "POST",
      // Pass opaque session ID as Authorization header if cookie might not work on iOS.
      // Also send the email so the server can look up the session mapping.
      headers: signupSessionId ? { 'Authorization': `Bearer ${signupSessionId}` } : {},
      body: {
        realName: formData.get("realName"),
        password: formData.get("password"),
        // Include email for the server-side session lookup (iOS ITP fallback path only)
        email: signupEmail,
      }
    });

    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    window.location.href = "dashboard.html";

  } catch (err) {
    showToast(err.message || "Registration failed", "error");
  } finally {
    setBtnLoading(btn, false);
  }
}

/* --- UTILS --- */
function slide(fromEl, toEl) {
  fromEl.classList.replace('step-active', 'step-hidden-left');
  toEl.classList.replace('step-hidden-right', 'step-active');
}

function goBackToStep1() {
  els.step2.classList.replace('step-active', 'step-hidden-right');
  els.step1.classList.replace('step-hidden-left', 'step-active');
  setTimeout(() => els.inputEmail.focus(), 100);
}

// STEP 14: Add back button function for step 3 → step 2
function goBackToStep2() {
  els.step3.classList.replace('step-active', 'step-hidden-right');
  els.step2.classList.replace('step-hidden-left', 'step-active');
  setTimeout(() => {
    if (els.inputOtp) els.inputOtp.focus();
  }, 100);
}

let resendTimer = null;
function startResendTimer() {
  let count = 60;
  els.btnResend.disabled = true;
  els.btnResend.textContent = `Resend in ${count}s`;

  if (resendTimer) clearInterval(resendTimer);

  resendTimer = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(resendTimer);
      els.btnResend.disabled = false;
      els.btnResend.textContent = "Resend Code";
    } else {
      els.btnResend.textContent = `Resend in ${count}s`;
    }
  }, 1000);
}

async function resendOtp() {
  try {
    await apiFetch("/auth/register/request-otp", {
      method: "POST",
      body: { email: signupEmail }
    });
    showToast("Code resent!");
    startResendTimer();
    attachOtpAutoSubmit();
  } catch (err) {
    showToast(err.message || "Failed to resend", "error");
  }
}