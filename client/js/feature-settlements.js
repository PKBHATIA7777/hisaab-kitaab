/* client/js/feature-settlements.js */
/* Feature: Settlement Mark Buttons + Settled History */
/* Refactored for Phase 6: Uses EventBus instead of monkey-patching and setTimeout polling */

// ─────────────────────────────────────────────────────────────
// EVENT BUS WIRING
// ─────────────────────────────────────────────────────────────

// When chapter loads, start listening for settlement refreshes
EventBus.on('chapter:loaded', () => {
  // Inject "✓ Mark" buttons after hero settlements render
  EventBus.on('settlement:refresh', ({ settlements }) => {
    _injectMarkButtons(settlements);
  });
});

// ─────────────────────────────────────────────────────────────
// INJECT "✓ Mark" BUTTONS INTO HERO LIST
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

    const btn = document.createElement('button');
    btn.className = 'btn-mark-settled';
    btn.textContent = '✓ Mark';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window._openMarkModal(s);
    });
    row.appendChild(btn);
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
      <span style="font-size:var(--text-xs);color:rgba(255,255,255,0.5);font-weight:700;">✅ Settled (${history.length})</span>
      <span style="font-size:0.6rem;color:rgba(255,255,255,0.4);">▼</span>
    `;

    const histList = document.createElement('div');
    histList.style.display = 'none';

    toggle.addEventListener('click', () => {
      histList.style.display = histList.style.display === 'none' ? 'block' : 'none';
      toggle.querySelector('span:last-child').textContent = histList.style.display === 'none' ? '▼' : '▲';
    });

    histList.innerHTML = history.map(r => `
      <div class="settled-record-row" style="margin-bottom:8px;">
        <div class="settled-record-info">
          <div class="settled-record-names"><strong>${escapeHTML(r.from_name)}</strong> → <strong>${escapeHTML(r.to_name)}</strong></div>
          <div class="settled-record-meta">${new Date(r.marked_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}${r.note ? ' · ' + escapeHTML(r.note) : ''}</div>
        </div>
        <span class="settled-record-amount">₹${parseFloat(r.amount).toFixed(2)}</span>
        <button class="btn-undo-settle" data-record-id="${r.id}">Undo</button>
      </div>
    `).join('');

    histList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-undo-settle, .btn-undo');
      if (!btn) return;
      const confirmed = await _confirmDialog('Undo this settlement?', 'The payment will return to pending.');
      if (!confirmed) return;
      try {
        await apiFetch(`/chapters/${window.chapterId}/settlements/history/${btn.dataset.recordId}`, { method: 'DELETE' });
        showToast('Undone', 'info');
        if (typeof window.haptic === 'function') window.haptic('medium');
        window.loadExpenses();
        window.loadHeroSettlements(true);
      } catch (err) { showToast('Failed', 'error'); }
    });

    section.appendChild(toggle);
    section.appendChild(histList);
    listEl.appendChild(section);
  } catch (_) {}
}