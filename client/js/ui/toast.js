// Extracted toast system — delegates to main.js showToast if available,
// otherwise provides standalone implementation.
// main.js already defines window.showToast; this file is a no-op shim
// that ensures the function exists before page scripts run.
if (!window.showToast) {
  window.showToast = function(message, type = 'info', options = null) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hiding');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 4000);
  };
}