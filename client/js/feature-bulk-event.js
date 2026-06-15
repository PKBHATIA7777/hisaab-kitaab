/* client/js/feature-bulk-event.js */
/* Feature 5: Multi-select expenses + bulk assign to event */
/* Refactored for Phase 6: Uses EventBus instead of monkey-patching and setTimeout polling */

// ─────────────────────────────────────────────────────────────
// CONFIRM HELPER (replaces native confirm())
// ─────────────────────────────────────────────────────────────
function _bulkConfirm(message) {
  return new Promise(resolve => {
    const overlay = ModalManager.createOverlay(`
      <div style="padding:24px 20px;">
        <p style="font-size:var(--text-base);font-weight:600;color:var(--text-primary);
                  margin:0 0 20px;">${escapeHTML(message)}</p>
        <div style="display:flex;gap:10px;">
          <button class="btn btn--primary" id="_bce-yes" style="flex:1;">Confirm</button>
          <button class="btn btn--ghost" id="_bce-no" style="flex:1;">Cancel</button>
        </div>
      </div>
    `, { maxWidth: '360px', closeOnBackdrop: false });
    overlay.querySelector('#_bce-yes').onclick = () => { ModalManager.close(overlay); resolve(true); };
    overlay.querySelector('#_bce-no').onclick  = () => { ModalManager.close(overlay); resolve(false); };
  });
}

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let isSelectMode = false;
let selectedExpenseIds = new Set();
let _pendingAssignReopen = false;

// ─────────────────────────────────────────────────────────────
// INJECT "Select" option into chapter nav dropdown
// ─────────────────────────────────────────────────────────────
function injectSelectModeButton() {
  // Support both old and new dropdown IDs
  const dropdown = document.getElementById('chapter-menu-dropdown') || document.getElementById('chapter-nav-dropdown');
  if (!dropdown) return;
  if (document.getElementById('select-mode-btn')) return;

  const hr = dropdown.querySelector('hr') || dropdown.querySelector('.nav-dropdown__divider');
  const btn = document.createElement('button');
  btn.id = 'select-mode-btn';
  btn.type = 'button';
  btn.className = 'nav-dropdown__item'; // Match new class if present
  btn.innerHTML = '<span>☑️</span> Select Expenses';
  btn.onclick = () => {
    dropdown.classList.remove('active');
    dropdown.setAttribute('aria-expanded', 'false');
    enterSelectMode();
  };

  if (hr) {
    dropdown.insertBefore(btn, hr);
  } else {
    dropdown.appendChild(btn);
  }
}

// ─────────────────────────────────────────────────────────────
// ENTER / EXIT SELECT MODE
// ─────────────────────────────────────────────────────────────
function enterSelectMode() {
  isSelectMode = true;
  selectedExpenseIds.clear();

  // Hide FAB
  const fab = document.querySelector('.fab');
  if (fab) fab.style.display = 'none';

  // Rebuild expense list in selectable mode
  renderExpensesInSelectMode();

  // Show selection action bar
  showSelectionBar();
}

function exitSelectMode() {
  isSelectMode = false;
  selectedExpenseIds.clear();

  // Show FAB again
  const fab = document.querySelector('.fab');
  if (fab) fab.style.display = '';

  // Rebuild expense list normally
  if (typeof window.renderExpenses === 'function') {
    window.renderExpenses();
  }

  // Remove action bar
  const bar = document.getElementById('selection-action-bar');
  if (bar) bar.remove();
}

// ─────────────────────────────────────────────────────────────
// RENDER EXPENSES IN SELECT MODE (XSS FIXED)
// ─────────────────────────────────────────────────────────────
function renderExpensesInSelectMode() {
  const listEl = document.getElementById('expense-list');
  if (!listEl || !window.expenses) return;

  listEl.innerHTML = '';

  if (window.expenses.length === 0) {
    listEl.innerHTML = '<div class="empty-state empty-state--inline"><p class="empty-state__subtitle">No expenses to select.</p></div>';
    return;
  }

  window.expenses.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'expense-card selectable';
    card.dataset.expenseId = ex.id;

    // ALL user content goes through textContent (no XSS)
    const checkEl = document.createElement('div');
    checkEl.className = 'expense-select-check';
    checkEl.id = `check-${ex.id}`;

    const infoEl = document.createElement('div');
    infoEl.className = 'expense-info';
    
    const nameEl = document.createElement('div');
    nameEl.className = 'expense-info__name';
    nameEl.textContent = ex.description || 'Untitled Expense'; 

    const metaEl = document.createElement('p');
    metaEl.className = 'expense-info__meta';
    
    const payerStrong = document.createElement('strong');
    payerStrong.textContent = ex.payer_name || 'Unknown';
    
    metaEl.append('paid by ', payerStrong);
    
    if (ex.event_id) {
      const tag = document.createElement('span');
      tag.className = 'badge badge--brand';
      tag.style.fontSize = '0.65rem';
      tag.textContent = 'In event';
      metaEl.append(' ', tag);
    }

    infoEl.appendChild(nameEl);
    infoEl.appendChild(metaEl);

    const amountEl = document.createElement('div');
    amountEl.className = 'expense-amount';
    amountEl.textContent = `₹${parseFloat(ex.amount).toLocaleString('en-IN')}`;

    card.appendChild(checkEl);
    card.appendChild(infoEl);
    card.appendChild(amountEl);

    card.addEventListener('click', () => toggleExpenseSelection(card, ex.id));
    listEl.appendChild(card);
  });
}

