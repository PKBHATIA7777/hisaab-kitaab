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
    toast.className = `toast toast-${type} ${type}`;
    toast.setAttribute('role', 'alert');

    let iconHtml = '';
    if (type === 'success') {
      iconHtml = `<div class="toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
    } else if (type === 'error') {
      iconHtml = `<div class="toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>`;
    } else if (type === 'info') {
      iconHtml = `<div class="toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></div>`;
    }

    toast.innerHTML = `
      ${iconHtml}
      <span style="flex:1;">${message}</span>
      <div class="toast-progress"></div>
    `;
    container.appendChild(toast);

    // Touch Swipe-to-dismiss on Mobile
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    toast.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      toast.style.transition = 'none';
    }, { passive: true });

    toast.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX - startX;
      if (currentX > 0) {
        toast.style.transform = `translateX(${currentX}px)`;
        toast.style.opacity = 1 - (currentX / 200);
      }
    }, { passive: true });

    toast.addEventListener('touchend', () => {
      isDragging = false;
      toast.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
      if (currentX > 80) {
        toast.style.transform = `translateX(120%)`;
        toast.style.opacity = 0;
        setTimeout(() => {
          if (toast.parentElement) toast.remove();
        }, 150);
      } else {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
      }
      currentX = 0;
    });

    setTimeout(() => {
      if (isDragging) return;
      toast.classList.add('hiding');
      toast.addEventListener('animationend', () => {
        if (toast.parentElement) toast.remove();
      }, { once: true });
    }, 4000);
  };
}