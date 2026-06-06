/* client/js/dashboard.js — FULL REWRITE */
/* =============================================
   STATE
   ============================================= */
let _state = {
  currentUser: null,
  chapters: [],
  friends: [],
  sortBy: 'last_opened',
  searchTerm: '',
  showArchived: false,
  placeholderIndex: 0,
  placeholderTimer: null,
};

const PLACEHOLDERS = [
  'e.g. Goa Trip 2025',
  'e.g. College Friends Group',
  'e.g. Flatmates 404',
  'e.g. Office Lunch Crew',
];

/* =============================================
   UTILITIES
   ============================================= */
function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getAvatarColor(name = '') {
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#F9CA24','#F0932B','#6C5CE7','#A29BFE','#00B894'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  // Wire toolbar
  const searchEl = document.getElementById('chapter-search');
  const sortEl   = document.getElementById('chapter-sort');
  const archBtn  = document.getElementById('btn-archived');
  const profileBtn = document.getElementById('profile-trigger');

  searchEl?.addEventListener('input', debounce(() => {
    _state.searchTerm = searchEl.value.trim().toLowerCase();
    renderGrid();
  }, 250));

  sortEl?.addEventListener('change', () => {
    _state.sortBy = sortEl.value;
    renderGrid();
  });

  archBtn?.addEventListener('click', async () => {
    _state.showArchived = !_state.showArchived;
    archBtn.textContent = _state.showArchived ? '📋 Active' : '🗃️ Archived';
    archBtn.classList.toggle('is-active', _state.showArchived);
    await loadChapters();
  });

  profileBtn?.addEventListener('click', openProfileModal);

  // Cross-tab logout
  if (typeof SessionManager !== 'undefined') {
    SessionManager.on('logout', () => {
      showToast('Logged out from another tab', 'info');
      setTimeout(() => window.location.replace('login.html'), 2000);
    });
  }

  renderSkeletons();

  try {
    const [authData, chapData] = await Promise.all([
      apiFetch('/auth/me'),
      apiFetch('/chapters'),
    ]);
    _state.currentUser = authData.user;
    _state.chapters    = chapData.chapters;
    renderProfileBtn();
    renderGrid();
    // Load friends in background for autocomplete
    apiFetch('/friends').then(d => { _state.friends = d.friends || []; }).catch(() => {});
  } catch (err) {
    if (err?.status === 401) { window.location.href = 'login.html'; return; }
    showToast('Failed to load chapters', 'error', {
      label: 'Retry',
      callback: () => window.location.reload(),
    });
    renderGrid(); // show empty state
  }
});

/* =============================================
   RENDER HELPERS
   ============================================= */
function renderProfileBtn() {
  const u = _state.currentUser;
  if (!u) return;
  const btn = document.getElementById('profile-trigger');
  if (!btn) return;
  btn.textContent = getInitials(u.realName || u.username);
  btn.style.background = getAvatarColor(u.realName || '');
  const nameEl = document.getElementById('nav-profile-name');
  if (nameEl) nameEl.textContent = u.realName || u.username;
}

function renderSkeletons(count = 4) {
  const grid = document.getElementById('chapters-grid');
  if (!grid) return;
  grid.innerHTML = Array(count).fill(`
    <div class="chapter-skeleton skeleton" aria-hidden="true">
      <div class="chapter-skeleton__avatar skeleton"></div>
      <div class="chapter-skeleton__title skeleton"></div>
      <div class="chapter-skeleton__meta skeleton"></div>
    </div>
  `).join('');
}

function getSortedChapters() {
  const arr = [..._state.chapters];
  switch (_state.sortBy) {
    case 'newest':      return arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    case 'oldest':      return arr.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    case 'az':          return arr.sort((a,b) => a.name.localeCompare(b.name));
    case 'members':     return arr.sort((a,b) => b.member_count - a.member_count);
    case 'last_opened':
    default: {
      return arr.sort((a,b) => {
        const ta = new Date(a.last_opened_at || a.created_at);
        const tb = new Date(b.last_opened_at || b.created_at);
        return tb - ta;
      });
    }
  }
}

