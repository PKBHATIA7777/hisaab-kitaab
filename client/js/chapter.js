/* client/js/chapter.js — FULL REWRITE */
/* =============================================
   STATE
   ============================================= */
const _urlParams = new URLSearchParams(window.location.search);
const _chapterId = _urlParams.get('id');
window.chapterId = _chapterId; // for feature scripts

if (!_chapterId) window.location.href = 'dashboard.html';

let _state = {
  currentUser:    null,
  chapter:        null,
  members:        [],
  expenses:       [],
  events:         [],
  currentEventId: null,
  offset:         0,
  total:          0,
  hasMore:        false,
};

const PAGE_SIZE = 50;
window.currentEventId = null; // for feature script compatibility
window.currentChapter = null;
window.currentMembers = [];
window.expenses = [];
window.events = [];

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [authData, chapterData] = await Promise.all([
      apiFetch('/auth/me'),
      apiFetch(`/chapters/${_chapterId}`),
    ]);

    _state.currentUser = authData.user;
    _state.chapter     = chapterData.chapter;
    _state.members     = chapterData.members;

    // Expose for feature scripts
    window.currentUser    = authData.user;
    window.currentChapter = chapterData.chapter;
    window.currentMembers = chapterData.members;

    _renderChapterInfo();

    // Parallel secondary data
    await Promise.all([
      _loadEvents(),
      _loadFriendsForAutocomplete(),
    ]);

    await _loadExpenses();

    EventBus.emit('chapter:loaded', {
      chapter: _state.chapter,
      members: _state.members,
      currentUser: _state.currentUser,
    });

  } catch (err) {
    console.error('Chapter load failed:', err);
    showToast('Failed to load chapter', 'error');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
  }
});

/* =============================================
   RENDER CHAPTER INFO
   ============================================= */
function _renderChapterInfo() {
  const ch = _state.chapter;

  // Hide skeleton, show content
  document.getElementById('chapter-hero-skeleton')?.remove();
  const hero = document.getElementById('chapter-hero');
  if (hero) hero.style.display = '';

  // Nav title
  const navTitle = document.getElementById('nav-chapter-name');
  if (navTitle) navTitle.textContent = ch.name;

  // Hero
  const titleEl = document.getElementById('chapter-title');
  const descEl  = document.getElementById('chapter-desc');
  const iconEl  = document.getElementById('chapter-icon');

  if (titleEl) titleEl.textContent = ch.name;
  if (descEl)  {
    descEl.textContent = ch.description || '';
    descEl.style.display = ch.description ? '' : 'none';
  }
  if (iconEl) {
    iconEl.textContent = _getInitials(ch.name);
    iconEl.style.background = _getAvatarColor(ch.name);
  }

  // Show admin controls
  if (_state.currentUser.id === ch.created_by) {
    document.getElementById('member-panel-admin')?.style.setProperty('display', 'block');
  }

  document.title = `${ch.name} — Hisaab-Kitaab`;
}

/* =============================================
   EVENTS
   ============================================= */
async function _loadEvents() {
  try {
    const data = await apiFetch(`/chapters/${_chapterId}/events`);
    _state.events = data.events || [];
    window.events = _state.events;
    _renderEventTabs();
  } catch (err) {
    console.warn('Events load failed:', err.message);
  }
}

function _renderEventTabs() {
  const strip = document.getElementById('events-strip');
  if (!strip) return;

  strip.innerHTML = '';

  // "All" pill
  const allPill = _createPill('All', _state.currentEventId === null, () => _switchEvent(null));
  strip.appendChild(allPill);

  // Event pills
  for (const ev of _state.events) {
    const pill = _createPill(ev.name, _state.currentEventId === ev.id, () => _switchEvent(ev.id));
    strip.appendChild(pill);
  }

  // "+ New" pill
  const newPill = document.createElement('button');
  newPill.className = 'event-pill event-pill--new';
  newPill.textContent = '+ New';
  newPill.addEventListener('click', _openCreateEventModal);
  strip.appendChild(newPill);
}

