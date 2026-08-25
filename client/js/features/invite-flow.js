/**
 * Invite Flow UI Component
 * Handles sending invites to email addresses for collaborative chapters.
 */

window.openInviteModal = () => {
  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">Send Invite</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding:0 20px 24px;">
      <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:16px;line-height:1.5;">
        Invite someone via email. They will receive a link to join this chapter and collaborate.
      </p>
      <form id="send-invite-form">
        <div class="form-group">
          <label class="form-label" for="invite-email">Email Address *</label>
          <input type="email" id="invite-email" class="form-input" required placeholder="friend@example.com" autocomplete="email">
        </div>
        <button type="submit" class="btn btn--primary" id="invite-submit" style="width: 100%;">Send Invite</button>
      </form>
      <div id="pending-invites-container" style="margin-top: 24px;">
        <h3 style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Pending Invites</h3>
        <div id="pending-invites-list" style="display:flex; flex-direction:column; gap:8px;">
           <div style="font-size: 0.85rem; color: rgba(255,255,255,0.4);">Loading...</div>
        </div>
      </div>
    </div>
  `);

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  const form = overlay.querySelector('#send-invite-form');
  const submitBtn = form.querySelector('#invite-submit');
  const emailInput = form.querySelector('#invite-email');
  const listContainer = overlay.querySelector('#pending-invites-list');

  const _loadPendingInvites = async () => {
    try {
      const data = await apiFetch(`/chapters/${window.chapterId}/invites`);
      const invites = (data.invites || []).filter(i => i.status === 'pending');
      if (invites.length === 0) {
        listContainer.innerHTML = '<div style="font-size: 0.85rem; color: rgba(255,255,255,0.4);">No pending invites</div>';
        return;
      }
      listContainer.innerHTML = invites.map(inv => `
        <div style="display:flex; justify-content:space-between; align-items:center; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: var(--r-sm);">
          <div style="font-size: 0.85rem; color: #fff;">${escapeHTML(inv.invited_email)}</div>
          <button class="btn btn--danger btn-revoke" data-id="${inv.id}" style="padding: 4px 8px; font-size: 0.75rem;">Revoke</button>
        </div>
      `).join('');

      listContainer.querySelectorAll('.btn-revoke').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          try {
            await apiFetch(`/chapters/${window.chapterId}/invites/${id}`, { method: 'DELETE' });
            showToast('Invite revoked', 'info');
            _loadPendingInvites();
          } catch (err) {
            showToast(err.message || 'Failed to revoke', 'error');
          }
        });
      });
    } catch (err) {
      listContainer.innerHTML = '<div style="font-size: 0.85rem; color: var(--negative);">Failed to load</div>';
    }
  };

  _loadPendingInvites();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    submitBtn.classList.add('btn--loading');
    submitBtn.disabled = true;

    try {
      await apiFetch(`/chapters/${window.chapterId}/invites`, {
        method: 'POST',
        body: { email }
      });
      showToast('Invite sent!', 'success');
      emailInput.value = '';
      _loadPendingInvites();
    } catch (err) {
      showToast(err.message || 'Failed to send invite', 'error');
    } finally {
      submitBtn.classList.remove('btn--loading');
      submitBtn.disabled = false;
    }
  });

  setTimeout(() => emailInput.focus(), 350);
};
