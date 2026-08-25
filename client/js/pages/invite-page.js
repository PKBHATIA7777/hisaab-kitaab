/* client/js/pages/invite-page.js */
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const titleEl = document.getElementById('invite-title');
  const subtitleEl = document.getElementById('invite-subtitle');
  const cardEl = document.getElementById('invite-card');
  const chapterNameEl = document.getElementById('chapter-name');
  const inviterNameEl = document.getElementById('inviter-name');
  const actionsEl = document.getElementById('action-buttons');

  if (!token) {
    titleEl.textContent = 'Invalid Invite Link';
    subtitleEl.textContent = 'The link is missing the invite token.';
    return;
  }

  let inviteData = null;

  try {
    const res = await fetch(`${window.APP_CONFIG?.API_BASE || '/api/v1'}/invites/${token}`);
    if (!res.ok) throw new Error('Invite link is invalid or expired.');
    
    const json = await res.json();
    inviteData = json.invitation;
  } catch (err) {
    titleEl.textContent = 'Invalid or Expired Link';
    subtitleEl.textContent = err.message || 'This invite is no longer valid.';
    return;
  }

  // Invite is valid! Show details.
  titleEl.textContent = 'You have been invited!';
  subtitleEl.textContent = 'Join to collaborate on expenses.';
  chapterNameEl.textContent = inviteData.chapter_name;
  inviterNameEl.textContent = inviteData.inviter_name;
  cardEl.style.display = 'block';

  // Check if user is logged in
  let currentUser = null;
  try {
    const authRes = await fetch(`${window.APP_CONFIG?.API_BASE || '/api/v1'}/auth/me`, {
      credentials: 'include'
    });
    if (authRes.ok) {
      const authJson = await authRes.json();
      currentUser = authJson.user;
    }
  } catch (e) { }

  if (!currentUser) {
    // User is not logged in.
    actionsEl.innerHTML = `
      <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom: 8px;">Please log in or create an account to accept.</p>
      <button class="btn btn--brand" id="btn-login">Log In to Accept</button>
      <button class="btn btn--secondary" id="btn-register">Create Account</button>
    `;
    
    // Save invite intent
    const pendingAction = {
      type: 'ACCEPT_INVITE',
      inviteId: inviteData.id,
      chapterName: inviteData.chapter_name
    };

    document.getElementById('btn-login').addEventListener('click', () => {
      Storage.set('pending_action', JSON.stringify(pendingAction));
      window.location.href = `login.html?email=${encodeURIComponent(inviteData.invited_email)}`;
    });
    
    document.getElementById('btn-register').addEventListener('click', () => {
      Storage.set('pending_action', JSON.stringify(pendingAction));
      window.location.href = `register.html?email=${encodeURIComponent(inviteData.invited_email)}`;
    });
  } else {
    // User is logged in. Can they accept this invite?
    // In our system, the invite must belong to them (or they just accept it as themselves).
    // The backend `POST /invites/:inviteId/accept` enforces this based on logged-in user.
    actionsEl.innerHTML = `
      <button class="btn btn--brand" id="btn-accept">Accept Invitation</button>
      <button class="btn btn--secondary" id="btn-decline">Decline</button>
    `;

    document.getElementById('btn-accept').addEventListener('click', async () => {
      const btn = document.getElementById('btn-accept');
      btn.classList.add('btn--loading'); btn.disabled = true;

      // Extract CSRF token from cookie
      let csrfToken = '';
      const cookieMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (cookieMatch && cookieMatch[1].length >= 32) {
        csrfToken = cookieMatch[1];
      }
      try {
        const acceptRes = await fetch(`${window.APP_CONFIG?.API_BASE || '/api/v1'}/invites/${token}/respond`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ accept: true })
        });
        if (!acceptRes.ok) {
          const errData = await acceptRes.json();
          throw new Error(errData.error || 'Failed to accept invite');
        }
        
        if (typeof showToast === 'function') showToast('Joined Chapter!', 'success');
        setTimeout(() => {
          window.location.href = `chapter.html?id=${inviteData.chapter_id}`;
        }, 1500);
      } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, 'error');
        btn.classList.remove('btn--loading'); btn.disabled = false;
      }
    });

    document.getElementById('btn-decline').addEventListener('click', async () => {
      const btn = document.getElementById('btn-decline');
      btn.classList.add('btn--loading'); btn.disabled = true;

      // Extract CSRF token from cookie
      let csrfToken = '';
      const cookieMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (cookieMatch && cookieMatch[1].length >= 32) {
        csrfToken = cookieMatch[1];
      }
      try {
        const declineRes = await fetch(`${window.APP_CONFIG?.API_BASE || '/api/v1'}/invites/${token}/respond`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ accept: false })
        });
        if (!declineRes.ok) {
          const errData = await declineRes.json();
          throw new Error(errData.error || 'Failed to decline invite');
        }
        
        if (typeof showToast === 'function') showToast('Invite declined', 'info');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1000);
      } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, 'error');
        btn.classList.remove('btn--loading'); btn.disabled = false;
      }
    });
  }
});