function _createPill(label, isActive, onClick) {
  const btn = document.createElement('button');
  btn.className = 'event-pill' + (isActive ? ' is-active' : '');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

async function _switchEvent(eventId) {
  if (_state.currentEventId === eventId) return;
  _state.currentEventId = eventId;
  window.currentEventId = eventId;
  _renderEventTabs();
  await _loadExpenses();
  EventBus.emit('event:switched', { eventId });
}

function _openCreateEventModal() {
  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">New Event</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding: 0 20px 24px;">
      <p style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:16px;line-height:1.5;">
        Events are sub-groups inside this chapter (e.g. "Goa Trip", "Diwali Party"). All chapter members are included automatically.
      </p>
      <form id="create-event-form">
        <div class="form-group">
          <label class="form-label" for="ev-name">Event Name *</label>
          <input type="text" id="ev-name" class="form-input" maxlength="100" required placeholder="e.g. Weekend Getaway">
        </div>
        <button type="submit" class="btn btn--primary" id="ev-submit">Create Event</button>
      </form>
    </div>
  `, { type: 'bottom' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  overlay.querySelector('#create-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = overlay.querySelector('#ev-name').value.trim();
    if (!name) return;
    const btn = overlay.querySelector('#ev-submit');
    btn.classList.add('btn--loading'); btn.disabled = true;
    try {
      const data = await apiFetch(`/chapters/${_chapterId}/events`, { method: 'POST', body: { name } });
      showToast('Event created!', 'success');
      ModalManager.close(overlay);
      await _loadEvents();
      _switchEvent(data.event.id);
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
      btn.classList.remove('btn--loading'); btn.disabled = false;
    }
  });

  setTimeout(() => overlay.querySelector('#ev-name')?.focus(), 350);
}

/* =============================================
   EXPENSES
   ============================================= */
async function _loadExpenses(append = false) {
  if (!append) {
    _state.offset = 0;
    _state.expenses = [];
    const list = document.getElementById('expense-list');
    if (list) list.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${Array(3).fill('<div class="skeleton" style="height:68px;border-radius:var(--radius-lg);"></div>').join('')}
      </div>
    `;
  }

  try {
    let url = `/expenses/chapter/${_chapterId}?limit=${PAGE_SIZE}&offset=${_state.offset}`;
    if (_state.currentEventId) url += `&eventId=${_state.currentEventId}`;

    const data = await apiFetch(url);
    const fetched = Array.isArray(data.expenses) ? data.expenses : [];

    if (append) _state.expenses = [..._state.expenses, ...fetched];
    else        _state.expenses = fetched;

    window.expenses = _state.expenses;

    _state.total   = data.pagination?.total ?? 0;
    _state.hasMore = data.pagination?.hasMore ?? false;

    _renderExpenses();
    _renderLoadMore();
    _loadHeroSettlements();

    EventBus.emit('expenses:rendered', { expenses: _state.expenses });

  } catch (err) {
    console.error('Expenses load failed:', err);
    const list = document.getElementById('expense-list');
    if (list) list.innerHTML = `<div style="text-align:center;padding:32px;color:rgba(255,255,255,0.5);">Failed to load expenses</div>`;
  }
}

// Expose for feature scripts
window.loadExpenses = (append) => _loadExpenses(append);

function _renderExpenses() {
  const list = document.getElementById('expense-list');
  if (!list) return;

  list.innerHTML = '';
  const empty = document.getElementById('chapter-empty-state');

  if (!_state.expenses.length) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  for (const ex of _state.expenses) {
    list.appendChild(_buildExpenseCard(ex));
  }
}

// Expose for feature scripts (feature-categories patches this)
window.renderExpenses = _renderExpenses;

