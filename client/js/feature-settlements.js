/* client/js/feature-settlements.js */

// ── STATE ────────────────────────────────────────────────────
let settlementHistory = [];
let pendingSettlements = [];

// ── INIT: Hook into hero render after chapter loads ──────────
(function() {
  const tryPatch = () => {
    if (typeof window.renderHeroSettlements !== 'function') {
      setTimeout(tryPatch, 300);
      return;
    }
    const _orig = window.renderHeroSettlements;
    window.renderHeroSettlements = function(settlements) {
      pendingSettlements = settlements || [];
      _orig(settlements);
      // After hero renders, inject mark buttons
      setTimeout(injectMarkButtons, 100);
      // Also load history for the collapsed section
      loadSettlementHistory();
    };
  };
  if (document.getElementById('hero-settlement-list')) tryPatch();
})();

// ── INJECT "✓ Mark" BUTTONS INTO HERO LIST ───────────────────
function injectMarkButtons() {
  const listEl = document.getElementById('hero-settlement-list');
  if (!listEl || !pendingSettlements || pendingSettlements.length === 0) return;

  const rows = listEl.querySelectorAll('.mini-settle-item');
  rows.forEach((row, idx) => {
    if (row.querySelector('.btn-mark-settled')) return; // already injected
    const s = pendingSettlements[idx];
    if (!s) return;

    const btn = document.createElement('button');
    btn.className = 'btn-mark-settled';
    btn.textContent = '✓ Mark';
    btn.onclick = (e) => {
      e.stopPropagation();
      window._openMarkModal(s);
    };
    row.appendChild(btn);
  });

  // Append settled history toggle below the list
  injectSettledHistorySection();
}

// ── LOAD HISTORY ──────────────────────────────────────────────
async function loadSettlementHistory() {
  try {
    let url = `/chapters/${window.chapterId}/settlements/history`;
    if (window.currentEventId) url += `?eventId=${window.currentEventId}`;
    const data = await apiFetch(url);
    settlementHistory = data.history || [];
    injectSettledHistorySection();
  } catch (err) {
    console.warn('Could not load settlement history:', err.message);
  }
}

// ── INJECT HISTORY SECTION ────────────────────────────────────
function injectSettledHistorySection() {
  const listEl = document.getElementById('hero-settlement-list');
  if (!listEl) return;

  // Remove old history section
  const old = document.getElementById('settled-history-section');
  if (old) old.remove();

  if (settlementHistory.length === 0) return;

  const section = document.createElement('div');
  section.id = 'settled-history-section';

  const toggle = document.createElement('div');
  toggle.className = 'settled-history-toggle';
  toggle.innerHTML = `
    <span>✅ Settled (${settlementHistory.length})</span>
    <span class="toggle-chevron">▼</span>
  `;

  const historyList = document.createElement('div');
  historyList.className = 'settled-history-list';
  historyList.id = 'settled-history-list';

  settlementHistory.forEach(rec => {
    const row = document.createElement('div');
    row.className = 'settled-record-row';
    row.innerHTML = `
      <div class="settled-record-info">
        <div class="settled-record-names">
          <strong>${rec.from_name}</strong> → <strong>${rec.to_name}</strong>
        </div>
        <div class="settled-record-meta">${new Date(rec.marked_at).toLocaleDateString('en-IN')}</div>
      </div>
      <span class="settled-record-amount">₹${parseFloat(rec.amount).toFixed(2)}</span>
      <button class="btn-undo-settle" onclick="undoSettlementRecord(${rec.id})">Undo</button>
    `;
    historyList.appendChild(row);
  });

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open');
    historyList.classList.toggle('open');
  });

  section.appendChild(toggle);
  section.appendChild(historyList);
  listEl.appendChild(section);
}



window.undoSettlementRecord = async function(recordId) {
  if (!confirm('Undo this settlement? It will return to pending.')) return;
  try {
    await apiFetch(`/chapters/${window.chapterId}/settlements/history/${recordId}`, {
      method: 'DELETE'
    });
    showToast('Settlement undone', 'info');
    if (typeof window.loadExpenses === 'function') window.loadExpenses();
    await loadSettlementHistory();
  } catch (err) {
    showToast(err.message || 'Failed to undo', 'error');
  }
};