function renderGrid() {
  const grid = document.getElementById('chapters-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = _state.searchTerm
    ? getSortedChapters().filter(c => c.name.toLowerCase().includes(_state.searchTerm))
    : getSortedChapters();

  // Add card
  const addCard = document.createElement('div');
  addCard.className = 'chapter-card chapter-card--add';
  addCard.setAttribute('role', 'button');
  addCard.setAttribute('tabindex', '0');
  addCard.setAttribute('aria-label', 'Create new chapter');
  addCard.innerHTML = `
    <div class="chapter-card--add__icon">+</div>
    <div class="chapter-card--add__label">Create Chapter</div>
  `;
  addCard.addEventListener('click', openCreateModal);
  addCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openCreateModal(); });
  grid.appendChild(addCard);

  if (!filtered.length && _state.searchTerm) {
    const msg = document.createElement('div');
    msg.className = 'empty-state';
    msg.style.gridColumn = '1/-1';
    msg.innerHTML = `
      <div class="empty-state__icon">🔍</div>
      <div class="empty-state__title">No chapters found</div>
      <div class="empty-state__subtitle">Try a different search term</div>
    `;
    grid.appendChild(msg);
    return;
  }

  if (!filtered.length && !_state.searchTerm) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.gridColumn = '1/-1';
    empty.innerHTML = `
      <div class="empty-state__icon">📁</div>
      <div class="empty-state__title">No chapters yet</div>
      <div class="empty-state__subtitle">Create your first chapter to start tracking expenses</div>
    `;
    grid.appendChild(empty);
    return;
  }

  for (const ch of filtered) {
    grid.appendChild(buildChapterCard(ch));
  }

  EventBus.emit('dashboard:chapters:rendered', { chapters: filtered });
}

function buildChapterCard(ch) {
  const card = document.createElement('div');
  card.className = 'chapter-card' + (ch.is_archived ? ' chapter-card--archived' : '');
  card.dataset.chapterId = ch.id;

  const initials    = escapeHTML(getInitials(ch.name));
  const color       = getAvatarColor(ch.name);
  const safeName    = escapeHTML(ch.name);
  const timeStr     = timeAgo(ch.last_opened_at || ch.created_at);
  const memberCount = ch.member_count || 0;

  card.innerHTML = `
    <div class="chapter-card__header">
      <div class="chapter-card__initials" style="background:${color}">${initials}</div>
      <button class="chapter-card__menu-btn" aria-label="Chapter options" aria-haspopup="true" aria-expanded="false">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
      <div class="card-menu" role="menu">
        <button class="card-menu__item" role="menuitem" data-action="edit">✏️ Edit</button>
        <button class="card-menu__item" role="menuitem" data-action="archive">${ch.is_archived ? '📋 Restore' : '✅ Mark Settled'}</button>
        <div class="card-menu__divider"></div>
        <button class="card-menu__item card-menu__item--danger" role="menuitem" data-action="delete">🗑️ Delete</button>
      </div>
    </div>
    ${ch.is_personal ? '<div class="personal-badge">My Expenses</div>' : ''}
    <div class="chapter-card__name">${safeName}</div>
    <div class="chapter-card__footer">
      <span>${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
      <span>${timeStr}</span>
    </div>
  `;

  // Navigate on card click (not on menu)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.chapter-card__menu-btn') || e.target.closest('.card-menu')) return;
    window.location.href = `chapter.html?id=${ch.id}`;
  });

  // Prefetch on hover/touch
  let prefetched = false;
  const prefetch = () => {
    if (prefetched) return;
    prefetched = true;
    apiFetch(`/chapters/${ch.id}`).catch(() => {});
    apiFetch(`/expenses/chapter/${ch.id}?limit=50&offset=0`).catch(() => {});
  };
  card.addEventListener('mouseenter', prefetch, { passive: true });
  card.addEventListener('touchstart', prefetch, { passive: true });

  // Menu toggle
  const menuBtn  = card.querySelector('.chapter-card__menu-btn');
  const menuEl   = card.querySelector('.card-menu');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menuEl.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) {
      // Close when clicking outside
      const close = (ev) => {
        if (!menuEl.contains(ev.target) && ev.target !== menuBtn) {
          menuEl.classList.remove('is-open');
          menuBtn.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', close, true);
        }
      };
      setTimeout(() => document.addEventListener('click', close, true), 0);
    }
  });

  // Menu item actions — no user data in event handlers
  menuEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    menuEl.classList.remove('is-open');
    e.stopPropagation();
    const action = btn.dataset.action;
    if (action === 'edit')    openEditModal(ch);
    if (action === 'archive') toggleArchive(ch);
    if (action === 'delete')  confirmDelete(ch);
  });

  return card;
}

/* =============================================
   LOAD CHAPTERS
   ============================================= */