function _buildExpenseCard(ex) {
  const card = document.createElement('div');
  card.className = 'expense-card' + (ex.isTemp ? ' expense-card--temp' : '');
  card.dataset.expenseId = ex.id;

  const icon     = ex.category_icon || '💰';
  const name     = escapeHTML(ex.description || 'Untitled');
  const payer    = escapeHTML(ex.payer_name || 'Unknown');
  const amount   = `₹${parseFloat(ex.amount).toLocaleString('en-IN')}`;
  const when     = _timeAgo(ex.expense_date);

  // Accessibility attributes
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${name}, paid by ${payer}, ${amount}`);

  card.innerHTML = `
    <div class="expense-icon">${icon}</div>
    <div class="expense-info">
      <div class="expense-info__name">${name}</div>
      <div class="expense-info__meta"><strong>${payer}</strong> · ${when}</div>
    </div>
    <div class="expense-right">
      <div class="expense-amount">${amount}</div>
      ${ex.isTemp ? '' : '<div class="expense-edit-hint">Tap to edit</div>'}
    </div>
  `;

  if (!ex.isTemp) {
    card.addEventListener('click', () => _openExpenseModal('edit', ex.id));
  }

  return card;
}

function _renderLoadMore() {
  const container = document.getElementById('load-more-container');
  if (!container) return;
  container.innerHTML = '';
  if (!_state.hasMore) return;

  const btn = document.createElement('button');
  btn.className = 'btn-load-more';
  btn.textContent = 'Load more expenses';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Loading…';
    _state.offset += PAGE_SIZE;
    await _loadExpenses(true);
  });
  container.appendChild(btn);
}

/* =============================================
   SETTLEMENT HERO
   ============================================= */
async function _loadHeroSettlements(force = false) {
  try {
    let url = `/expenses/chapter/${_chapterId}/settlements`;
    if (_state.currentEventId) url += `?eventId=${_state.currentEventId}`;
    const data = await apiFetch(url, force ? { _noCache: true } : {});
    _renderHeroSettlements(data.settlements || []);
  } catch (err) {
    console.warn('Settlement hero error:', err.message);
  }
}

function _renderHeroSettlements(settlements) {
  const listEl  = document.getElementById('hero-settlement-list');
  const content = document.getElementById('hero-settlement-body');
  const btn     = document.getElementById('hero-expand-btn');

  if (!listEl) return;

  // Auto-expand if there are settlements
  if (settlements.length > 0 && content) {
    content.classList.add('is-open');
    btn?.classList.add('is-open');
    document.getElementById('hero-settlement-header')?.classList.add('is-open');
  }

  if (!settlements.length) {
    listEl.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(255,255,255,0.5);font-size:var(--text-sm);">🎉 All settled up!</div>';
    return;
  }

  listEl.innerHTML = settlements.map(s => `
    <div class="settle-row" role="listitem">
      <div class="settle-row__info">
        ${renderAvatar(s.from, { size: 'sm' })}
        <div class="settle-row__names">
          <strong>${escapeHTML(s.from)}</strong>
          <span class="settle-row__arrow" aria-label="owes">→</span>
          <strong>${escapeHTML(s.to)}</strong>
        </div>
      </div>
      <div class="settle-row__amount" aria-label="Amount: ₹${s.amount}">
        <span aria-hidden="true">💸</span>
        ₹${s.amount}
      </div>
    </div>
  `).join('');

  EventBus.emit('settlement:refresh', { settlements });
}

// Expose for feature scripts
window.loadHeroSettlements = (force) => _loadHeroSettlements(force);
window.renderHeroSettlements = _renderHeroSettlements;

// Toggle collapse
document.getElementById('hero-settlement-header')?.addEventListener('click', (e) => {
  if (e.target.closest('.icon-btn-sm') && !e.target.closest('#hero-expand-btn')) return;
  const body = document.getElementById('hero-settlement-body');
  const btn  = document.getElementById('hero-expand-btn');
  const header = document.getElementById('hero-settlement-header');
  body?.classList.toggle('is-open');
  btn?.classList.toggle('is-open');
  header?.classList.toggle('is-open');
});

// Refresh settlements button
window.refreshSettlements = async () => { await _loadHeroSettlements(true); showToast('Refreshed', 'info'); };

/* =============================================
   ADD / EDIT EXPENSE MODAL
   ============================================= */
async function _openExpenseModal(mode, expenseId) {
  let existingExpense = null;
  let involvedIds     = [];

  if (mode === 'edit' && expenseId) {
    try {
      showToast('Loading…', 'info');
      const data = await apiFetch(`/expenses/${expenseId}`);
      existingExpense = data.expense;
      involvedIds     = data.involvedMemberIds || [];
    } catch (err) {
      showToast('Failed to load expense', 'error');
      return;
    }
  }

  const isEdit = mode === 'edit';

  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">${isEdit ? 'Edit Expense' : 'Add Expense'}</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <form id="expense-form" style="padding: 0 20px; display:flex; flex-direction:column; gap:20px; overflow-y:auto; max-height:calc(92dvh - 120px); padding-bottom: 24px;">

      <!-- Amount -->
      <div class="amount-block">
        <div class="amount-row">
          <span class="amount-currency">₹</span>
          <input type="number" class="amount-input" name="amount" id="exp-amount"
            placeholder="0" min="0.01" step="any" inputmode="decimal"
            value="${isEdit ? existingExpense?.amount || '' : ''}" required>
        </div>
        <div class="amount-underline"></div>
      </div>

      <!-- Description -->
      <div class="form-group" style="margin:0">
        <label class="form-label" for="exp-desc">
          Description <span class="form-label--optional">(optional)</span>
        </label>
        <input type="text" id="exp-desc" name="description" class="form-input"
          placeholder="e.g. Dinner at Taj" maxlength="100" autocomplete="off"
          value="${isEdit ? escapeHTML(existingExpense?.description || '') : ''}">
      </div>

      <!-- Category row injected by feature-categories.js -->
      <div id="expense-category-inject"></div>

      <!-- Paid by -->
      <div class="form-group" style="margin:0">
        <label class="form-label">Paid By</label>
        <div class="payer-scroll" id="exp-payer-list"></div>
      </div>

      <!-- Split among -->
      <div class="form-group" style="margin:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <label class="form-label" style="margin:0">Split Among</label>
          <button type="button" class="btn btn--ghost" id="exp-select-all" style="padding:4px 10px;font-size:var(--text-xs);">Select All</button>
        </div>
        <div class="split-list" id="exp-split-list"></div>
      </div>

      <!-- Actions -->
      <div class="sheet-actions">
        <button type="submit" class="btn-save-expense" id="exp-save">${isEdit ? 'Update Expense' : 'Save Expense'}</button>
        ${isEdit ? '<button type="button" class="btn-delete-expense" id="exp-delete">Delete</button>' : ''}
      </div>
    </form>
  `, { type: 'bottom' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  // Render payers and split options
  _renderPayerOptions(overlay, isEdit ? existingExpense?.payer_member_id : null);
  _renderSplitOptions(overlay, isEdit ? involvedIds : []);

  // Select all
  overlay.querySelector('#exp-select-all')?.addEventListener('click', () => {
    const rows = overlay.querySelectorAll('.split-row');
    const allSelected = [...rows].every(r => r.classList.contains('is-selected'));
    rows.forEach(r => {
      r.classList.toggle('is-selected', !allSelected);
    });
  });

  // Delete button
  if (isEdit) {
    overlay.querySelector('#exp-delete')?.addEventListener('click', async () => {
      if (!confirm('Delete this expense?')) return;
      try {
        await apiFetch(`/expenses/${expenseId}`, { method: 'DELETE' });
        showToast('Expense deleted', 'success');
        ModalManager.close(overlay);
        await _loadExpenses();
      } catch (err) { showToast('Failed', 'error'); }
    });
  }

  // Emit for feature scripts to inject category selector
  EventBus.emit('expense:modal:open', { mode, expense: existingExpense });

  // Submit
  overlay.querySelector('#expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawAmount = overlay.querySelector('#exp-amount').value;
    const amount    = parseFloat(String(rawAmount).replace(/,/g, '').trim());
    if (!amount || amount <= 0 || amount > 9_999_999) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    const description = overlay.querySelector('#exp-desc').value.trim();
    const payerInput  = overlay.querySelector('input[name="payerMemberId"]:checked');
    const payerId     = payerInput ? parseInt(payerInput.value) : _state.members[0]?.id;
    const splitIds    = [...overlay.querySelectorAll('.split-row.is-selected')].map(r => parseInt(r.dataset.memberId));

    if (!splitIds.length) { showToast('Select at least one person to split with', 'error'); return; }

    const categoryId = window._pendingCategoryId ?? null;
    window._pendingCategoryId = undefined;

    const btn = overlay.querySelector('#exp-save');
    btn.classList.add('btn--loading'); btn.disabled = true;

    const payload = {
      chapterId: _chapterId,
      eventId:   _state.currentEventId || null,
      amount,
      description,
      payerMemberId: payerId,
      involvedMemberIds: splitIds,
      categoryId,
    };

    // Optimistic UI for add
    if (!isEdit) {
      const payer = _state.members.find(m => m.id === payerId);
      const temp  = { id: `temp-${Date.now()}`, amount, description, expense_date: new Date().toISOString(), payer_name: payer?.member_name, isTemp: true };
      _state.expenses.unshift(temp);
      window.expenses = _state.expenses;
      _renderExpenses();
      ModalManager.close(overlay);
    }

    try {
      if (isEdit) {
        await apiFetch(`/expenses/${expenseId}`, { method: 'PUT', body: payload });
        showToast('Expense updated', 'success');
        ModalManager.close(overlay);
      } else {
        await apiFetch('/expenses', { method: 'POST', body: payload });
      }
      await _loadExpenses();
      EventBus.emit('expense:saved', { mode });

    } catch (err) {
      if (!isEdit) {
        _state.expenses = _state.expenses.filter(ex => !ex.isTemp);
        window.expenses = _state.expenses;
        _renderExpenses();
        // Reopen modal
        ModalManager.open(overlay);
      }
      btn.classList.remove('btn--loading'); btn.disabled = false;
      showToast(err.message || 'Failed to save', 'error');
    }
  });

  setTimeout(() => overlay.querySelector('#exp-amount')?.focus(), 350);
}

