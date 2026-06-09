/**
 * Profile modal — wired to EVENTS.PROFILE_MODAL_OPEN.
 * Handles display, name edit, friends list, logout.
 */
const ProfileModal = (() => {
  let _user = null;

  function init(user) {
    _user = user;
  }

  function _open() {
    if (!_user) return;
    const name = _user.realName || _user.username || '?';
    const color = getAvatarColor(name);
    const initials = getInitials(name);

    const overlay = ModalManager.createOverlay(`
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2 class="modal-title">My Profile</h2>
        <button class="modal-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style="padding:0 20px 24px;">
        <div style="text-align:center;padding-bottom:var(--s-5);border-bottom:1px solid var(--surface-border);margin-bottom:var(--s-5);">
          <div class="avatar avatar--xl" style="background:${color};margin:0 auto var(--s-3);">${initials}</div>
          <div style="font-size:var(--text-xl);font-weight:var(--weight-bold);color:var(--text-primary);" id="pm-name">${escapeHTML(name)}</div>
          <div style="font-size:var(--text-sm);color:var(--text-muted);">@${escapeHTML(_user.username || '')}</div>
          <button type="button" id="pm-edit-name" style="margin-top:var(--s-2);background:none;border:none;color:var(--brand);font-size:var(--text-sm);cursor:pointer;font-family:var(--font);">Edit name</button>
        </div>
        <div id="pm-edit-form" style="display:none;margin-bottom:var(--s-4);">
          <div class="form-group" style="margin:0 0 var(--s-2);">
            <input type="text" id="pm-name-input" class="form-input" value="${escapeHTML(name)}" maxlength="100">
          </div>
          <div style="display:flex;gap:var(--s-2);">
            <button type="button" class="btn btn--primary" id="pm-save-name" style="flex:1;">Save</button>
            <button type="button" class="btn btn--ghost" id="pm-cancel-name" style="flex:1;">Cancel</button>
          </div>
        </div>
        <button type="button" class="btn btn--danger" id="pm-logout" style="width:100%;">Log out</button>
      </div>
    `, { type: 'bottom' });

    overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

    overlay.querySelector('#pm-edit-name').addEventListener('click', () => {
      overlay.querySelector('#pm-edit-form').style.display = '';
      overlay.querySelector('#pm-name-input').focus();
    });
    overlay.querySelector('#pm-cancel-name').addEventListener('click', () => {
      overlay.querySelector('#pm-edit-form').style.display = 'none';
    });
    overlay.querySelector('#pm-save-name').addEventListener('click', async () => {
      const newName = overlay.querySelector('#pm-name-input').value.trim();
      if (!newName || newName.length < 2) { showToast('Name too short', 'error'); return; }
      const btn = overlay.querySelector('#pm-save-name');
      btn.classList.add('btn--loading'); btn.disabled = true;
      try {
        const data = await apiFetch('/auth/profile', { method: 'PATCH', body: { realName: newName } });
        _user.realName = data.realName;
        overlay.querySelector('#pm-name').textContent = data.realName;
        overlay.querySelector('#pm-edit-form').style.display = 'none';
        showToast('Name updated', 'success');
        // Refresh nav profile
        const navBtn = document.getElementById('profile-trigger');
        if (navBtn) { navBtn.textContent = getInitials(data.realName); navBtn.style.background = getAvatarColor(data.realName); }
      } catch (err) { showToast(err.message || 'Failed', 'error'); }
      finally { btn.classList.remove('btn--loading'); btn.disabled = false; }
    });

    overlay.querySelector('#pm-logout').addEventListener('click', async () => {
      try { await apiFetch('/auth/logout', { method: 'POST' }); } catch(_) {}
      window.location.replace('login.html');
    });
  }

  EventBus.on(EVENTS.PROFILE_MODAL_OPEN, _open);
  return { init, open: _open };
})();

window.ProfileModal = ProfileModal;