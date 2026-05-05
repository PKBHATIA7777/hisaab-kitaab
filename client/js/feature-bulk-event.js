/* client/js/feature-bulk-event.js */
/* Feature 5: Multi-select expenses + bulk assign to event */
/* Include in chapter.html AFTER chapter.js */
/* <script src="js/feature-bulk-event.js"></script> */

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let isSelectMode = false;
let selectedExpenseIds = new Set();

// ─────────────────────────────────────────────────────────────
// INJECT "Select" option into chapter nav dropdown
// ─────────────────────────────────────────────────────────────
function injectSelectModeButton() {
  const dropdown = document.getElementById('chapter-menu-dropdown');
  if (!dropdown) return;
  if (document.getElementById('select-mode-btn')) return;

  const hr = dropdown.querySelector('hr');
  const btn = document.createElement('button');
  btn.id = 'select-mode-btn';
  btn.type = 'button';
  btn.innerHTML = '<span>☑️</span> Select Expenses';
  btn.onclick = () => {
    document.getElementById('chapter-menu-dropdown').classList.remove('active');
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
  const fab = document.querySelector('.fab-btn');
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
  const fab = document.querySelector('.fab-btn');
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
// RENDER EXPENSES IN SELECT MODE
// ─────────────────────────────────────────────────────────────
function renderExpensesInSelectMode() {
  const listEl = document.getElementById('expense-list-container');
  if (!listEl || !window.expenses) return;

  listEl.innerHTML = '';

  if (window.expenses.length === 0) {
    listEl.innerHTML = '<div style="text-align:center; padding:30px; color:rgba(255,255,255,0.5);">No expenses to select.</div>';
    return;
  }

  window.expenses.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'expense-card selectable';
    card.dataset.expenseId = ex.id;

    card.innerHTML = `
      <div class="expense-select-check" id="check-${ex.id}"></div>
      <div class="expense-info">
        <h4>${ex.description || 'Untitled Expense'}</h4>
        <p>paid by <strong>${ex.payer_name || 'Unknown'}</strong> · ${timeAgo(ex.expense_date)}</p>
        ${ex.event_id ? `<span style="font-size:0.7rem; color:#d000ff; font-weight:600;">📌 In event</span>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="expense-amount">₹${ex.amount}</div>
      </div>
    `;

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

  if (!confirm(`Remove ${ids.length} expense(s) from their current event?`)) return;

  try {
    await apiFetch('/expenses/bulk-assign-event', {
      method: 'PATCH',
      body: { expenseIds: ids, eventId: null, chapterId: parseInt(window.chapterId) }
    });

    showToast(`${ids.length} expense(s) removed from event`, 'success');
    exitSelectMode();

    // Refresh expenses
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

  // Check if any selected expenses are already in an event
  if (window.expenses) {
    const selectedExpenses = window.expenses.filter(ex => selectedExpenseIds.has(String(ex.id)));
    const inOtherEvent = selectedExpenses.filter(ex => ex.event_id && ex.event_id !== window.currentEventId);
    if (inOtherEvent.length > 0) {
      const uniqueEventIds = [...new Set(inOtherEvent.map(e => e.event_id))];
      const confirmed = confirm(
        `${inOtherEvent.length} of the selected expenses are already in another event.\n\n` +
        `Moving them will remove them from their current event. Continue?`
      );
      if (!confirmed) return;
    }
  }

  // Build and show sheet
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

  // Load events
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

  // "Create New Event" option
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
  // Deselect all
  document.querySelectorAll('.event-assign-option').forEach(o => o.classList.remove('selected-event'));
  el.classList.add('selected-event');
  document.getElementById('chosen-event-id').value = eventId;

  // Enable confirm button
  const btn = document.getElementById('btn-confirm-assign');
  if (btn) btn.disabled = false;
};

window.createNewEventFromAssign = function() {
  // Close assign sheet
  document.getElementById('event-assign-sheet-modal')?.remove();

  // Open the existing create event modal
  if (typeof window.openCreateEventModal === 'function') {
    window.openCreateEventModal();

    // After event is created, reopen assign sheet
    // We watch for new events by hooking the create event form submit
    hookCreateEventForAssign();
  }
};

function hookCreateEventForAssign() {
  const form = document.getElementById('create-event-form');
  if (!form) return;

  const _origSubmit = form.onsubmit;
  form.onsubmit = async function(e) {
    // Call original
    await _origSubmit.call(this, e);

    // After creation, reload events and reopen assign sheet
    setTimeout(async () => {
      await window.loadEvents?.();
      window.openEventAssignSheet?.();
    }, 500);

    // Restore original
    form.onsubmit = _origSubmit;
  };
}

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

    // Reload expenses and events
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
  const listEl = document.getElementById('expense-list-container');
  if (!listEl) return;

  let pressTimer;

  listEl.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.expense-card');
    if (!card || isSelectMode) return;

    pressTimer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      enterSelectMode();
      // Select the long-pressed card
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
// PATCH renderExpenses to attach long press after render
// ─────────────────────────────────────────────────────────────
(function() {
  const tryPatch = () => {
    if (typeof window.renderExpenses !== 'function') {
      setTimeout(tryPatch, 300);
      return;
    }

    const _orig = window.renderExpenses;
    window.renderExpenses = function() {
      _orig();
      if (!isSelectMode) {
        // Attach long press to new cards
        attachLongPressToExpenseCards();
      }
    };
  };

  if (document.getElementById('expense-list-container')) {
    tryPatch();
  }
})();

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('chapter-menu-dropdown')) {
    // Inject "Select Expenses" option into the chapter dropdown
    // Wait for chapter.js to finish setting up the dropdown
    setTimeout(injectSelectModeButton, 300);
  }
});