function _renderPayerOptions(overlay, selectedId) {
  const container = overlay.querySelector('#exp-payer-list');
  if (!container) return;

  container.innerHTML = '';
  _state.members.forEach((m, idx) => {
    const isSelected = selectedId ? m.id === selectedId : idx === 0;
    const chip = document.createElement('label');
    chip.className = 'payer-chip' + (isSelected ? ' is-selected' : '');
    chip.innerHTML = `
      <input type="radio" name="payerMemberId" value="${m.id}" ${isSelected ? 'checked' : ''} style="position:absolute;opacity:0;pointer-events:none;">
      ${escapeHTML(m.member_name)}
    `;
    chip.addEventListener('click', () => {
      container.querySelectorAll('.payer-chip').forEach(c => c.classList.remove('is-selected'));
      chip.classList.add('is-selected');
    });
    container.appendChild(chip);
  });
}

function _renderSplitOptions(overlay, selectedIds) {
  const container = overlay.querySelector('#exp-split-list');
  if (!container) return;

  container.innerHTML = '';
  const isAdd = !selectedIds.length;

  _state.members.forEach(m => {
    const isSelected = isAdd || selectedIds.includes(m.id);
    const row = document.createElement('div');
    row.className = 'split-row' + (isSelected ? ' is-selected' : '');
    row.dataset.memberId = m.id;
    row.innerHTML = `
      <div class="split-check"></div>
      <span class="split-row__name">${escapeHTML(m.member_name)}</span>
    `;
    row.addEventListener('click', () => row.classList.toggle('is-selected'));
    container.appendChild(row);
  });
}