function toggleExpenseSelection(card, expenseId) {
  const id = String(expenseId);
  const checkEl = document.getElementById(`check-${id}`);

  if (selectedExpenseIds.has(id)) {
    selectedExpenseIds.delete(id);
    card.classList.remove('selected-card');
    if (checkEl) { checkEl.textContent = ''; }
  } else {
    selectedExpenseIds.add(id);
    card.classList.add('selected-card');
    if (checkEl) { checkEl.textContent = '✓'; }
  }

  updateSelectionBar();
}

// ─────────────────────────────────────────────────────────────
// SELECTION ACTION BAR
// ─────────────────────────────────────────────────────────────
function showSelectionBar() {
  const existing = document.getElementById('selection-action-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'selection-action-bar';
  bar.className = 'selection-action-bar';
  bar.innerHTML = `
    <span class="selection-count-label" id="selection-count-label">0 selected</span>
    <button class="btn-assign-event" id="btn-assign-event-action"
      onclick="openEventAssignSheet()" disabled>
      Assign to Event
    </button>
    <button class="btn-remove-from-event" id="btn-remove-event-action"
      onclick="removeFromEvent()" style="display:none;">
      Remove from Event
    </button>
    <button class="btn-cancel-select" onclick="exitSelectMode()">Cancel</button>
  `;
  document.body.appendChild(bar);
}

function updateSelectionBar() {
  const count = selectedExpenseIds.size;

  const label = document.getElementById('selection-count-label');
  if (label) label.textContent = `${count} selected`;

  const assignBtn = document.getElementById('btn-assign-event-action');
  if (assignBtn) assignBtn.disabled = count === 0;

  // Show "remove from event" only if ALL selected expenses are in an event
  const removeBtn = document.getElementById('btn-remove-event-action');
  if (removeBtn && window.expenses) {
    const selectedExpenses = window.expenses.filter(ex => selectedExpenseIds.has(String(ex.id)));
    const allInEvent = selectedExpenses.length > 0 && selectedExpenses.every(ex => ex.event_id);
    removeBtn.style.display = allInEvent ? '' : 'none';
  }
}

// ─────────────────────────────────────────────────────────────
// REMOVE FROM EVENT
// ─────────────────────────────────────────────────────────────
window.removeFromEvent = async function() {
  const ids = Array.from(selectedExpenseIds).map(Number);
  if (ids.length === 0) return;

  const confirmed = await _bulkConfirm(`Remove ${ids.length} expense(s) from their current event?`);
  if (!confirmed) return;

  try {
    await apiFetch('/expenses/bulk-assign-event', {
      method: 'PATCH',
      body: { expenseIds: ids, eventId: null, chapterId: parseInt(window.chapterId) }
    });

    showToast(`${ids.length} expense(s) removed from event`, 'success');
    exitSelectMode();

    if (typeof window.loadExpenses === 'function') window.loadExpenses();

  } catch (err) {
    showToast(err.message || 'Failed to remove', 'error');
  }
};

// ─────────────────────────────────────────────────────────────
// EVENT ASSIGN BOTTOM SHEET
// ─────────────────────────────────────────────────────────────
window.openEventAssignSheet = async function() {
  const ids = Array.from(selectedExpenseIds).map(Number);
  if (ids.length === 0) {
    showToast('Select at least one expense', 'error');
    return;
  }

  if (window.expenses) {
    const selectedExpenses = window.expenses.filter(ex => selectedExpenseIds.has(String(ex.id)));
    const inOtherEvent = selectedExpenses.filter(ex => ex.event_id && ex.event_id !== window.currentEventId);
    if (inOtherEvent.length > 0) {
      const confirmed = await _bulkConfirm(
        `${inOtherEvent.length} selected expense(s) are already in another event and will be moved. Continue?`
      );
      if (!confirmed) return;
    }
  }

  const existing = document.getElementById('event-assign-sheet-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'event-assign-sheet-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px;">
      <div class="modal-header">
        <h2 style="font-size:1.1rem;">Assign to Event</h2>
        <button class="close-modal" onclick="document.getElementById('event-assign-sheet-modal').remove()">×</button>
      </div>
      <p style="color:#666; font-size:0.85rem; margin-bottom:16px;">
        Choose an event for the ${ids.length} selected expense(s):
      </p>
      <div class="event-assign-sheet" id="event-assign-options">
        <div class="spinner" style="margin:20px auto; display:block;"></div>
      </div>
      <input type="hidden" id="chosen-event-id" value="">
      <div style="margin-top:16px; display:flex; gap:10px;">
        <button class="btn-primary" id="btn-confirm-assign" onclick="confirmBulkAssign()" disabled>
          Assign
        </button>
        <button class="btn-secondary" style="margin-top:0;"
          onclick="document.getElementById('event-assign-sheet-modal').remove()">
          Cancel
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  await populateEventAssignOptions();
};

async function populateEventAssignOptions() {
  const container = document.getElementById('event-assign-options');
  if (!container) return;

  const events = window.events || [];
  let html = '';

  if (events.length > 0) {
    html += events.map(ev => `
      <div class="event-assign-option" data-event-id="${ev.id}" onclick="selectAssignEvent(this, ${ev.id})">
        <div class="event-assign-icon">📅</div>
        <div>
          <div class="event-assign-name">${ev.name}</div>
        </div>
      </div>
    `).join('');
  }

  html += `
    <div class="event-assign-option event-assign-new" onclick="createNewEventFromAssign()">
      <div class="event-assign-icon">+</div>
      <div>
        <div class="event-assign-name">Create New Event</div>
        <div class="event-assign-count">Add a new event and assign to it</div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

window.selectAssignEvent = function(el, eventId) {
  document.querySelectorAll('.event-assign-option').forEach(o => o.classList.remove('selected-event'));
  el.classList.add('selected-event');
  document.getElementById('chosen-event-id').value = eventId;

  const btn = document.getElementById('btn-confirm-assign');
  if (btn) btn.disabled = false;
};

window.createNewEventFromAssign = function() {
  document.getElementById('event-assign-sheet-modal')?.remove();
  _pendingAssignReopen = true;
  
  if (typeof window.openCreateEventModal === 'function') {
    window.openCreateEventModal();
  }
};

window.confirmBulkAssign = async function() {
  const eventId = document.getElementById('chosen-event-id')?.value;
  const ids = Array.from(selectedExpenseIds).map(Number);

  if (!eventId || ids.length === 0) {
    showToast('Please select an event first', 'error');
    return;
  }

  const btn = document.getElementById('btn-confirm-assign');
  if (btn) setBtnLoading(btn, true);

  try {
    await apiFetch('/expenses/bulk-assign-event', {
      method: 'PATCH',
      body: {
        expenseIds: ids,
        eventId: parseInt(eventId),
        chapterId: parseInt(window.chapterId)
      }
    });

    showToast(`${ids.length} expense(s) assigned to event ✓`, 'success');
    document.getElementById('event-assign-sheet-modal')?.remove();
    exitSelectMode();

    if (typeof window.loadExpenses === 'function') window.loadExpenses();
    if (typeof window.loadEvents === 'function') {
      await window.loadEvents();
    }

  } catch (err) {
    showToast(err.message || 'Assignment failed', 'error');
    if (btn) setBtnLoading(btn, false);
  }
};

// ─────────────────────────────────────────────────────────────
// LONG PRESS to enter select mode on expense cards
// ─────────────────────────────────────────────────────────────
function attachLongPressToExpenseCards() {
  const listEl = document.getElementById('expense-list') || document.getElementById('expense-list-container');
  if (!listEl) return;

  let pressTimer;

  listEl.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.expense-card');
    if (!card || isSelectMode) return;

    pressTimer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      enterSelectMode();
      const expenseId = card.dataset?.expenseId || '';
      if (expenseId) toggleExpenseSelection(card, expenseId);
    }, 600);
  }, { passive: true });

  listEl.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
  });

  listEl.addEventListener('touchmove', () => {
    clearTimeout(pressTimer);
  });
}

// ─────────────────────────────────────────────────────────────
// EVENT BUS WIRING (Replaces all setTimeout polling & monkey-patching)
// ─────────────────────────────────────────────────────────────

// Inject select button when chapter nav is ready
EventBus.on('chapter:loaded', injectSelectModeButton);
// Fallback for immediate execution if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSelectModeButton);
} else {
  injectSelectModeButton();
}

// Attach long press when expenses are rendered
EventBus.on('expenses:rendered', () => {
  if (!isSelectMode) {
    attachLongPressToExpenseCards();
  }
});

// Reopen assign sheet after a new event is created
EventBus.on('event:created', () => {
  if (_pendingAssignReopen) {
    _pendingAssignReopen = false;
    // Small delay to ensure events list is updated in the background
    setTimeout(() => window.openEventAssignSheet?.(), 300);
  }
});