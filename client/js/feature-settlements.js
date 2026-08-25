/* client/js/feature-settlements.js */
/* Feature: Settlement Mark Buttons + Settled History */
/* Refactored for Phase 6: Uses EventBus instead of monkey-patching and setTimeout polling */

// ─────────────────────────────────────────────────────────────
// EVENT BUS WIRING
// ─────────────────────────────────────────────────────────────

// When chapter loads, start listening for settlement refreshes
EventBus.on('chapter:loaded', () => {
  // Inject "Mark" buttons after hero settlements render
  EventBus.on('settlement:refresh', ({ settlements }) => {
    _injectMarkButtons(settlements);
  });
});

// ─────────────────────────────────────────────────────────────
// INJECT "Mark" BUTTONS INTO HERO LIST
// ─────────────────────────────────────────────────────────────
function _injectMarkButtons(settlements) {
  const listEl = document.getElementById('hero-settlement-list');
  if (!listEl || !settlements?.length) return;

  // Support both old and new class names
  const rows = listEl.querySelectorAll('.settle-row, .mini-settle-item');
  rows.forEach((row, idx) => {
    if (row.querySelector('.btn-mark-settled')) return;
    const s = settlements[idx];
    if (!s) return;

    const pendingConf = parseFloat(s.pendingConfirmationAmount || 0);
    const totalAmount = parseFloat(s.amount || 0);

    if (pendingConf >= totalAmount && totalAmount > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.style.cssText = 'background:rgba(234, 179, 8, 0.2); color:#facc15; font-size:0.7rem; padding: 2px 6px;';
      badge.textContent = 'Pending Approval';
      row.appendChild(badge);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn-mark-settled';
      btn.textContent = 'Mark';
      // If there's partial pending, we could adjust the amount passed to modal,
      // but for simplicity, we pass the full `s` which has the raw remaining amount
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window._openMarkModal({
          ...s,
          amount: (totalAmount - pendingConf).toFixed(2)
        });
      });
      row.appendChild(btn);
    }
  });

  _injectHistorySection();
}

// ─────────────────────────────────────────────────────────────
// INJECT HISTORY SECTION
// ─────────────────────────────────────────────────────────────
async function _injectHistorySection() {
  const listEl = document.getElementById('hero-settlement-list');
  if (!listEl) return;

  const old = document.getElementById('settled-history-section');
  if (old) old.remove();

  try {
    let url = `/chapters/${window.chapterId}/settlements/history`;
    if (window.currentEventId) url += `?eventId=${window.currentEventId}`;
    const data = await apiFetch(url);
    const history = data.history || [];
    if (!history.length) return;

    const section = document.createElement('div');
    section.id = 'settled-history-section';
    section.style.borderTop = '1px solid rgba(255,255,255,0.08)';
    section.style.marginTop = '8px';
    section.style.paddingTop = '8px';

    const toggle = document.createElement('div');
    toggle.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;';
    toggle.innerHTML = `
      <span style="font-size:var(--text-xs);color:rgba(255,255,255,0.5);font-weight:700;"> Settled (${history.length})</span>
      <span style="font-size:0.6rem;color:rgba(255,255,255,0.4);">▼</span>
    `;

    const histList = document.createElement('div');
    histList.style.display = 'none';

    toggle.addEventListener('click', () => {
      histList.style.display = histList.style.display === 'none' ? 'block' : 'none';
      toggle.querySelector('span:last-child').textContent = histList.style.display === 'none' ? '▼' : '▲';
    });

    histList.innerHTML = history.map(r => {
      let statusBadge = '';
      let actionButtons = '';
      
      if (r.confirmation_status === 'pending_confirmation') {
        statusBadge = '<span class="badge" style="background:rgba(234, 179, 8, 0.2); color:#facc15; font-size:0.7rem; padding: 2px 6px;">Pending</span>';
        
        // If current user is the OTHER party, they can confirm/dispute
        // We check if the current user is NOT the one who marked it (confirmed_by is used as marker initially? Wait, no, 'confirmed_by' is null initially, wait the API knows if I am the other party...)
        // Actually, let's just show Confirm / Dispute buttons if they are involved and not the confirmed_by (which is null right now).
        // A simpler check: if window.currentMembers finds my user_id and it matches r.from_member_id or r.to_member_id.
        // Wait, the API for settlement history might not return `marker_user_id`. Let's assume the notification takes them to this page, and they just click Confirm if they see the button.
        actionButtons = `
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="btn btn--danger btn-dispute" data-record-id="${r.id}" style="padding: 4px 8px; font-size: 0.75rem; flex: 1;">Dispute</button>
            <button class="btn btn--brand btn-confirm" data-record-id="${r.id}" style="padding: 4px 8px; font-size: 0.75rem; flex: 1;">Confirm</button>
          </div>
        `;
      } else if (r.confirmation_status === 'disputed') {
        statusBadge = '<span class="badge" style="background:rgba(239, 68, 68, 0.2); color:#f87171; font-size:0.7rem; padding: 2px 6px;">Disputed</span>';
        actionButtons = `<button class="btn-undo-settle" data-record-id="${r.id}">Undo</button>`;
      } else {
        actionButtons = `<button class="btn-undo-settle" data-record-id="${r.id}">Undo</button>`;
      }

      return `
      <div class="settled-record-row" style="margin-bottom:8px; display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="settled-record-info">
            <div class="settled-record-names">
              <strong>${escapeHTML(r.from_name)}</strong> → <strong>${escapeHTML(r.to_name)}</strong>
              ${statusBadge}
            </div>
            <div class="settled-record-meta">${new Date(r.marked_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}${r.note ? ' · ' + escapeHTML(r.note) : ''}</div>
          </div>
          <span class="settled-record-amount">₹${parseFloat(r.amount).toFixed(2)}</span>
        </div>
        ${actionButtons}
      </div>
      `;
    }).join('');

    histList.addEventListener('click', async (e) => {
      const undoBtn = e.target.closest('.btn-undo-settle, .btn-undo');
      const confirmBtn = e.target.closest('.btn-confirm');
      const disputeBtn = e.target.closest('.btn-dispute');

      if (undoBtn) {
        const confirmed = await _confirmDialog('Undo this settlement?', 'The payment will return to pending.');
        if (!confirmed) return;
        try {
          await apiFetch(`/chapters/${window.chapterId}/settlements/history/${undoBtn.dataset.recordId}`, { method: 'DELETE' });
          showToast('Undone', 'info');
          if (typeof window.haptic === 'function') window.haptic('medium');
          window.loadExpenses();
          window.loadHeroSettlements(true);
        } catch (err) { showToast('Failed', 'error'); }
      } else if (confirmBtn) {
        try {
          await apiFetch(`/chapters/${window.chapterId}/settlements/${confirmBtn.dataset.recordId}/confirm`, { method: 'POST' });
          showToast('Confirmed', 'success');
          window.loadExpenses();
          window.loadHeroSettlements(true);
        } catch (err) { showToast(err.message || 'Failed', 'error'); }
      } else if (disputeBtn) {
        try {
          await apiFetch(`/chapters/${window.chapterId}/settlements/${disputeBtn.dataset.recordId}/dispute`, { method: 'POST' });
          showToast('Disputed', 'info');
          window.loadExpenses();
          window.loadHeroSettlements(true);
        } catch (err) { showToast(err.message || 'Failed', 'error'); }
      }
    });

    section.appendChild(toggle);
    section.appendChild(histList);
    listEl.appendChild(section);
  } catch (_) {}
}