// Expose for feature-creator-label.js compatibility
window.renderPayerAndSplitOptions = (payerId, splitIds) => {
  // This will be called from feature scripts if needed
  // The modal must be open for this to work
  const overlay = document.querySelector('.modal-overlay.is-open');
  if (!overlay) return;
  _renderPayerOptions(overlay, payerId);
  _renderSplitOptions(overlay, splitIds || []);
};

// Expose openEditExpenseModal for backward compat with feature scripts
window.openEditExpenseModal = (id) => _openExpenseModal('edit', id);
window.openAddExpenseModal  = ()   => _openExpenseModal('add');

/* =============================================
   SUMMARY MODAL
   ============================================= */
window.openSummaryModal = async () => {
  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">Chapter Summary</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding: 0 20px 24px;">
      <div class="summary-grand">
        <div class="summary-grand__label">Total Spent</div>
        <div class="summary-grand__amount" id="summary-total">Loading…</div>
      </div>
      <div id="summary-list" style="max-height:55dvh;overflow-y:auto;"></div>
    </div>
  `, { type: 'bottom' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  try {
    let url = `/expenses/chapter/${_chapterId}/summary`;
    if (_state.currentEventId) url += `?eventId=${_state.currentEventId}`;
    const data = await apiFetch(url);
    _renderSummary(overlay, data);
  } catch (err) {
    overlay.querySelector('#summary-list').innerHTML = `<p style="color:var(--color-error);text-align:center">Failed to load</p>`;
  }
};

function _renderSummary(overlay, data) {
  const { summary, grandTotal } = data;
  overlay.querySelector('#summary-total').textContent = `₹${grandTotal}`;

  const maxVal = Math.max(...summary.map(s => Math.max(parseFloat(s.total_spent), parseFloat(s.total_used))), 1);
  const list = overlay.querySelector('#summary-list');

  list.innerHTML = summary.map(item => {
    const spent   = parseFloat(item.total_spent);
    const used    = parseFloat(item.total_used);
    const spPct   = ((spent / maxVal) * 100).toFixed(1);
    const usPct   = ((used  / maxVal) * 100).toFixed(1);
    return `
      <div class="summary-row">
        <div class="summary-row__header">
          <div class="summary-row__name">
            <div class="avatar avatar--sm" style="background:${_getAvatarColor(item.member_name)}">${escapeHTML(_getInitials(item.member_name))}</div>
            ${escapeHTML(item.member_name)}
          </div>
        </div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);display:flex;justify-content:space-between;margin-bottom:3px;"><span>Paid</span><span>₹${spent.toFixed(2)}</span></div>
        <div class="summary-bar-track"><div class="summary-bar-fill" style="width:${spPct}%;background:var(--color-success)"></div></div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted);display:flex;justify-content:space-between;margin:6px 0 3px;"><span>Consumed</span><span>₹${used.toFixed(2)}</span></div>
        <div class="summary-bar-track"><div class="summary-bar-fill" style="width:${usPct}%;background:var(--color-brand)"></div></div>
      </div>
    `;
  }).join('');

  // Let feature-personal-chapter.js inject buttons
  EventBus.emit('summary:rendered', { data, overlay });
}

/* =============================================
   SETTLE UP MODAL
   ============================================= */
window.openSettlementModal = async () => {
  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">Settle Up</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding: 0 20px 24px;">
      <div id="settle-loading" style="text-align:center;padding:32px;">
        <div class="spinner spinner--dark" style="margin:0 auto 12px;"></div>
        <p style="font-size:var(--text-sm);color:var(--color-text-muted)">Calculating…</p>
      </div>
      <div id="settle-list" style="display:none;"></div>
      <div id="settle-empty" style="display:none;text-align:center;padding:32px;">
        <div style="font-size:2.5rem;margin-bottom:12px">🎉</div>
        <p style="font-weight:700;margin-bottom:4px">All Settled Up!</p>
        <p style="font-size:var(--text-sm);color:var(--color-text-muted)">No pending payments</p>
      </div>
      <div id="settle-history-section" style="margin-top:16px;"></div>
    </div>
  `, { type: 'bottom' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  try {
    let url = `/expenses/chapter/${_chapterId}/settlements`;
    if (_state.currentEventId) url += `?eventId=${_state.currentEventId}`;
    const data = await apiFetch(url);

    overlay.querySelector('#settle-loading').style.display = 'none';

    if (!data.settlements?.length) {
      overlay.querySelector('#settle-empty').style.display = '';
    } else {
      const list = overlay.querySelector('#settle-list');
      list.style.display = '';
      list.innerHTML = data.settlements.map(s => `
        <div class="settle-row" style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <div class="settle-row__info">
            <div class="avatar avatar--sm" style="background:${_getAvatarColor(s.from)}">${escapeHTML(_getInitials(s.from))}</div>
            <div class="settle-row__names" style="color:var(--color-text-primary)"><strong>${escapeHTML(s.from)}</strong> → <strong>${escapeHTML(s.to)}</strong></div>
          </div>
          <span style="font-weight:700;color:var(--color-brand);margin:0 12px;">₹${s.amount}</span>
          <button class="btn-mark-settled" data-from="${escapeHTML(s.from)}" data-to="${escapeHTML(s.to)}" data-amount="${s.amount}" data-from-id="${s.fromId}" data-to-id="${s.toId}">✓ Mark</button>
        </div>
      `).join('');

      list.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-mark-settled');
        if (!btn) return;
        window._openMarkModal({
          from: btn.dataset.from, to: btn.dataset.to,
          amount: parseFloat(btn.dataset.amount),
          fromId: parseInt(btn.dataset.fromId), toId: parseInt(btn.dataset.toId),
        });
      });
    }

    // History
    _loadSettlementHistory(overlay);

  } catch (err) {
    overlay.querySelector('#settle-loading').innerHTML = `<p style="color:var(--color-error)">Failed to load settlements</p>`;
  }
};

