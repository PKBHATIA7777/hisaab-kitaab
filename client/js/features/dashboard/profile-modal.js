/**
 * Profile modal — wired to EVENTS.PROFILE_MODAL_OPEN.
 * Handles display, name edit, friends list, logout.
 */
const ProfileModal = (() => {
  let _user = null;

  function init(user) {
    _user = user;
  }

  async function _open() {
    if (!_user) return;
    const name = _user.realName || _user.username || '?';
    const color = getAvatarColor(name);
    const initials = getInitials(name);

    let friends = [];
    let devices = [];
    try {
      const [friendsRes, devicesRes] = await Promise.all([
        apiFetch('/friends'),
        apiFetch('/auth/devices').catch(() => ({ sessions: [] }))
      ]);
      friends = friendsRes.friends || [];
      window._cachedFriends = friends;
      devices = devicesRes.sessions || [];
    } catch (_) {}

    // Calculate net balance across friends
    const netSum = friends.reduce((sum, f) => sum + ((f.total_balance || 0) / 100), 0);
    let balanceClass = 'settled';
    let balanceLabel = 'All settled up';
    let balanceSign = '';
    
    if (netSum > 0) {
      balanceClass = 'positive';
      balanceLabel = 'You are owed overall';
      balanceSign = '+ ';
    } else if (netSum < 0) {
      balanceClass = 'negative';
      balanceLabel = 'You owe overall';
    }

    const overlay = ModalManager.createOverlay(`
      <div class="modal-header">
        <h2 class="modal-title">My Profile & Friends</h2>
        <button class="modal-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      
      <div class="profile-panel-content">
        <!-- USER DETAILS -->
        <div class="profile-header">
          <div class="profile-panel-avatar" style="background:${color};">${initials}</div>
          <div class="profile-name" id="pm-name">${escapeHTML(name)}</div>
          <div class="profile-panel-username">@${escapeHTML(_user.username || '')}</div>
          <p style="font-size: var(--text-2xs); color: var(--text-muted); margin: var(--s-1) 0 0;">${escapeHTML(_user.email || '')}</p>
          
          <button type="button" id="pm-edit-name" style="margin-top:var(--s-3); background:none; border:none; color:var(--brand); font-size:var(--text-sm); font-weight:var(--weight-semibold); cursor:pointer;">
            Edit profile name
          </button>
        </div>

        <!-- EDIT PROFILE NAME FORM -->
        <div id="pm-edit-form" style="display:none; margin-bottom: var(--s-5); background: var(--surface-alt); padding: var(--s-4); border-radius: var(--r-md); border: 1px solid var(--surface-border);">
          <div class="form-group" style="margin: 0 0 var(--s-3);">
            <label style="font-size: var(--text-2xs); font-weight: var(--weight-bold); text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--s-1); display: block;">Full Name</label>
            <input type="text" id="pm-name-input" class="form-input" value="${escapeHTML(name)}" style="width: 100%; height: 38px; padding: 0 var(--s-3); border-radius: var(--r-sm); border: 1px solid var(--surface-border-strong);" minlength="2" maxlength="100">
          </div>
          <div style="display:flex; gap:var(--s-2);">
            <button type="button" class="btn btn--primary" id="pm-save-name" style="flex:1; height: 36px; font-size: var(--text-xs);">Save</button>
            <button type="button" class="btn btn--ghost" id="pm-cancel-name" style="flex:1; height: 36px; font-size: var(--text-xs);">Cancel</button>
          </div>
        </div>

        <!-- BALANCE SUMMARY -->
        <div class="profile-panel-balance-summary">
          <div class="profile-summary-item">
            <span class="profile-summary-label">${balanceLabel}</span>
            <span class="profile-summary-val ${balanceClass}">${balanceSign}₹${Math.abs(netSum).toFixed(2)}</span>
          </div>
        </div>

        <!-- FRIENDS MANAGEMENT -->
        <div class="profile-panel-section-title">
          <span>My Friends (${friends.length})</span>
        </div>

        <div class="friends-scroller" id="pm-friends-list">
          ${friends.length === 0 ? `
            <div style="padding: var(--s-4) 0; text-align: center; color: var(--text-muted); font-size: var(--text-xs);">
              No friends added yet. Add friends below to pick them when creating chapters!
            </div>
          ` : friends.map(f => {
            const fInitials = getInitials(f.name);
            const fColor = getAvatarColor(f.name);
            const fBal = (f.total_balance || 0) / 100;
            let fBalClass = 'settled';
            let fBalLabel = 'settled up';
            if (fBal > 0) {
              fBalClass = 'owed';
              fBalLabel = `owes you ₹${fBal.toFixed(2)}`;
            } else if (fBal < 0) {
              fBalClass = 'owe';
              fBalLabel = `you owe ₹${Math.abs(fBal).toFixed(2)}`;
            }

            return `
              <div class="friend-row">
                <div class="friend-row-left">
                  <div class="friend-row-avatar" style="background:${fColor}">${fInitials}</div>
                  <div>
                    <div class="friend-row-name">${escapeHTML(f.name)}</div>
                    <div class="friend-row-email">@${escapeHTML(f.username)}</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: var(--s-3);">
                  <span class="friend-row-balance ${fBalClass}">${fBalLabel}</span>
                  <button type="button" class="friend-action-btn friend-action-btn--danger pm-delete-friend" data-id="${f.id}" data-name="${escapeHTML(f.name)}" aria-label="Remove friend" style="border:none; background:none; cursor:pointer;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- ADD FRIEND BOX -->
        <div style="margin-top: var(--s-5); border-top: 1px solid var(--surface-border); padding-top: var(--s-4);">
          <div class="profile-panel-section-title">Add New Friend</div>
          <form id="pm-add-friend-form" style="display:flex; flex-direction:column; gap: var(--s-2h);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2);">
              <input type="text" id="add-friend-name" placeholder="Full Name" required maxlength="100" style="height: 38px; border-radius: var(--r-sm); border:1px solid var(--surface-border-strong); padding: 0 var(--s-3); font-size: var(--text-xs); background: var(--surface-alt);">
              <input type="text" id="add-friend-username" placeholder="Username" required maxlength="50" style="height: 38px; border-radius: var(--r-sm); border:1px solid var(--surface-border-strong); padding: 0 var(--s-3); font-size: var(--text-xs); background: var(--surface-alt);">
            </div>
            <div style="display:flex; gap:var(--s-2);">
              <input type="email" id="add-friend-email" placeholder="Email Address" required maxlength="255" style="flex:1; height: 38px; border-radius: var(--r-sm); border:1px solid var(--surface-border-strong); padding: 0 var(--s-3); font-size: var(--text-xs); background: var(--surface-alt);">
              <button type="submit" class="btn btn--primary" style="height: 38px; padding: 0 var(--s-4); font-size: var(--text-xs);">Add Friend</button>
            </div>
          </form>
        </div>

        <!-- SECURITY & DEVICES -->
        <div style="margin-top: var(--s-5); border-top: 1px solid var(--surface-border); padding-top: var(--s-4);">
          <div class="profile-panel-section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>Manage Devices (${devices.length})</span>
            ${devices.length > 1 ? `<button type="button" id="pm-revoke-all" class="btn btn--ghost btn--danger" style="font-size: 10px; padding: 2px 6px; height: 24px;">Sign out all other devices</button>` : ''}
          </div>
          <div class="friends-scroller" style="max-height: 200px;">
            ${devices.map(d => {
              const isCurrent = d.isCurrent;
              const time = new Date(d.last_active_at).toLocaleString();
              return \`
                <div class="friend-row">
                  <div class="friend-row-left">
                    <div>
                      <div class="friend-row-name" style="font-size: 13px;">\${escapeHTML(d.device_name || 'Unknown Device')}</div>
                      <div class="friend-row-email" style="font-size: 11px;">\${escapeHTML(d.ip_address || '')} • Active: \${time}</div>
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: var(--s-3);">
                    \${isCurrent ? 
                      \`<span class="friend-row-balance positive" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid currentColor;">This Device</span>\` : 
                      \`<button type="button" class="btn btn--danger pm-revoke-device" data-id="\${d.session_id}" style="height: 26px; font-size: 11px; padding: 0 var(--s-2);">Revoke</button>\`
                    }
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>

        <!-- SIGNOUT BUTTON -->
        <button type="button" class="btn btn--danger" id="pm-logout" style="width:100%; margin-top: var(--s-8); height: 44px;">Log out</button>
      </div>
    `, { type: 'center' });

    // Overlay Close Hook
    overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

    // Edit Profile triggers
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
        
        // Refresh Navbar Avatar
        const navBtn = document.getElementById('profile-trigger');
        if (navBtn) { 
          navBtn.textContent = getInitials(data.realName); 
          navBtn.style.background = getAvatarColor(data.realName); 
        }
      } catch (err) { showToast(err.message || 'Failed', 'error'); }
      finally { btn.classList.remove('btn--loading'); btn.disabled = false; }
    });

    // Logout
    overlay.querySelector('#pm-logout').addEventListener('click', async () => {
      try { await apiFetch('/auth/logout', { method: 'POST' }); } catch(_) {}
      window.location.replace('login.html');
    });

    // Add Friend Submissions
    const addFriendForm = overlay.querySelector('#pm-add-friend-form');
    addFriendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fName = overlay.querySelector('#add-friend-name').value.trim();
      const fUsername = overlay.querySelector('#add-friend-username').value.trim();
      const fEmail = overlay.querySelector('#add-friend-email').value.trim();
      
      const submitBtn = addFriendForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding...';

      try {
        await apiFetch('/friends', {
          method: 'POST',
          body: { name: fName, username: fUsername, email: fEmail }
        });
        showToast(`Friend ${fName} added!`, 'success');
        ModalManager.close(overlay);
        // Re-open to refresh list
        setTimeout(() => _open(), 100);
      } catch (err) {
        showToast(err.message || 'Failed to add friend', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Friend';
      }
    });

    // Remove Friend handlers
    overlay.querySelectorAll('.pm-delete-friend').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fId = btn.dataset.id;
        const fName = btn.dataset.name;
        
        if (!confirm(`Are you sure you want to remove ${fName} from your friends list?`)) return;

        try {
          await apiFetch(`/friends/${fId}`, { method: 'DELETE' });
          showToast(`${fName} removed`, 'info');
          ModalManager.close(overlay);
          setTimeout(() => _open(), 100);
        } catch (err) {
          showToast(err.message || 'Failed to remove friend', 'error');
        }
      });
    });

    // Revoke Device handlers
    overlay.querySelectorAll('.pm-revoke-device').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sessionId = btn.dataset.id;
        
        if (!confirm('Are you sure you want to sign out this device?')) return;

        try {
          btn.disabled = true;
          btn.textContent = 'Revoking...';
          await apiFetch(`/auth/devices/${sessionId}`, { method: 'DELETE' });
          showToast('Device signed out successfully', 'success');
          ModalManager.close(overlay);
          setTimeout(() => _open(), 100);
        } catch (err) {
          showToast(err.message || 'Failed to revoke device', 'error');
          btn.disabled = false;
          btn.textContent = 'Revoke';
        }
      });
    });

    // Revoke All Devices handler
    const revokeAllBtn = overlay.querySelector('#pm-revoke-all');
    if (revokeAllBtn) {
      revokeAllBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to sign out ALL other devices? You will remain signed in here.')) return;
        
        try {
          revokeAllBtn.disabled = true;
          revokeAllBtn.textContent = 'Signing out...';
          await apiFetch('/auth/devices/all?all=true', { method: 'DELETE' });
          showToast('All other devices signed out', 'success');
          // Refresh list
          ModalManager.close(overlay);
          setTimeout(() => _open(), 100);
        } catch (err) {
          showToast(err.message || 'Failed to sign out devices', 'error');
          revokeAllBtn.disabled = false;
          revokeAllBtn.textContent = 'Sign out all other devices';
        }
      });
    }
  }

  EventBus.on(EVENTS.PROFILE_MODAL_OPEN, _open);
  return { init, open: _open };
})();

window.ProfileModal = ProfileModal;