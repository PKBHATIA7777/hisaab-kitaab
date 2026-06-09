// Extracted button loading helper — delegates to main.js setBtnLoading if available.
if (!window.setBtnLoading) {
  window.setBtnLoading = function(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.classList.add('btn--loading');
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || btn.textContent;
      btn.classList.remove('btn--loading');
      btn.disabled = false;
      delete btn.dataset.originalText;
    }
  };
}