async function _loadSettlementHistory(overlay) {
  try {
    let url = `/chapters/${_chapterId}/settlements/history`;
    if (_state.currentEventId) url += `?eventId=${_state.currentEventId}`;
    const data = await apiFetch(url);
    const history = data.history || [];
    if (!history.length) return;

    const section = overlay.querySelector('#settle-history-section');
    if (!section) return;

    section.innerHTML = `
      <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--color-text-muted);margin-bottom:10px;">✅ Completed (${history.length})</div>
      ${history.map(r => `
        <div class="settled-record">
          <div class="settled-record__info">
            <div class="settled-record__names"><strong>${escapeHTML(r.from_name)}</strong> → <strong>${escapeHTML(r.to_name)}</strong></div>
            <div class="settled-record__date">${new Date(r.marked_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}${r.note ? ' · ' + escapeHTML(r.note) : ''}</div>
          </div>
          <span class="settled-record__amount">₹${parseFloat(r.amount).toFixed(2)}</span>
          <button class="btn-undo" data-record-id="${r.id}">Undo</button>
        </div>
      `).join('')}
    `;

    section.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-undo');
      if (!btn) return;
      if (!confirm('Undo this settlement?')) return;
      try {
        await apiFetch(`/chapters/${_chapterId}/settlements/history/${btn.dataset.recordId}`, { method: 'DELETE' });
        showToast('Undone', 'info');
        ModalManager.close(overlay);
        window.openSettlementModal();
      } catch (err) { showToast('Failed', 'error'); }
    });
  } catch (_) {}
}

