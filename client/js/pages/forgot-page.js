
let resetEmail = "";

document.addEventListener('DOMContentLoaded', () => {
  if (window.wakeUpServer) window.wakeUpServer().catch(() => {});
});

const forgotForm = document.getElementById("forgot-form");
const resetStep = document.getElementById("reset-step");
const resetForm = document.getElementById("reset-form");

if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = new FormData(forgotForm).get("email");
    resetEmail = email;
    const btn = forgotForm.querySelector('button[type="submit"]');
    if (btn) setBtnLoading(btn, true);
    try {
      await apiFetch("/auth/forgot/request-otp", {
        method: "POST",
        body: { email },
      });
      showToast("If this email exists, a reset code has been sent.", "success");
      forgotForm.style.display = 'none';
      resetStep.hidden = false;
    } catch (err) {
      showToast(err.message || "Failed to send reset code. Please try again.", "error");
    } finally {
      if (btn) setBtnLoading(btn, false);
    }
  });
}

if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(resetForm);
    const btn = resetForm.querySelector('button[type="submit"]');
    if (btn) setBtnLoading(btn, true);
    try {
      await apiFetch("/auth/forgot/reset", {
        method: "POST",
        body: { email: resetEmail, otp: fd.get("otp"), newPassword: fd.get("newPassword") },
      });
      showToast("Password reset successfully. Redirecting to login...", "success");
      setTimeout(() => {
        if (typeof window.navigateTo === 'function') window.navigateTo("login.html");
        else window.location.href = "login.html";
      }, 1500);
    } catch (err) {
      showToast(err.message || "Invalid or expired code. Please try again.", "error");
    } finally {
      if (btn) setBtnLoading(btn, false);
    }
  });
}