async function loadChapters() {
  renderSkeletons();
  try {
    const url = _state.showArchived ? '/chapters?archived=true' : '/chapters';
    const data = await apiFetch(url);
    _state.chapters = data.chapters;
    renderGrid();
  } catch (err) {
    showToast('Failed to refresh', 'error');
    renderGrid();
  }
}

/* =============================================
   CREATE CHAPTER MODAL
   ============================================= */
function openCreateModal() {
  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">New Chapter</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding: 0 20px 24px;">
      <form id="create-chapter-form" novalidate>

        <div class="form-group">
          <label class="form-label" for="cc-name">Chapter Name <span style="color:var(--color-error)">*</span></label>
          <input type="text" id="cc-name" class="form-input" name="name" maxlength="100" placeholder="e.g. Goa Trip 2025" required autocomplete="off">
          <div class="char-counter"><span id="cc-name-count">0</span>/100</div>
          <span class="form-error" id="cc-name-error"></span>
        </div>

        <div class="form-group">
          <label class="form-label" for="cc-desc">
            Description <span class="form-label--optional">(optional)</span>
          </label>
          <input type="text" id="cc-desc" class="form-input" name="description" maxlength="50" placeholder="Short tagline..." autocomplete="off">
          <div class="char-counter"><span id="cc-desc-count">0</span>/50</div>
        </div>

        <div class="form-group">
          <label class="form-label">Members <span style="color:var(--color-error)">*</span></label>
          <div class="member-list" id="cc-member-list"></div>
          <button type="button" class="btn-add-member" id="cc-add-member">+ Add member</button>
        </div>

        <button type="submit" class="btn btn--primary" id="cc-submit">Create Chapter</button>
      </form>
    </div>
  `, { type: 'bottom' });

  // Close button
  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  // Char counters
  const nameEl = overlay.querySelector('#cc-name');
  const descEl = overlay.querySelector('#cc-desc');
  nameEl.addEventListener('input', () => { overlay.querySelector('#cc-name-count').textContent = nameEl.value.length; });
  descEl.addEventListener('input', () => { overlay.querySelector('#cc-desc-count').textContent = descEl.value.length; });

  // Rotating placeholder
  let pi = 0;
  nameEl.placeholder = PLACEHOLDERS[0];
  _state.placeholderTimer = setInterval(() => {
    pi = (pi + 1) % PLACEHOLDERS.length;
    nameEl.placeholder = PLACEHOLDERS[pi];
  }, 2500);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) clearInterval(_state.placeholderTimer);
  });

  // Pre-add creator row
  _addCreatorRow(overlay);

  // Add member button
  overlay.querySelector('#cc-add-member').addEventListener('click', () => _addMemberRow(overlay));

  // Submit
  overlay.querySelector('#create-chapter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal = nameEl.value.trim();
    if (!nameVal) {
      const err = overlay.querySelector('#cc-name-error');
      err.textContent = 'Chapter name is required';
      err.classList.add('is-visible');
      nameEl.classList.add('form-input--error');
      return;
    }

    const submitBtn = overlay.querySelector('#cc-submit');
    submitBtn.classList.add('btn--loading');
    submitBtn.disabled = true;

    const members = _collectMembers(overlay);
    const creatorExcluded = overlay.querySelector('#cc-creator-check')?.checked === false;

    try {
      await apiFetch('/chapters', {
        method: 'POST',
        body: {
          name: nameVal,
          description: descEl.value.trim(),
          members,
          creatorExcluded,
        },
      });
      clearInterval(_state.placeholderTimer);
      ModalManager.close(overlay);
      showToast('Chapter created!', 'success');
      await loadChapters();
    } catch (err) {
      showToast(err.message || 'Failed to create chapter', 'error');
      submitBtn.classList.remove('btn--loading');
      submitBtn.disabled = false;
    }
  });

  setTimeout(() => nameEl.focus(), 350);
}

function _addCreatorRow(overlay) {
  const u = _state.currentUser;
  if (!u) return;
  const list = overlay.querySelector('#cc-member-list');
  const div = document.createElement('div');
  div.className = 'member-row member-row--creator';
  div.innerHTML = `
    <input type="checkbox" id="cc-creator-check" checked
      style="width:18px;height:18px;accent-color:var(--color-brand);cursor:pointer;flex-shrink:0;"
      title="Uncheck to exclude yourself">
    <label for="cc-creator-check" style="flex:1;font-weight:600;color:var(--color-brand);cursor:pointer;font-size:var(--text-sm);">
      ${escapeHTML(u.realName || u.username)}
    </label>
    <span class="you-badge">You</span>
  `;
  list.appendChild(div);
}

function _addMemberRow(overlay) {
  const list = overlay.querySelector('#cc-member-list');
  const div = document.createElement('div');
  div.className = 'member-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'member-row__input';
  input.placeholder = 'Name or select friend...';
  input.autocomplete = 'off';
  input.setAttribute('list', 'friends-suggestions');

  // Build datalist if not exists
  if (!document.getElementById('friends-suggestions')) {
    const dl = document.createElement('datalist');
    dl.id = 'friends-suggestions';
    _state.friends.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.name;
      document.body.appendChild(dl); // append to body, not modal
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
  }

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'member-row__remove';
  removeBtn.innerHTML = '×';
  removeBtn.setAttribute('aria-label', 'Remove member');
  removeBtn.addEventListener('click', () => div.remove());

  div.appendChild(input);
  div.appendChild(removeBtn);
  list.appendChild(div);
  setTimeout(() => input.focus(), 0);
}

function _collectMembers(overlay) {
  const inputs = overlay.querySelectorAll('.member-row__input');
  const seen = new Set();
  const members = [];
  inputs.forEach(inp => {
    const name = inp.value.trim();
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const friend = _state.friends.find(f => f.name.toLowerCase() === name.toLowerCase());
    members.push({ name, friendId: friend?.id || null });
  });
  return members;
}

/* =============================================
   EDIT CHAPTER MODAL
   ============================================= */
function openEditModal(ch) {
  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">Edit Chapter</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding: 0 20px 24px;">
      <form id="edit-chapter-form" novalidate>
        <div class="form-group">
          <label class="form-label" for="ec-name">Chapter Name <span style="color:var(--color-error)">*</span></label>
          <input type="text" id="ec-name" class="form-input" name="name" maxlength="100" required autocomplete="off" value="${escapeHTML(ch.name)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="ec-desc">Description <span class="form-label--optional">(optional)</span></label>
          <input type="text" id="ec-desc" class="form-input" name="description" maxlength="50" autocomplete="off" value="${escapeHTML(ch.description || '')}">
        </div>
        <button type="submit" class="btn btn--primary" id="ec-submit">Save Changes</button>
      </form>
    </div>
  `, { type: 'bottom' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  overlay.querySelector('#edit-chapter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = overlay.querySelector('#ec-name').value.trim();
    const description = overlay.querySelector('#ec-desc').value.trim();
    if (!name) return;

    const btn = overlay.querySelector('#ec-submit');
    btn.classList.add('btn--loading'); btn.disabled = true;

    try {
      await apiFetch(`/chapters/${ch.id}`, { method: 'PUT', body: { name, description } });
      ModalManager.close(overlay);
      showToast('Chapter updated', 'success');
      await loadChapters();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
      btn.classList.remove('btn--loading'); btn.disabled = false;
    }
  });
}