// Mark settlement modal
window._openMarkModal = (s) => {
  const fromMember = _state.members.find(m => m.member_name === s.from || m.id === s.fromId);
  const toMember   = _state.members.find(m => m.member_name === s.to   || m.id === s.toId);

  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">Mark as Settled</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding:0 20px 24px;display:flex;flex-direction:column;gap:16px;">
      <div style="background:#f5f5f7;border-radius:var(--radius-md);padding:16px;text-align:center;">
        <div style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:4px;">
          <strong>${escapeHTML(s.from)}</strong> pays <strong>${escapeHTML(s.to)}</strong>
        </div>
        <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Pending: ₹${parseFloat(s.amount).toFixed(2)}</div>
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Amount</label>
        <div style="display:flex;align-items:center;gap:8px;border:1.5px solid #eee;border-radius:var(--radius-md);padding:10px 14px;">
          <span style="color:var(--color-text-muted)">₹</span>
          <input type="number" id="mark-amount" step="0.01" min="0.01"
            value="${parseFloat(s.amount).toFixed(2)}"
            style="border:none;background:transparent;font-size:var(--text-lg);font-weight:700;color:var(--color-text-primary);flex:1;outline:none;font-family:var(--font-main);">
        </div>
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Note <span class="form-label--optional">(optional)</span></label>
        <input type="text" id="mark-note" class="form-input" placeholder="e.g. Paid via GPay">
      </div>
      <button class="btn btn--brand" id="mark-confirm">Confirm Settlement</button>
    </div>
  `, { maxWidth: '400px' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

  overlay.querySelector('#mark-confirm').addEventListener('click', async () => {
    const amount = parseFloat(overlay.querySelector('#mark-amount').value);
    const note   = overlay.querySelector('#mark-note').value.trim();
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

    if (!fromMember || !toMember) { showToast('Could not identify members', 'error'); return; }

    const btn = overlay.querySelector('#mark-confirm');
    btn.classList.add('btn--loading'); btn.disabled = true;

    try {
      await apiFetch(`/chapters/${_chapterId}/settlements/mark`, {
        method: 'POST',
        body: { fromMemberId: fromMember.id, toMemberId: toMember.id, amount, note, eventId: _state.currentEventId },
      });
      showToast('Settlement marked ✓', 'success');
      ModalManager.close(overlay);
      await _loadExpenses();
      await _loadHeroSettlements(true);
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
      btn.classList.remove('btn--loading'); btn.disabled = false;
    }
  });

  setTimeout(() => overlay.querySelector('#mark-amount')?.focus(), 300);
};

/* =============================================
   MEMBERS PANEL
   ============================================= */
window.openMembersPanel = () => {
  document.getElementById('members-panel')?.classList.add('is-open');
  document.getElementById('panel-backdrop')?.classList.add('is-open');
  document.body.style.overflow = 'hidden';
};

window.closeMembersPanel = () => {
  document.getElementById('members-panel')?.classList.remove('is-open');
  document.getElementById('panel-backdrop')?.classList.remove('is-open');
  document.body.style.overflow = '';
};

document.getElementById('panel-backdrop')?.addEventListener('click', window.closeMembersPanel);

async function _renderMembers() {
  const list = document.getElementById('members-panel-list');
  if (!list) return;

  let involvedIds = [];
  try {
    const data = await apiFetch(`/chapters/${_chapterId}/members/deletability`);
    involvedIds = data.involvedMemberIds || [];
  } catch (_) { involvedIds = _state.members.map(m => m.id); }

  const isAdmin = _state.currentUser.id === _state.chapter.created_by;
  list.innerHTML = '';

  for (const m of _state.members) {
    const isCreator  = m.user_id === _state.chapter.created_by;
    const isInvolved = involvedIds.includes(m.id);
    const canDelete  = isAdmin && !isCreator && !isInvolved;

    const row = document.createElement('div');
    row.className = 'member-panel-row';
    row.innerHTML = `
      <div class="avatar avatar--sm" style="background:${_getAvatarColor(m.member_name)}">${escapeHTML(_getInitials(m.member_name))}</div>
      <div class="member-panel-row__name">
        ${escapeHTML(m.member_name)}
        ${isCreator ? '<span class="admin-badge">Admin</span>' : ''}
        ${m.user_id === _state.currentUser.id ? '<span class="you-badge">you</span>' : ''}
      </div>
      ${canDelete ? `<button class="remove-member-btn" data-member-id="${m.id}" aria-label="Remove ${escapeHTML(m.member_name)}">×</button>` : ''}
    `;
    list.appendChild(row);
  }

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('.remove-member-btn');
    if (!btn) return;
    const memberId = btn.dataset.memberId;
    if (!confirm('Remove this member?')) return;
    try {
      await apiFetch(`/chapters/${_chapterId}/members/${memberId}`, { method: 'DELETE' });
      showToast('Member removed', 'info');
      const data = await apiFetch(`/chapters/${_chapterId}`);
      _state.members = data.members;
      window.currentMembers = data.members;
      _renderMembers();
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
  });
}

window.openAddMemberModal = () => {
  const overlay = ModalManager.createOverlay(`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <h2 class="modal-title">Add Member</h2>
      <button class="modal-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="padding:0 20px 24px;">
      <form id="add-member-form">
        <div class="form-group">
          <label class="form-label" for="am-name">Member Name *</label>
          <input type="text" id="am-name" class="form-input" required placeholder="Enter name or select friend…" list="friends-suggestions-am" autocomplete="off">
          <datalist id="friends-suggestions-am">
            ${_state.members.map(f => `<option value="${escapeHTML(f.member_name)}">`).join('')}
          </datalist>
        </div>
        <button type="submit" class="btn btn--primary" id="am-submit">Add Member</button>
      </form>
    </div>
  `, { type: 'bottom' });

  overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));
  overlay.querySelector('#add-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = overlay.querySelector('#am-name').value.trim();
    if (!name) return;
    const btn = overlay.querySelector('#am-submit');
    btn.classList.add('btn--loading'); btn.disabled = true;
    try {
      await apiFetch(`/chapters/${_chapterId}/members`, { method: 'POST', body: { memberName: name } });
      showToast('Member added', 'success');
      ModalManager.close(overlay);
      const data = await apiFetch(`/chapters/${_chapterId}`);
      _state.members = data.members;
      window.currentMembers = data.members;
      _renderMembers();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
      btn.classList.remove('btn--loading'); btn.disabled = false;
    }
  });
  setTimeout(() => overlay.querySelector('#am-name')?.focus(), 350);
};

/* =============================================
   EXPORT
   ============================================= */
window.downloadReport = async () => {
  try {
    showToast('Generating report…', 'info');
    const csrfToken = CSRFManager.get();
    let url = `/api/chapters/${_chapterId}/export`;
    if (_state.currentEventId) url += `?eventId=${_state.currentEventId}`;

    const res = await fetch(url, { headers: { 'X-CSRF-Token': csrfToken }, credentials: 'include' });
    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${_state.chapter.name.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_report.xlsx`,
    });
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
    showToast('Report downloaded', 'success');
  } catch (err) { showToast('Export failed', 'error'); }
};

