
    const forgotForm = document.getElementById("forgot-form");
    const resetStep = document.getElementById("reset-step");
    const resetForm = document.getElementById("reset-form");

    // Wake up server immediately so it's ready when user submits
    document.addEventListener('DOMContentLoaded', () => {
      if (window.wakeUpServer) {
        window.wakeUpServer().catch(() => {});
      }
    });

    let resetEmail = "";
  
    if (forgotForm) {
      forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(forgotForm);
        const email = formData.get("email");
        resetEmail = email;

        const submitBtn = forgotForm.querySelector('button[type="submit"]');
        if (submitBtn) setBtnLoading(submitBtn, true);

        // Ensure server is awake
        if (window.wakeUpServer && !window.isServerAwake()) {
          try {
            await Promise.race([
              window.wakeUpServer(),
              new Promise(resolve => setTimeout(resolve, 40000))
            ]);
          } catch (_) {}
        }
  
        try {
          await apiFetch("/auth/forgot/request-otp", {
            method: "POST",
            body: { email },
          });
          alert("If this email exists, OTP is sent (check server console).");
          forgotForm.style.display = 'none'; 
          document.querySelector('.auth-subtitle').textContent = "Create a new password";
          resetStep.hidden = false;
        } catch (err) {
          alert(err.message || "Failed to send reset OTP");
        }
      });
    }
  
    if (resetForm) {
      resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(resetForm);
        const otp = formData.get("otp");
        const newPassword = formData.get("newPassword");
  
        try {
          await apiFetch("/auth/forgot/reset", {
            method: "POST",
            body: { email: resetEmail, otp, newPassword },
          });
          alert("Password reset. Please log in with new password.");
          window.location.href = "login.html";
        } catch (err) {
          alert(err.message || "Failed to reset password");
        }
      });
    }
