const InvitesBanner = (() => {
  async function _fetchInvites() {
    try {
      const data = await apiFetch('/invites/mine');
      return data.invitations || [];
    } catch (err) {
      console.error('Failed to fetch invites', err);
      return [];
    }
  }

  async function _handleRespond(inviteId, action) {
    try {
      await apiFetch(`/invites/${inviteId}/respond`, { method: 'POST', body: { action } });
      showToast(`Invite ${action}ed!`, 'success');
      if (typeof window.haptic === 'function') window.haptic('success');
      
      // Reload the grid
      await ChaptersGrid.load();
      init(); // Re-render the banner
    } catch (err) {
      showToast(err.message || 'Failed to respond to invite', 'error');
    }
  }

  async function init() {
    const invites = await _fetchInvites();
    
    // Find or create banner container
    let container = document.getElementById('invites-banner-container');
    if (!container) {
      const mainContent = document.querySelector('.dashboard-page');
      if (!mainContent) return;
      
      container = document.createElement('div');
      container.id = 'invites-banner-container';
      mainContent.prepend(container);
    }
    
    container.innerHTML = ''; // clear

    if (invites.length === 0) return;

    const banner = document.createElement('div');
    banner.style.cssText = `
      background: linear-gradient(135deg, rgba(138,43,226,0.15), rgba(208,0,255,0.08));
      border: 1px solid rgba(138,43,226,0.3);
      border-radius: var(--r-lg);
      padding: var(--s-4) var(--s-5);
      margin-bottom: var(--s-5);
      display: flex;
      flex-direction: column;
      gap: var(--s-3);
    `;

    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:600; color:#fff; display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          You have ${invites.length} pending chapter invitation${invites.length > 1 ? 's' : ''}
        </div>
      </div>
      <div id="invites-list" style="display:flex; flex-direction:column; gap:var(--s-3);"></div>
    `;

    const list = banner.querySelector('#invites-list');
    invites.forEach(invite => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        background: rgba(0,0,0,0.2); padding: var(--s-3); border-radius: var(--r-md);
      `;
      item.innerHTML = `
        <div>
          <div style="font-weight:600; color:#fff;">${escapeHTML(invite.chapter_name)}</div>
          <div style="font-size:0.85rem; color:var(--text-muted);">Invited by ${escapeHTML(invite.inviter_name)}</div>
        </div>
        <div style="display:flex; gap:var(--s-2);">
          <button class="btn btn-decline" style="background:rgba(255,255,255,0.1); border:none; padding:6px 12px; border-radius:var(--r-sm); color:#fff; cursor:pointer;">Decline</button>
          <button class="btn btn-accept" style="background:var(--brand); border:none; padding:6px 12px; border-radius:var(--r-sm); color:#fff; cursor:pointer; font-weight:600;">Accept</button>
        </div>
      `;

      item.querySelector('.btn-accept').addEventListener('click', () => _handleRespond(invite.id, 'accept'));
      item.querySelector('.btn-decline').addEventListener('click', () => _handleRespond(invite.id, 'decline'));

      list.appendChild(item);
    });

    container.appendChild(banner);
  }

  return { init };
})();

window.InvitesBanner = InvitesBanner;