/* =============================================
   DELETE
   ============================================= */
function confirmDelete(ch) {
  const overlay = ModalManager.createOverlay(`
    <div class="modal-header">
      <h2 class="modal-title">Delete Chapter?</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding: 0 24px 24px; text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:12px;">🗑️</div>
      <p style="color:var(--color-text-secondary);font-size:var(--text-sm);margin-bottom:24px;line-height:1.5;">
        This will permanently delete <strong>${escapeHTML(ch.name)}</strong> and all its expenses. This cannot be undone.
      </p>
      <div style="display:flex;gap:12px;">
        <button class="btn btn--ghost" id="del-cancel" style="flex:1">Cancel</button>
        <button class="btn btn--danger" id="del-confirm" style="flex:1">Yes, Delete</button>
      </div>
    </div>
  `, { maxWidth: '380px' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));
  overlay.querySelector('#del-cancel').addEventListener('click', () => ModalManager.close(overlay));

  overlay.querySelector('#del-confirm').addEventListener('click', async () => {
    const btn = overlay.querySelector('#del-confirm');
    btn.classList.add('btn--loading'); btn.disabled = true;
    try {
      await apiFetch(`/chapters/${ch.id}`, { method: 'DELETE' });
      ModalManager.close(overlay);
      showToast('Chapter deleted', 'info');
      await loadChapters();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
      btn.classList.remove('btn--loading'); btn.disabled = false;
    }
  });
}

