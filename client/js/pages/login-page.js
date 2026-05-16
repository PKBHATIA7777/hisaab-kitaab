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

    /* --- STATE --- */
    let userContext = { identifier: '', email: '', provider: 'local', hasPassword: false };
    
    // STEP 5 Part C: Prevent duplicate OTP submissions
    let otpRequestInFlight = false;

    const els = {
      step1: document.getElementById('step-1'),
      step2: document.getElementById('step-2'),
      authCard: document.querySelector('.auth-card'),
      inputIdentifier: document.getElementById('input-identifier'),
      welcomeUser: document.getElementById('welcome-user'),
      formPass: document.getElementById('form-password'),
      otpSection: document.getElementById('otp-section'),
      otpReqState: document.getElementById('otp-request-state'),
      formOtp: document.getElementById('form-otp'),
      googleContainer: document.getElementById('google-container'),
      btnBackPass: document.getElementById('btn-back-pass')
    };

    document.addEventListener('DOMContentLoaded', () => {
      const lastUser = localStorage.getItem('last_user');
      if (lastUser) els.inputIdentifier.value = lastUser;
      if (window.initPasswordToggles) initPasswordToggles();
    });

    /* --- STEP 1: CHECK IDENTIFIER --- */
    async function handleIdentifierSubmit(e) {
      e.preventDefault();
      const identifier = els.inputIdentifier.value.trim();
      if (!identifier) return;

      const btn = document.getElementById('btn-next');
      setBtnLoading(btn, true);

      // If server isn't confirmed awake yet, show user-friendly message
      // and wait. This prevents the 60s timeout surprise.
      if (!window.isServerAwake || !window.isServerAwake()) {
        const originalText = btn.dataset.originalText || btn.textContent;
        btn.innerHTML = 'Connecting to server...';
        btn.disabled = true;
        
        try {
          await Promise.race([
            window.wakeUpServer ? window.wakeUpServer() : Promise.resolve(),
            new Promise(resolve => setTimeout(resolve, 35000)) // max wait 35s
          ]);
        } catch (_) { /* proceed regardless */ }
        
        btn.disabled = false;
        // setBtnLoading will restore text
      }

      try {
        const res = await apiFetch('/auth/check-identifier', {
          method: 'POST',
          body: { identifier }
        });

        if (res.exists) {
          userContext = { ...res, identifier };
          localStorage.setItem('last_user', identifier);
          transitionToStep2();
        } else {
          showToast("Account not found. Please create an account.", "error");
          els.authCard.classList.add('shake-card');
          setTimeout(() => els.authCard.classList.remove('shake-card'), 500);
        }
      } catch (err) {
        showToast(err.message || "Failed to check account", "error");
      } finally {
        setBtnLoading(btn, false);
      }
    }

    /* FIX C: New transitionToStep2 with height measurement and rAF batching */
    function transitionToStep2() {
      const card = document.querySelector('.auth-card');
      const currentHeight = card.offsetHeight;
      card.style.minHeight = currentHeight + 'px';

      // Use rAF to batch DOM changes so iOS doesn't drop frames
      requestAnimationFrame(() => {
        els.welcomeUser.textContent = `Hi, ${userContext.email.split('@')[0]}`;

        if (userContext.provider === 'google' || !userContext.hasPassword) {
          els.formPass.style.display = 'none';
          els.otpSection.style.display = 'block';
          els.otpReqState.style.display = 'block';
          els.formOtp.style.display = 'none';
          els.googleContainer.style.display = 'block';
          // Show fallback message if Google button didn't render
          setTimeout(() => {
            const googleBtn = document.querySelector('.g_id_signin iframe');
            if (!googleBtn) {
              document.getElementById('google-blocked-msg').style.display = 'block';
            }
          }, 2000);
          els.btnBackPass.style.display = 'none';
        } else {
          els.formPass.style.display = 'block';
          els.otpSection.style.display = 'none';
          els.googleContainer.style.display = 'none';
        }

        els.step1.classList.replace('step-active', 'step-hidden-left');
        els.step2.classList.replace('step-hidden-right', 'step-active');

        // After content settles, release the fixed height
        requestAnimationFrame(() => {
          card.style.minHeight = '';
          if (userContext.hasPassword && userContext.provider !== 'google') {
            setTimeout(() => document.getElementById('input-password')?.focus(), 50);
          }
        });
      });
    }

    function goToStep1() {
      els.step2.classList.replace('step-active', 'step-hidden-right');
      els.step1.classList.replace('step-hidden-left', 'step-active');
    }

    /* --- AUTO-SWITCH TO OTP --- */
    async function handleAutoOtpSwitch(btn) {
      await requestLoginOtp(btn);
    }

    /* --- REQUEST OTP --- */
    async function requestLoginOtp(targetBtn = null) {
      // STEP 5 Part C: Prevent duplicate OTP submissions
      if (otpRequestInFlight) return;
      otpRequestInFlight = true;
      
      const btn = targetBtn || document.getElementById('btn-req-otp');
      setBtnLoading(btn, true);

      try {
        // STEP 5 Part B: Show server-starting state immediately on OTP click
        if (window.wakeUpServer && !window.isServerAwake()) {
          // Show a message inside the button area
          if (btn) {
            const originalText = btn.dataset.originalText || 'Send Login Code';
            btn.innerHTML = 'Connecting to server...';
          }
          showServerStartingBanner();
          try {
            await Promise.race([
              window.wakeUpServer(),
              new Promise(resolve => setTimeout(resolve, 85000))
            ]);
          } catch (_) {}
          hideServerStartingBanner();
        }

        await apiFetch('/auth/login/otp-request', {
          method: 'POST',
          body: { email: userContext.email }
        });

        els.formPass.style.display = 'none';
        els.otpSection.style.display = 'block';
        els.otpReqState.style.display = 'none';
        els.formOtp.style.display = 'block';

        showToast(`Code sent to ${userContext.email}`, "success");

        const otpInput = document.getElementById('input-otp');
        if (otpInput) {
          // Remove stale listeners via clone
          const newInput = otpInput.cloneNode(true);
          otpInput.parentNode.replaceChild(newInput, otpInput);
          
          setTimeout(() => newInput.focus(), 120);

          newInput.addEventListener('input', function() {
            // Sanitize to digits only
            const clean = this.value.replace(/\D/g, '').slice(0, 6);
            if (this.value !== clean) this.value = clean;
            
            if (clean.length === 6) {
              this.blur();
              // Use both methods for maximum iOS compatibility
              const form = document.getElementById('form-otp');
              if (form) {
                // iOS 15.4+: requestSubmit works
                if (typeof form.requestSubmit === 'function') {
                  try { form.requestSubmit(); return; } catch(_) {}
                }
                // iOS < 15.4: manually call handler
                handleOtpSubmit({ preventDefault: () => {} });
              }
            }
          });
        }

      } catch (err) {
        showToast(err.message || "Failed to send code", "error");
      } finally {
        // STEP 5 Part C: Reset the in-flight flag
        otpRequestInFlight = false;
        setBtnLoading(btn, false);
      }
    }

    /* --- SWITCH BACK TO PASSWORD --- */
    function switchToPasswordMode() {
      els.otpSection.style.display = 'none';
      els.formPass.style.display = 'block';
      setTimeout(() => {
        const pwInput = document.getElementById('input-password');
        if (pwInput) pwInput.focus();
      }, 100);
    }

    /* --- LOGIN: PASSWORD --- */
    async function handlePasswordSubmit(e) {
      e.preventDefault();
      const password = document.getElementById('input-password').value;
      const rememberMe = document.querySelector('input[name="rememberMe"]').checked;
      const btn = document.getElementById('btn-login-pass');

      setBtnLoading(btn, true);

      try {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: { identifier: userContext.identifier, password, rememberMe }
        });
        loginSuccess(data);
      } catch (err) {
        showToast("Incorrect password. Try OTP login if forgotten.", "error");
        els.authCard.classList.add('shake-card');
        setTimeout(() => els.authCard.classList.remove('shake-card'), 500);
        document.getElementById('input-password').value = "";
      } finally {
        setBtnLoading(btn, false);
      }
    }

    /* --- LOGIN: OTP VERIFY --- */
    async function handleOtpSubmit(e) {
      e.preventDefault();
      const otp = document.getElementById('input-otp').value.replace(/\D/g, '');
      if (otp.length !== 6) {
        showToast("Please enter the 6-digit code", "error");
        return;
      }
      const btn = document.getElementById('btn-verify-otp');
      setBtnLoading(btn, true);

      try {
        const data = await apiFetch('/auth/login/otp-verify', {
          method: 'POST',
          body: { email: userContext.email, otp, rememberMe: true }
        });
        loginSuccess(data);
      } catch (err) {
        showToast(err.message || "Invalid Code", "error");
        els.authCard.classList.add('shake-card');
        setTimeout(() => els.authCard.classList.remove('shake-card'), 500);
        document.getElementById('input-otp').value = "";
      } finally {
        setBtnLoading(btn, false);
      }
    }

    function loginSuccess(data) {
      if (data.sessionExpiresAt) localStorage.setItem("sessionExpiresAt", data.sessionExpiresAt);
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      window.location.href = "dashboard.html";
    }