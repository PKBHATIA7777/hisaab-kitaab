/**
 * Dashboard page orchestrator.
 * Imports and coordinates all dashboard features.
 * Replaces monolithic dashboard.js.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Guard against redirect loops (existing logic, kept)
  const GUARD_KEY = '__dash_redirects';
  const now = Date.now();
  const raw = sessionStorage.getItem(GUARD_KEY);
  const data = raw ? JSON.parse(raw) : { count: 0, time: 0 };
  if (now - data.time < 5000) { data.count++; } else { data.count = 1; data.time = now; }
  sessionStorage.setItem(GUARD_KEY, JSON.stringify(data));
  if (data.count > 3) {
    ['auth_token', 'session_expiry'].forEach(name => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    sessionStorage.removeItem(GUARD_KEY);
    window.location.replace('login.html');
    return;
  }

  // Cross-tab logout listener
  if (typeof SessionManager !== 'undefined') {
    SessionManager.on('logout', () => {
      showToast('Logged out from another tab. Redirecting...', 'info');
      setTimeout(() => window.location.replace('login.html?expired=true'), 2500);
    });
  }

  ChaptersGrid.initToolbar();

  try {
    const [authData] = await Promise.all([
      apiFetch('/auth/me'),
      apiFetch('/friends').then(d => { window._cachedFriends = d.friends || []; }).catch(() => {}),
    ]);

    window.currentUser = authData.user;
    ProfileModal.init(authData.user);
    renderNavProfile(authData.user);

    await ChaptersGrid.load();

  } catch (err) {
    if (err.isAuthRedirect) return; // Navigation already triggered
    if (err.status === 401 || err.status === 403) {
      ['session_expiry'].forEach(name => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      window.location.replace('login.html?expired=true');
    } else {
      showToast(getUserMessage(err), 'error', { label: 'Retry', callback: () => window.location.reload() });
    }
  }

  // FAB → create chapter
  document.getElementById('dashboard-fab')?.addEventListener('click', () => {
    EventBus.emit(EVENTS.CHAPTER_MODAL_OPEN, {});
  });

  // Card menu delegation
  document.getElementById('chapters-grid')?.addEventListener('click', async (e) => {
    const menuBtn = e.target.closest('.chapter-card__menu');
    if (!menuBtn) return;
    e.stopPropagation();
    const { chapterId, chapterName, chapterDesc, isArchived, isPersonal } = menuBtn.dataset;
    ChapterCardMenu.open(menuBtn, {
      id: chapterId, name: chapterName, description: chapterDesc,
      is_archived: isArchived === 'true', is_personal: isPersonal === 'true',
    });
  });
});

function renderNavProfile(user) {
  const btn = document.getElementById('profile-trigger');
  if (!btn) return;
  const color    = getAvatarColor(user.realName || user.username || '');
  const initials = getInitials(user.realName || user.username || '?');
  btn.style.background = color;
  btn.textContent = initials;
  btn.setAttribute('aria-label', `Profile: ${user.realName}`);
  btn.addEventListener('click', () => EventBus.emit(EVENTS.PROFILE_MODAL_OPEN, {}));
}