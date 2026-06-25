/* client/js/ui/pull-to-refresh.js */

(function() {
  let ptrContainer = null;
  let ptrIndicator = null;
  let ptrSvg = null;
  let startY = 0;
  let currentY = 0;
  let isPulling = false;
  let isRefreshing = false;
  const THRESHOLD = 70; // px
  const FRICTION = 0.4; // pull resistance factor
  let activeCallback = null;

  function initUI() {
    if (document.getElementById('ptr-container')) return;

    ptrContainer = document.createElement('div');
    ptrContainer.id = 'ptr-container';
    ptrContainer.className = 'pull-to-refresh-container';
    ptrContainer.innerHTML = `
      <div class="pull-to-refresh-indicator" id="ptr-indicator">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </div>
    `;

    document.body.appendChild(ptrContainer);
    ptrIndicator = document.getElementById('ptr-indicator');
    ptrSvg = ptrIndicator.querySelector('svg');
  }

  function handleTouchStart(e) {
    if (isRefreshing) return;
    
    // Only allow pull-to-refresh if scroll is at the very top
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 0) return;

    // Do not trigger if touching interactive elements or active modals
    const modalOpen = document.querySelector('.modal-overlay.active, .modal-box.active, .side-panel.is-open');
    if (modalOpen) return;

    startY = e.touches[0].clientY;
    isPulling = true;
    ptrContainer.classList.add('pulling');
  }

  function handleTouchMove(e) {
    if (!isPulling || isRefreshing) return;

    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    // Only handle downward pulling
    if (deltaY <= 0) {
      ptrContainer.style.transform = 'translateY(-100%)';
      ptrIndicator.style.transform = 'scale(0.6)';
      ptrIndicator.style.opacity = '0';
      return;
    }

    // Apply friction and cap pull distance
    const pullDistance = Math.min(deltaY * FRICTION, THRESHOLD + 20);
    ptrContainer.style.transform = `translateY(${pullDistance}px)`;

    const progress = Math.min(pullDistance / THRESHOLD, 1);
    ptrIndicator.style.transform = `scale(${0.6 + progress * 0.4})`;
    ptrIndicator.style.opacity = progress.toString();
    ptrSvg.style.transform = `rotate(${progress * 360}deg)`;

    if (pullDistance >= THRESHOLD) {
      if (!ptrIndicator.classList.contains('ready')) {
        ptrIndicator.classList.add('ready');
        if (typeof window.haptic === 'function') {
          window.haptic('light');
        }
      }
    } else {
      ptrIndicator.classList.remove('ready');
    }
  }

  async function handleTouchEnd() {
    if (!isPulling || isRefreshing) return;
    isPulling = false;
    ptrContainer.classList.remove('pulling');

    const deltaY = currentY - startY;
    const pullDistance = deltaY * FRICTION;

    if (pullDistance >= THRESHOLD && activeCallback) {
      // Trigger refreshing state
      isRefreshing = true;
      ptrIndicator.classList.remove('ready');
      ptrIndicator.classList.add('refreshing');
      ptrContainer.style.transform = `translateY(${THRESHOLD}px)`;

      try {
        await activeCallback();
      } catch (err) {
        console.error('Pull-to-refresh callback failed:', err);
      } finally {
        isRefreshing = false;
        ptrIndicator.classList.remove('refreshing');
        ptrContainer.style.transform = 'translateY(-100%)';
      }
    } else {
      // Cancel pull
      ptrContainer.style.transform = 'translateY(-100%)';
      ptrIndicator.style.transform = 'scale(0.6)';
      ptrIndicator.style.opacity = '0';
    }
    
    startY = 0;
    currentY = 0;
  }

  window.initPullToRefresh = function(refreshCallback) {
    if (typeof refreshCallback !== 'function') return;
    
    activeCallback = refreshCallback;
    document.body.classList.add('ptr-enabled');
    initUI();

    // Clean up existing listeners to prevent duplicates
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);

    // Register touch listeners on the window
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };
})();