/* =============================================
   NAV MENU
   ============================================= */
const _menuBtn  = document.getElementById('chapter-menu-btn');
const _menuEl   = document.getElementById('chapter-nav-dropdown');

_menuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = _menuEl?.classList.toggle('is-open');
  _menuBtn.setAttribute('aria-expanded', String(!!isOpen));
});

document.addEventListener('click', (e) => {
  if (!_menuEl?.contains(e.target) && e.target !== _menuBtn) {
    _menuEl?.classList.remove('is-open');
  }
});

/* =============================================
   FAB
   ============================================= */
document.getElementById('chapter-fab')?.addEventListener('click', () => _openExpenseModal('add'));

/* =============================================
   FRIENDS FOR AUTOCOMPLETE
   ============================================= */
let _friendsCache = [];
async function _loadFriendsForAutocomplete() {
  try {
    const data = await apiFetch('/friends');
    _friendsCache = data.friends || [];
  } catch (_) {}
}

/* =============================================
   UTILS (module-private)
   ============================================= */
function _getInitials(name = '') {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  if (w.length === 1) return w[0][0].toUpperCase();
  return (w[0][0] + w[w.length-1][0]).toUpperCase();
}

function _getAvatarColor(name = '') {
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#F9CA24','#F0932B','#6C5CE7','#A29BFE','#00B894'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function _timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d/30)}mo ago`;
}

// Re-render members when chapter loads
EventBus.on('chapter:loaded', () => _renderMembers());