/**
 * Notification Center UI Component
 * Handles the bell icon, unread count polling, and the notification panel.
 */
const NotificationCenter = (() => {
  let unreadCount = 0;
  let isPanelOpen = false;
  let pollInterval = null;

  async function _fetchUnreadCount() {
    try {
      const data = await apiFetch('/notifications/unread-count');
      if (data.ok) {
        unreadCount = data.count;
        _updateBadge();
      }
    } catch (err) {
      console.error('Failed to fetch unread count', err);
    }
  }

  async function _fetchNotifications() {
    try {
      const data = await apiFetch('/notifications');
      return data.notifications || [];
    } catch (err) {
      console.error('Failed to fetch notifications', err);
      return [];
    }
  }

  async function _markAsRead(id) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      unreadCount = Math.max(0, unreadCount - 1);
      _updateBadge();
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  }

  async function _markAllAsRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      unreadCount = 0;
      _updateBadge();
      _renderPanel(); // Re-render to clear dots
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  }

  function _updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function _buildIcon(type) {
    switch (type) {
      case 'invite_received': return '<svg viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>';
      case 'settlement_request': return '<svg viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
      case 'settlement_confirmed': return '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      case 'expense_added': return '<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>';
      default: return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>';
    }
  }

  async function _renderPanel() {
    let panel = document.getElementById('notif-panel');
    if (!panel) return;
    
    panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Loading...</div>';
    
    const notifs = await _fetchNotifications();
    
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 16px;">
        <h3 style="margin:0; font-size:1.1rem; color:#fff;">Notifications</h3>
        ${notifs.some(n => !n.is_read) ? '<button id="mark-all-read" style="background:none; border:none; color:var(--brand); cursor:pointer; font-size:0.85rem;">Mark all read</button>' : ''}
      </div>
      <div id="notif-list" style="max-height: 400px; overflow-y: auto; padding: 8px;"></div>
    `;

    if (notifs.some(n => !n.is_read)) {
      panel.querySelector('#mark-all-read').addEventListener('click', _markAllAsRead);
    }

    const list = panel.querySelector('#notif-list');
    
    if (notifs.length === 0) {
      list.innerHTML = '<div style="padding:40px 20px; text-align:center; color:var(--text-muted);">You have no notifications</div>';
      return;
    }

    notifs.forEach(n => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex; gap: 12px; padding: 12px; border-radius: var(--r-md);
        background: ${n.is_read ? 'transparent' : 'rgba(138,43,226,0.1)'};
        cursor: pointer;
        transition: background 0.2s;
      `;
      item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.05)');
      item.addEventListener('mouseleave', () => item.style.background = n.is_read ? 'transparent' : 'rgba(138,43,226,0.1)');
      
      item.innerHTML = `
        <div style="flex-shrink:0; width:40px; height:40px; border-radius:50%; background:rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center;">
          ${_buildIcon(n.type)}
        </div>
        <div style="flex:1;">
          <div style="font-weight:600; font-size:0.95rem; color:#fff; display:flex; justify-content:space-between; align-items:flex-start;">
            <span>${escapeHTML(n.title)}</span>
            ${!n.is_read ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--brand);margin-top:4px;"></span>' : ''}
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">${escapeHTML(n.body)}</div>
          <div style="font-size:0.75rem; color:rgba(255,255,255,0.3); margin-top:6px;">${window.timeAgo(n.created_at)}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        if (!n.is_read) _markAsRead(n.id);
        if (n.chapter_id) {
          window.location.href = \`chapter.html?id=\${n.chapter_id}\`;
        }
      });

      list.appendChild(item);
    });
  }

  function _togglePanel() {
    let panel = document.getElementById('notif-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'notif-panel';
      panel.style.cssText = `
        position: absolute; top: 60px; right: 60px; width: 340px; max-width: 90vw;
        background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--r-lg);
        box-shadow: 0 10px 40px rgba(0,0,0,0.8); z-index: 1000;
        display: none; flex-direction: column;
      `;
      document.body.appendChild(panel);
    }

    isPanelOpen = !isPanelOpen;
    if (isPanelOpen) {
      panel.style.display = 'flex';
      _renderPanel();
      
      // Close on outside click
      setTimeout(() => {
        const closeOnOutside = (e) => {
          const trigger = document.getElementById('notif-trigger');
          if (!panel.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
            panel.style.display = 'none';
            isPanelOpen = false;
            document.removeEventListener('click', closeOnOutside);
          }
        };
        document.addEventListener('click', closeOnOutside);
      }, 0);
    } else {
      panel.style.display = 'none';
    }
  }

  function init() {
    // Inject bell icon into navbar next to profile
    const navRight = document.querySelector('.nav-right');
    if (navRight && !document.getElementById('notif-trigger')) {
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      
      const btn = document.createElement('button');
      btn.id = 'notif-trigger';
      btn.className = 'nav-icon-btn';
      btn.setAttribute('aria-label', 'Notifications');
      btn.style.cssText = 'background:none; border:none; color:#fff; cursor:pointer; padding:8px; display:flex; align-items:center; justify-content:center;';
      btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>';
      
      const badge = document.createElement('span');
      badge.id = 'notif-badge';
      badge.style.cssText = 'position:absolute; top:4px; right:4px; background:red; color:#fff; font-size:0.6rem; font-weight:bold; min-width:16px; height:16px; border-radius:10px; display:none; align-items:center; justify-content:center; padding:0 4px;';
      
      btn.appendChild(badge);
      wrapper.appendChild(btn);
      
      navRight.insertBefore(wrapper, navRight.firstChild);
      
      btn.addEventListener('click', _togglePanel);
    }

    _fetchUnreadCount();
    
    // Poll every 30s
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(_fetchUnreadCount, 30000);
  }

  return { init };
})();

window.NotificationCenter = NotificationCenter;