/* =============================================
   ARCHIVE TOGGLE
   ============================================= */
async function toggleArchive(ch) {
  try {
    await apiFetch(`/chapters/${ch.id}/archive`, {
      method: 'PATCH',
      body: { is_archived: !ch.is_archived },
    });
    showToast(ch.is_archived ? 'Chapter restored' : 'Marked as settled', 'success');
    await loadChapters();
  } catch (err) {
    showToast('Failed to update', 'error');
  }
}

/* =============================================
   PROFILE MODAL
   ============================================= */
function openProfileModal() {
  const u = _state.currentUser;
  if (!u) return;

  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">Profile</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding: 0 20px 24px;">
      <div class="profile-header">
        <div class="avatar avatar--xl" id="pm-avatar"
          style="background:${getAvatarColor(u.realName || '')}; margin: 0 auto;">
          ${escapeHTML(getInitials(u.realName || u.username))}
        </div>
        <div class="profile-name" id="pm-name">${escapeHTML(u.realName || '')}</div>
        <div class="profile-username">@${escapeHTML(u.username || '')}</div>
        <button class="btn btn--ghost" id="pm-edit-name-btn" style="margin-top:8px;padding:6px 14px;font-size:var(--text-xs);">✏️ Edit Name</button>
        <form id="pm-name-form" style="display:none;margin-top:10px;">
          <input type="text" id="pm-name-input" class="form-input" value="${escapeHTML(u.realName || '')}" maxlength="100" style="margin-bottom:8px;">
          <div style="display:flex;gap:8px;">
            <button type="submit" class="btn btn--primary" style="flex:1;padding:8px">Save</button>
            <button type="button" id="pm-name-cancel" class="btn btn--ghost" style="flex:1;padding:8px">Cancel</button>
          </div>
        </form>
      </div>

      <div class="profile-section-title">
        My Friends
        <button class="btn btn--ghost" id="pm-add-friend" style="padding:4px 10px;font-size:var(--text-xs);">+ Add</button>
      </div>
      <div id="pm-friends-list" style="min-height:60px;">
        <div style="text-align:center;padding:20px;">
          <div class="spinner spinner--dark" style="margin:0 auto;"></div>
        </div>
      </div>

      <form id="pm-friend-form" style="display:none;background:#f7f7f9;padding:16px;border-radius:var(--radius-md);margin-top:12px;">
        <input type="hidden" name="friendId">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input type="text" name="name" class="form-input" required placeholder="e.g. Rahul Kumar">
        </div>
        <div class="form-group">
          <label class="form-label">Username *</label>
          <input type="text" name="username" class="form-input" required placeholder="rahul123">
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" name="email" class="form-input" required placeholder="rahul@example.com">
        </div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <button type="submit" class="btn btn--primary" style="flex:1;padding:10px">Save</button>
          <button type="button" id="pm-friend-cancel" class="btn btn--ghost" style="flex:1;padding:10px">Cancel</button>
        </div>
      </form>

      <div class="profile-section-title" style="margin-top:24px;">Account</div>
      <button class="btn btn--danger" id="pm-logout" style="width:100%">Log Out</button>
    </div>
  `, { type: 'bottom' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  // Edit name
  const editBtn   = overlay.querySelector('#pm-edit-name-btn');
  const nameForm  = overlay.querySelector('#pm-name-form');
  const nameInput = overlay.querySelector('#pm-name-input');
  const cancelBtn = overlay.querySelector('#pm-name-cancel');
  editBtn.addEventListener('click', () => { nameForm.style.display='block'; editBtn.style.display='none'; nameInput.focus(); });
  cancelBtn.addEventListener('click', () => { nameForm.style.display='none'; editBtn.style.display=''; });
  nameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = nameInput.value.trim();
    if (val.length < 2) return;
    const btn = nameForm.querySelector('[type=submit]');
    btn.classList.add('btn--loading'); btn.disabled = true;
    try {
      const data = await apiFetch('/auth/profile', { method: 'PATCH', body: { realName: val } });
      _state.currentUser.realName = data.realName;
      overlay.querySelector('#pm-name').textContent = escapeHTML(data.realName);
      overlay.querySelector('#pm-avatar').textContent = escapeHTML(getInitials(data.realName));
      renderProfileBtn();
      nameForm.style.display = 'none';
      editBtn.style.display = '';
      showToast('Name updated', 'success');
    } catch (err) { showToast('Failed', 'error'); }
    btn.classList.remove('btn--loading'); btn.disabled = false;
  });

  // Friends list
  _loadFriendsInModal(overlay);

  // Add friend
  overlay.querySelector('#pm-add-friend').addEventListener('click', () => {
    overlay.querySelector('#pm-friend-form').style.display = 'block';
    overlay.querySelector('#pm-friend-form input[name="name"]').focus();
  });
  overlay.querySelector('#pm-friend-cancel').addEventListener('click', () => {
    overlay.querySelector('#pm-friend-form').style.display = 'none';
    overlay.querySelector('#pm-friend-form').reset();
  });

  overlay.querySelector('#pm-friend-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { name: fd.get('name'), username: fd.get('username'), email: fd.get('email') };
    const friendId = fd.get('friendId');
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('btn--loading'); btn.disabled = true;
    try {
      if (friendId) await apiFetch(`/friends/${friendId}`, { method: 'PUT', body: payload });
      else          await apiFetch('/friends', { method: 'POST', body: payload });
      showToast(friendId ? 'Friend updated' : 'Friend added', 'success');
      e.target.style.display = 'none'; e.target.reset();
      await _loadFriendsInModal(overlay);
    } catch (err) { showToast(err.message, 'error'); }
    btn.classList.remove('btn--loading'); btn.disabled = false;
  });

  // Logout
  overlay.querySelector('#pm-logout').addEventListener('click', async () => {
    const btn = overlay.querySelector('#pm-logout');
    btn.classList.add('btn--loading'); btn.disabled = true;
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (_) {}
    if (window.ApiCache) ApiCache.clear();
    window.location.replace('login.html');
  });

  EventBus.emit('profile:modal:open', {});
}

async function _loadFriendsInModal(overlay) {
  const container = overlay.querySelector('#pm-friends-list');
  if (!container) return;
  try {
    const data = await apiFetch('/friends');
    _state.friends = data.friends || [];
    if (!_state.friends.length) {
      container.innerHTML = `<p style="text-align:center;font-size:var(--text-sm);color:var(--color-text-muted);padding:20px 0;">No friends added yet</p>`;
      return;
    }
    container.innerHTML = _state.friends.map(f => {
      const balance = f.total_balance ? f.total_balance / 100 : 0;
      const balClass = balance > 0 ? 'friend-balance--owed' : balance < 0 ? 'friend-balance--owe' : 'friend-balance--even';
      const balText  = balance > 0 ? `owes you ₹${Math.abs(balance).toFixed(2)}`
                     : balance < 0 ? `you owe ₹${Math.abs(balance).toFixed(2)}`
                     : 'settled up';
      return `
        <div class="friend-item" data-friend-id="${f.id}">
          <div class="avatar avatar--sm" style="background:${getAvatarColor(f.name)}">${escapeHTML(getInitials(f.name))}</div>
          <div class="friend-info">
            <div class="friend-name">${escapeHTML(f.name)}</div>
            <div class="friend-handle">@${escapeHTML(f.username)}</div>
            <div class="friend-balance ${balClass}">${balText}</div>
          </div>
          <div class="friend-actions">
            <button class="friend-action-btn" data-action="edit" title="Edit">✏️</button>
            <button class="friend-action-btn friend-action-btn--danger" data-action="delete" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Wire buttons — using data attributes, no inline handlers with user data
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const friendId = btn.closest('[data-friend-id]')?.dataset.friendId;
      const friend   = _state.friends.find(f => String(f.id) === String(friendId));
      if (!friend) return;

      if (btn.dataset.action === 'edit') {
        const form = overlay.querySelector('#pm-friend-form');
        form.style.display = 'block';
        form.querySelector('[name="friendId"]').value = friend.id;
        form.querySelector('[name="name"]').value     = friend.name;
        form.querySelector('[name="username"]').value = friend.username;
        form.querySelector('[name="email"]').value    = friend.email;
        form.querySelector('[name="name"]').focus();
      }

      if (btn.dataset.action === 'delete') {
        if (!confirm(`Remove ${friend.name} from friends?`)) return;
        try {
          await apiFetch(`/friends/${friend.id}`, { method: 'DELETE' });
          showToast('Friend removed', 'info');
          await _loadFriendsInModal(overlay);
        } catch (err) { showToast('Failed', 'error'); }
      }
    });
  } catch (err) {
    container.innerHTML = `<p style="color:var(--color-error);text-align:center;font-size:var(--text-sm);">Failed to load friends</p>`;
  }
}