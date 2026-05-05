/* client/js/feature-personal-chapter.js */
/* Feature 3: "My Expenses" personal chapter + cross-chapter sync */
/* Include in dashboard.html AFTER dashboard.js */
/* Include in chapter.html AFTER chapter.js */
/* <script src="js/feature-personal-chapter.js"></script> */

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let personalChapterData = null; // { id, name } or null
let syncStatusCache = {};       // { [chapterId]: { isDirty, currentConsumed, syncedConsumed, ... } }

// ─────────────────────────────────────────────────────────────
// DASHBOARD: Check for personal chapter + show banner
// ─────────────────────────────────────────────────────────────
async function checkAndRenderPersonalChapterBanner() {
  try {
    const data = await apiFetch('/chapters/personal/status');
    personalChapterData = data.chapter;

    if (!data.hasPersonalChapter) {
      renderPersonalChapterBanner();
    }
  } catch (err) {
    console.warn('Could not check personal chapter status:', err.message);
  }
}

function renderPersonalChapterBanner() {
  const grid = document.getElementById('chapters-grid');
  if (!grid) return;

  // Don't show if already present
  if (document.getElementById('personal-chapter-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'personal-chapter-banner';
  banner.className = 'personal-chapter-banner';
  banner.style.gridColumn = '1 / -1';
  banner.innerHTML = `
    <p>✨ Create your personal <strong>My Expenses</strong> chapter to track solo expenses, synced from your groups.</p>
    <button class="btn-create-personal" onclick="createPersonalChapterNow()">Create Now</button>
  `;
  grid.parentElement.insertBefore(banner, grid);
}

window.createPersonalChapterNow = async function() {
  const btn = document.querySelector('.btn-create-personal');
  if (btn) setBtnLoading(btn, true);

  try {
    const data = await apiFetch('/chapters/create-personal', { method: 'POST' });
    personalChapterData = data.chapter;
    showToast('My Expenses chapter created!', 'success');
    document.getElementById('personal-chapter-banner')?.remove();
    // Reload grid to show the new chapter
    if (typeof reloadChaptersGrid === 'function') reloadChaptersGrid();
  } catch (err) {
    showToast(err.message || 'Failed to create', 'error');
  } finally {
    if (btn) setBtnLoading(btn, false);
  }
};

// ─────────────────────────────────────────────────────────────
// DASHBOARD: Mark personal chapters with a special badge
// ─────────────────────────────────────────────────────────────
function markPersonalChaptersOnGrid() {
  if (!window.allChapters) return;

  window.allChapters.forEach(ch => {
    if (!ch.is_personal) return;
    const card = document.querySelector(`[data-chapter-id="${ch.id}"]`);
    if (!card) return;
    if (card.querySelector('.personal-chapter-badge')) return;

    const badge = document.createElement('div');
    badge.className = 'personal-chapter-badge';
    badge.textContent = 'My Expenses';
    card.appendChild(badge);

    // Also hide the delete menu item for personal chapters
    const deleteBtn = card.querySelector('.menu-item.delete');
    if (deleteBtn) deleteBtn.style.display = 'none';
  });
}

// ─────────────────────────────────────────────────────────────
// CHAPTER PAGE: Sync status check
// ─────────────────────────────────────────────────────────────
async function checkSyncStatus() {
  if (!window.chapterId || !window.currentUser) return;

  try {
    const data = await apiFetch(`/chapters/${window.chapterId}/sync-status`);
    syncStatusCache[window.chapterId] = data;
    return data;
  } catch (err) {
    console.warn('Sync status check failed:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// CHAPTER PAGE: Inject "Add to My Expenses" in summary modal
// ─────────────────────────────────────────────────────────────
function injectAddToPersonalButton(memberId, memberUserId, memberName, consumedAmount) {
  // Only show for the current user's own row
  if (!window.currentUser) return '';
  if (parseInt(memberUserId) !== parseInt(window.currentUser.id)) return '';
  if (!consumedAmount || parseFloat(consumedAmount) <= 0) return '';

  const syncData = syncStatusCache[window.chapterId];
  const hasSynced = syncData?.hasSynced;
  const isDirty = syncData?.isDirty;

  if (hasSynced) {
    return `
      <button class="btn-add-to-personal already-synced" disabled title="Already synced to My Expenses">
        ✓ Synced to My Expenses
        ${isDirty ? `<span class="sync-warning-icon" onclick="openSyncUpdateModal(event)" title="Your consumption changed. Click to update.">⚠️</span>` : ''}
      </button>
    `;
  }

  return `
    <button class="btn-add-to-personal"
      onclick="addToMyExpenses(${memberId}, ${memberUserId}, '${memberName.replace(/'/g,"\\'")}', ${consumedAmount})">
      📥 Add to My Expenses
    </button>
  `;
}

// ─────────────────────────────────────────────────────────────
// CHAPTER PAGE: Add to My Expenses flow
// ─────────────────────────────────────────────────────────────
window.addToMyExpenses = async function(memberId, memberUserId, memberName, consumedAmount) {
  // Step 1: Check for pending receivables
  try {
    let url = `/expenses/chapter/${window.chapterId}/settlements`;
    if (window.currentEventId) url += `?eventId=${window.currentEventId}`;

    const settlementData = await apiFetch(url);
    const myMemberName = (window.currentMembers || []).find(m =>
      m.user_id && parseInt(m.user_id) === parseInt(window.currentUser?.id)
    )?.member_name;

    const pendingReceivables = (settlementData.settlements || []).filter(s => s.to === myMemberName);

    if (pendingReceivables.length > 0) {
      const total = pendingReceivables.reduce((sum, s) => sum + parseFloat(s.amount), 0);
      const names = pendingReceivables.map(s => s.from).join(', ');
      const confirmed = confirm(
        `⚠️ You have ₹${total.toFixed(2)} pending to receive from: ${names}\n\n` +
        `Are you sure you want to add your consumption (₹${parseFloat(consumedAmount).toFixed(2)}) to My Expenses now?`
      );
      if (!confirmed) return;
    }
  } catch (err) {
    console.warn('Could not check settlements:', err.message);
  }

  // Step 2: Open category picker then proceed
  openCategoryPickerForSync(memberId, consumedAmount);
};

function openCategoryPickerForSync(memberId, consumedAmount) {
  // Show a quick modal to pick category (or skip)
  const existing = document.getElementById('sync-category-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'sync-category-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:380px;">
      <div class="modal-header">
        <h2 style="font-size:1.1rem;">Add to My Expenses</h2>
        <button class="close-modal" onclick="document.getElementById('sync-category-modal').remove()">×</button>
      </div>
      <p style="color:#666; font-size:0.88rem; margin-bottom:16px;">
        Adding ₹${parseFloat(consumedAmount).toFixed(2)} from <strong>${window.currentChapter?.name || 'this chapter'}</strong> to My Expenses.
      </p>
      <label style="font-size:0.82rem; color:#555; font-weight:600; margin-bottom:8px; display:block;">
        Category <span style="font-weight:400; color:#aaa;">(optional)</span>
      </label>
      <div id="sync-category-pills" class="category-pill-container" style="margin-bottom:16px;">
        <div style="color:#aaa; font-size:0.82rem;">Loading categories...</div>
      </div>
      <input type="hidden" id="sync-selected-category" value="">
      <button class="btn-primary" onclick="confirmAddToPersonal(${memberId}, ${consumedAmount})">
        Confirm
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // Load and render categories in the picker
  loadCategoriesForSyncPicker();
}

async function loadCategoriesForSyncPicker() {
  try {
    const data = await apiFetch('/categories');
    const container = document.getElementById('sync-category-pills');
    if (!container) return;

    container.innerHTML = data.categories.map(cat => `
      <button class="category-pill" style="background:${cat.color}20; border-color:${cat.color}50; color:${cat.color};"
        data-cat-id="${cat.id}"
        onclick="selectSyncCategory(this, ${cat.id})">
        ${cat.icon} ${cat.name}
      </button>
    `).join('');
  } catch (err) {
    const container = document.getElementById('sync-category-pills');
    if (container) container.innerHTML = '<span style="color:#aaa; font-size:0.82rem;">No categories found</span>';
  }
}

window.selectSyncCategory = function(btn, categoryId) {
  document.querySelectorAll('#sync-category-pills .category-pill').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  btn.style.background = btn.style.borderColor.replace('50)', '');
  btn.style.color = '#fff';
  document.getElementById('sync-selected-category').value = categoryId;
};

window.confirmAddToPersonal = async function(memberId, consumedAmount) {
  const categoryId = document.getElementById('sync-selected-category')?.value;
  const btn = document.querySelector('#sync-category-modal .btn-primary');
  if (btn) setBtnLoading(btn, true);

  try {
    await apiFetch('/chapters/personal/add-from-chapter', {
      method: 'POST',
      body: {
        sourceChapterId: window.chapterId,
        sourceMemberId: memberId,
        amount: parseFloat(consumedAmount),
        categoryId: categoryId ? parseInt(categoryId) : null,
      }
    });

    showToast('Added to My Expenses ✓', 'success');
    document.getElementById('sync-category-modal')?.remove();

    // Refresh sync status
    await checkSyncStatus();

    // Refresh summary modal if open
    const summaryModal = document.getElementById('summary-modal');
    if (summaryModal?.classList.contains('active')) {
      window.openSummaryModal?.();
    }
  } catch (err) {
    showToast(err.message || 'Failed to add to My Expenses', 'error');
    if (btn) setBtnLoading(btn, false);
  }
};

// ─────────────────────────────────────────────────────────────
// CHAPTER PAGE: Sync update modal (when isDirty)
// ─────────────────────────────────────────────────────────────
window.openSyncUpdateModal = function(e) {
  if (e) e.stopPropagation();
  const syncData = syncStatusCache[window.chapterId];
  if (!syncData) return;

  const existing = document.getElementById('sync-update-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'sync-update-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:380px;">
      <div class="modal-header">
        <h2 style="font-size:1.1rem;">⚠️ Consumption Changed</h2>
        <button class="close-modal" onclick="document.getElementById('sync-update-modal').remove()">×</button>
      </div>
      <p style="color:#666; font-size:0.88rem; margin-bottom:6px;">
        Your consumption in this chapter has changed since you last synced.
      </p>
      <div style="background:#f5f5f7; border-radius:10px; padding:12px 14px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
          <span style="color:#888;">Previously synced:</span>
          <span style="font-weight:600;">₹${parseFloat(syncData.syncedConsumed).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
          <span style="color:#888;">Current consumption:</span>
          <span style="font-weight:700; color:#d000ff;">₹${parseFloat(syncData.currentConsumed).toFixed(2)}</span>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn-primary" onclick="applySyncUpdate()">Update My Expenses</button>
        <button class="btn-secondary" onclick="dismissSyncWarning()" style="margin-top:0;">Dismiss Warning</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

window.applySyncUpdate = async function() {
  const btn = document.querySelector('#sync-update-modal .btn-primary');
  if (btn) setBtnLoading(btn, true);

  try {
    await apiFetch(`/chapters/${window.chapterId}/sync-update`, {
      method: 'PATCH',
      body: { action: 'update' }
    });

    showToast('My Expenses updated with latest amount ✓', 'success');
    document.getElementById('sync-update-modal')?.remove();

    // Refresh sync status
    syncStatusCache[window.chapterId] = await checkSyncStatus();
    window.openSummaryModal?.();
  } catch (err) {
    showToast(err.message || 'Update failed', 'error');
    if (btn) setBtnLoading(btn, false);
  }
};

window.dismissSyncWarning = async function() {
  try {
    await apiFetch(`/chapters/${window.chapterId}/sync-update`, {
      method: 'PATCH',
      body: { action: 'dismiss' }
    });
    document.getElementById('sync-update-modal')?.remove();
    showToast('Warning dismissed', 'info');
    const d = syncStatusCache[window.chapterId];
    if (d) d.isDirty = false;
  } catch (err) {
    showToast('Failed to dismiss', 'error');
  }
};

// ─────────────────────────────────────────────────────────────
// OVERRIDE: renderSummary in chapter.js to add "Add to My Expenses" button
// ─────────────────────────────────────────────────────────────
(function() {
  const tryOverride = () => {
    if (typeof window.renderSummary !== 'function') {
      setTimeout(tryOverride, 300);
      return;
    }

    const _orig = window.renderSummary;
    window.renderSummary = async function(data) {
      // Call original render first
      _orig(data);

      // Load sync status if on chapter page
      if (window.chapterId) {
        await checkSyncStatus();
      }

      // After original render, add "Add to My Expenses" button to current user's row
      addPersonalButtonsToSummary(data);
    };
  };

  if (document.getElementById('summary-modal')) {
    tryOverride();
  }
})();

function addPersonalButtonsToSummary(data) {
  if (!window.currentUser || !data || !data.summary) return;

  const summaryList = document.getElementById('summary-list');
  if (!summaryList) return;

  const myRow = data.summary.find(item =>
    item.user_id && parseInt(item.user_id) === parseInt(window.currentUser.id)
  );
  if (!myRow) return;

  const consumed = parseFloat(myRow.total_used);
  if (consumed <= 0) return;

  const btnHtml = injectAddToPersonalButton(
    myRow.member_id,
    myRow.user_id,
    myRow.member_name,
    consumed
  );
  if (!btnHtml) return;

  // Find the correct summary row and append button
  const rows = summaryList.querySelectorAll('[style*="margin-bottom"]');
  rows.forEach(rowEl => {
    const nameText = rowEl.textContent;
    if (nameText.includes(myRow.member_name)) {
      if (!rowEl.querySelector('.btn-add-to-personal')) {
        rowEl.insertAdjacentHTML('beforeend', btnHtml);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// INIT: Run on both dashboard and chapter pages
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Dashboard page
  if (document.getElementById('chapters-grid')) {
    // After existing dashboard data loads, check personal chapter
    setTimeout(async () => {
      await checkAndRenderPersonalChapterBanner();
      // Also add data-chapter-id attributes to cards for badge injection
      // (cards are rendered by dashboard.js renderGrid)
      setTimeout(markPersonalChaptersOnGrid, 300);
    }, 1000);
  }
});