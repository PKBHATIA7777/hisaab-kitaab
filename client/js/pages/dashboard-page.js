/**
 * Dashboard page orchestrator.
 * Imports and coordinates all dashboard features.
 * Replaces monolithic dashboard.js.
 */
/**
 * Shows a first-time onboarding banner for users with no chapters.
 * Dismissed state is persisted via SafeStorage (never shown again once seen).
 */
function _showOnboardingIfNeeded(chaptersCount) {
  const SEEN_KEY = 'hk_onboarding_v1';
  if (SafeStorage.get(SEEN_KEY) || chaptersCount > 0) return;

  const banner = document.createElement('div');
  banner.id = 'onboarding-banner';
  banner.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(208,0,255,0.12),rgba(138,0,224,0.08));
                border:1.5px solid rgba(208,0,255,0.3);border-radius:var(--r-lg);
                padding:var(--s-5);margin-bottom:var(--s-6);display:flex;
                align-items:flex-start;gap:var(--s-4);">
      <span style="font-size:1.8rem;flex-shrink:0;"></span>
      <div style="flex:1;">
        <p style="color:#fff;font-weight:600;font-size:var(--text-base);margin:0 0 var(--s-1);">
          Welcome to Hisaab-Kitaab!
        </p>
        <p style="color:rgba(255,255,255,0.7);font-size:var(--text-sm);margin:0 0 var(--s-3);line-height:1.5;">
          A <strong style="color:#fff;">chapter</strong> is a shared expense group —
          for a trip, your flat, a birthday dinner, or any group expense you want to split fairly.
        </p>
        <button class="btn btn--brand" style="width:auto;padding:0 var(--s-5);"
          onclick="EventBus.emit(EVENTS.CHAPTER_MODAL_OPEN,{});
                   document.getElementById('onboarding-banner')?.remove();
                   SafeStorage.set('${SEEN_KEY}','1');">
          Create your first chapter
        </button>
      </div>
      <button onclick="document.getElementById('onboarding-banner')?.remove();
                       SafeStorage.set('${SEEN_KEY}','1');"
        style="background:none;border:none;color:rgba(255,255,255,0.4);
               font-size:1.2rem;cursor:pointer;flex-shrink:0;padding:0;">×</button>
    </div>
  `;

  const dashPage = document.querySelector('.dashboard-page') ||
                   document.getElementById('chapters-grid')?.parentElement;
  if (dashPage) dashPage.prepend(banner);
}

document.addEventListener('DOMContentLoaded', async () => {


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
      apiFetch('/friends').then(d => { window._cachedFriends = d?.friends || []; }).catch(e => { console.error('Failed to load friends', e); return {}; }),
    ]);

    if (!authData || !authData.user) {
      console.error('Invalid authData received:', authData);
      if (window.ApiCache) {
        await window.ApiCache.clear();
      }
      throw new Error('User data is missing from auth response.');
    }

    window.currentUser = authData.user;
    ProfileModal.init(authData.user);
    renderNavProfile(authData.user);

    const loadedChapters = await ChaptersGrid.load();

    // Show onboarding for first-time users with no chapters
    _showOnboardingIfNeeded(loadedChapters?.length ?? 0);

    // Initialize Invites Banner
    if (typeof InvitesBanner !== 'undefined') {
      await InvitesBanner.init();
    }
    
    // Initialize Notification Center
    if (typeof NotificationCenter !== 'undefined') {
      NotificationCenter.init();
    }

  } catch (err) {
    console.error('Error during dashboard initialization:', err);
    const grid = document.getElementById('chapters-grid');
    if (grid) grid.innerHTML = '';
    


    if (err.isAuthRedirect) return; // Navigation already triggered
    if (err.status === 401 || err.status === 403) {
      ['session_expiry'].forEach(name => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      window.location.replace('login.html?expired=true');
    } else {
      if (window.showToast) {
        showToast(window.getUserMessage ? getUserMessage(err) : err.message, 'error', { label: 'Retry', callback: () => window.location.reload() });
      }
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
    const { chapterId, chapterName, chapterDesc, isArchived, isPersonal, isCollaborative } = menuBtn.dataset;
    ChapterCardMenu.open(menuBtn, {
      id: chapterId, name: chapterName, description: chapterDesc,
      is_archived: isArchived === 'true', is_personal: isPersonal === 'true',
      is_collaborative: isCollaborative === 'true'
    });
  });

  // Pull-to-refresh
  if (typeof initPullToRefresh === 'function') {
    initPullToRefresh(async () => {
      try {
        await Promise.all([
          apiFetch('/friends').then(d => { window._cachedFriends = d.friends || []; }).catch(() => {}),
          ChaptersGrid.load()
        ]);
      } catch (err) {
        showToast(getUserMessage ? getUserMessage(err) : (err.message || 'Failed to refresh'), 'error');
      }
    });
  }
});

function renderNavProfile(user) {
  const btn = document.getElementById('profile-trigger');
  if (!btn || !user) return;
  const color    = window.getAvatarColor ? getAvatarColor(user.realName || user.username || '') : '#7C3AED';
  const initials = window.getInitials ? getInitials(user.realName || user.username || '?') : '?';
  btn.style.background = color;
  btn.textContent = initials;
  btn.setAttribute('aria-label', `Profile: ${user.realName}`);
  btn.addEventListener('click', () => EventBus.emit(EVENTS.PROFILE_MODAL_OPEN, {}));
}