/* client/js/feature-categories.js */
/* Feature 4: Expense Categories + Monthly View in My Expenses */
/* FIX v2:
   - Category ID now injected via window.getSelectedCategoryId() called from chapter.js submit patch
   - /categories/monthly route fixed (was hitting /:id due to route order bug)
   - Personal view tabs only shown on is_personal chapters
   - selectCategoryPill toggle-off fixed
   - Profile section injection timing fixed
*/

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────
let allCategories = [];
let selectedCategoryId = null;

// ─────────────────────────────────────────────────────────────
// LOAD CATEGORIES FROM API
// ─────────────────────────────────────────────────────────────
async function loadCategories() {
  try {
    const data = await apiFetch('/categories');
    allCategories = data.categories || [];
    return allCategories;
  } catch (err) {
    console.warn('Failed to load categories:', err.message);
    allCategories = [];
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER CATEGORY PILL SELECTOR (for expense modal)
// ─────────────────────────────────────────────────────────────
function renderCategoryPills(containerId, currentCategoryId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  selectedCategoryId = currentCategoryId || null;

  if (allCategories.length === 0) {
    container.innerHTML = '<span style="color:#aaa; font-size:0.8rem;">No categories</span>';
    return;
  }

  container.innerHTML = allCategories.map(cat => {
    const isSelected = cat.id === selectedCategoryId;
    const bg = isSelected ? cat.color : `${cat.color}22`;
    const border = isSelected ? cat.color : `${cat.color}55`;
    const color = isSelected ? '#fff' : cat.color;

    return `
      <button class="category-pill ${isSelected ? 'selected' : ''}"
        data-cat-id="${cat.id}"
        data-cat-color="${cat.color}"
        style="background:${bg}; border-color:${border}; color:${color};"
        onclick="selectCategoryPill(this, ${cat.id}, '${cat.color}')">
        ${cat.icon} ${cat.name}
      </button>
    `;
  }).join('');
}

window.selectCategoryPill = function(btn, categoryId, color) {
  const container = btn.closest('.category-pill-container');
  if (!container) return;

  // Deselect all
  container.querySelectorAll('.category-pill').forEach(b => {
    const c = b.dataset.catColor || '#888';
    b.classList.remove('selected');
    b.style.background = `${c}22`;
    b.style.borderColor = `${c}55`;
    b.style.color = c;
  });

  // Toggle off if same category clicked again
  if (selectedCategoryId === categoryId) {
    selectedCategoryId = null;
    return;
  }

  // Select clicked
  btn.classList.add('selected');
  btn.style.background = color;
  btn.style.borderColor = color;
  btn.style.color = '#fff';
  selectedCategoryId = categoryId;
};

// ─────────────────────────────────────────────────────────────
// INJECT CATEGORY ROW INTO EXPENSE MODAL
// ─────────────────────────────────────────────────────────────
async function injectCategoryRowInExpenseModal(currentCategoryId) {
  const form = document.getElementById('add-expense-form');
  if (!form) return;

  // Remove existing row
  const existing = document.getElementById('expense-category-row');
  if (existing) existing.remove();

  if (allCategories.length === 0) {
    await loadCategories();
  }

  // Find insertion point — before the Paid By label
  const allLabels = form.querySelectorAll('label');
  let insertBefore = null;
  for (const lbl of allLabels) {
    if (lbl.textContent.trim().startsWith('Paid By')) {
      insertBefore = lbl;
      break;
    }
  }

  const row = document.createElement('div');
  row.id = 'expense-category-row';
  row.style.marginTop = '15px';
  row.innerHTML = `
    <div style="font-size:0.85rem; color:#333; font-weight:600; margin-bottom:8px; margin-left:5px;">
      Category <span style="font-weight:400; color:#aaa;">(optional)</span>
    </div>
    <div id="expense-category-pills" class="category-pill-container"></div>
  `;

  if (insertBefore) {
    form.insertBefore(row, insertBefore);
  } else {
    // Fallback: insert before submit button area
    const submitDiv = form.querySelector('div[style*="margin-top:25px"]');
    if (submitDiv) form.insertBefore(row, submitDiv);
    else form.appendChild(row);
  }

  renderCategoryPills('expense-category-pills', currentCategoryId);
}

// ─────────────────────────────────────────────────────────────
// GLOBAL: get current selected category (called by chapter.js submit patch)
// ─────────────────────────────────────────────────────────────
window.getSelectedCategoryId = function() {
  return selectedCategoryId;
};

// ─────────────────────────────────────────────────────────────
// PATCH openAddExpenseModal and openEditExpenseModal
// ─────────────────────────────────────────────────────────────
(function() {
  const tryPatch = () => {
    if (typeof window.openAddExpenseModal !== 'function') {
      setTimeout(tryPatch, 200);
      return;
    }

    const _origOpen = window.openAddExpenseModal;
    window.openAddExpenseModal = async function() {
      _origOpen();
      selectedCategoryId = null;
      await injectCategoryRowInExpenseModal(null);
    };

    const _origEdit = window.openEditExpenseModal;
    if (typeof _origEdit === 'function') {
      window.openEditExpenseModal = async function(id) {
        await _origEdit(id);
        // Get expense category after modal opens
        try {
          const data = await apiFetch(`/expenses/${id}`);
          const catId = data.expense?.category_id || null;
          selectedCategoryId = catId;
          await injectCategoryRowInExpenseModal(catId);
        } catch (err) {
          await injectCategoryRowInExpenseModal(null);
        }
      };
    }
  };

  if (document.getElementById('add-expense-modal')) {
    tryPatch();
  }
})();

// ─────────────────────────────────────────────────────────────
// PATCH addExpenseForm submit — inject categoryId into payload
// ─────────────────────────────────────────────────────────────
// NOTE: chapter.js builds payload manually, NOT from FormData.
// We use a capture-phase listener to set window._pendingCategoryId
// and then patch the apiFetch call via a submit interceptor.
(function() {
  const tryPatch = () => {
    const form = document.getElementById('add-expense-form');
    if (!form) return;

    // Capture phase: runs before chapter.js submit handler
    form.addEventListener('submit', () => {
      // Store currently selected category so chapter.js submit can read it
      window._pendingCategoryId = selectedCategoryId || null;
    }, true);
  };

  if (document.getElementById('add-expense-form')) {
    tryPatch();
  }
})();

// ─────────────────────────────────────────────────────────────
// PATCH chapter.js apiFetch calls for expenses to include categoryId
// We wrap the global apiFetch to intercept expense POST/PUT calls
// ─────────────────────────────────────────────────────────────
(function() {
  const tryPatch = () => {
    if (typeof window.apiFetch !== 'function') {
      setTimeout(tryPatch, 200);
      return;
    }

    const _origApiFetch = window.apiFetch;
    window.apiFetch = async function(path, options = {}) {
      // Intercept expense add/update to inject categoryId
      if (
        (path === '/expenses' && options.method === 'POST') ||
        (typeof path === 'string' && path.startsWith('/expenses/') && options.method === 'PUT')
      ) {
        if (options.body && typeof options.body === 'object' && window._pendingCategoryId !== undefined) {
          options.body.categoryId = window._pendingCategoryId;
          window._pendingCategoryId = undefined; // Clear after use
        }
      }
      return _origApiFetch.call(this, path, options);
    };
  };

  // Run after DOMContentLoaded to ensure apiFetch exists
  document.addEventListener('DOMContentLoaded', tryPatch);
  // Also try immediately in case it's already defined
  if (typeof window.apiFetch === 'function') tryPatch();
})();

// ─────────────────────────────────────────────────────────────
// EXPENSE CARD: Show category badge on each expense
// ─────────────────────────────────────────────────────────────
function addCategoryBadgeToExpenseCard(card, expense) {
  if (!expense || !expense.category_name) return;
  if (expense.category_name === 'Other') return;
  if (card.querySelector('.expense-category-badge')) return;

  const badge = document.createElement('div');
  badge.className = 'expense-category-badge';
  badge.style.cssText = `
    display:inline-flex; align-items:center; gap:3px;
    background:${expense.category_color || '#88888822'};
    color:${expense.category_color || '#888'};
    border:1px solid ${expense.category_color || '#888'}44;
    border-radius:5px; padding:2px 7px;
    font-size:0.68rem; font-weight:600;
    margin-top:3px;
  `;
  badge.innerHTML = `${expense.category_icon || '📦'} ${expense.category_name}`;

  const infoEl = card.querySelector('.expense-info p');
  if (infoEl) infoEl.insertAdjacentElement('afterend', badge);
}

// ─────────────────────────────────────────────────────────────
// PATCH renderExpenses to add category badges
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

      const expenseListEl = document.getElementById('expense-list-container');
      if (!expenseListEl || !window.expenses) return;

      const cards = expenseListEl.querySelectorAll('.expense-card');
      cards.forEach((card, idx) => {
        const expense = window.expenses[idx];
        if (expense) addCategoryBadgeToExpenseCard(card, expense);
      });
    };
  };

  if (document.getElementById('expense-list-container')) {
    tryPatch();
  }
})();

// ─────────────────────────────────────────────────────────────
// MY EXPENSES: Monthly + Category view
// ─────────────────────────────────────────────────────────────

let personalViewMode = 'list';
let personalMonthlyData = null;

async function loadPersonalMonthlyData() {
  try {
    // NOTE: route is GET /api/categories/monthly (fixed route order on server)
    const data = await apiFetch('/categories/monthly');
    personalMonthlyData = data;
    return data;
  } catch (err) {
    console.warn('Failed to load monthly data:', err.message);
    return null;
  }
}

function injectPersonalViewTabs() {
  if (document.getElementById('personal-view-tabs')) return;

  const expenseList = document.getElementById('expense-list-container');
  if (!expenseList) return;

  const tabs = document.createElement('div');
  tabs.id = 'personal-view-tabs';
  tabs.className = 'personal-view-tabs';
  tabs.innerHTML = `
    <button class="personal-tab-btn active" data-mode="list" onclick="switchPersonalView('list', this)">
      📋 All
    </button>
    <button class="personal-tab-btn" data-mode="monthly" onclick="switchPersonalView('monthly', this)">
      📅 By Month
    </button>
    <button class="personal-tab-btn" data-mode="category" onclick="switchPersonalView('category', this)">
      🏷️ By Category
    </button>
  `;
  expenseList.parentElement.insertBefore(tabs, expenseList);
}

window.switchPersonalView = async function(mode, btn) {
  personalViewMode = mode;

  document.querySelectorAll('.personal-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const listEl = document.getElementById('expense-list-container');
  const personalViewEl = document.getElementById('personal-view-content');

  if (mode === 'list') {
    if (listEl) listEl.style.display = '';
    if (personalViewEl) personalViewEl.style.display = 'none';
    return;
  }

  if (listEl) listEl.style.display = 'none';

  let viewEl = personalViewEl;
  if (!viewEl) {
    viewEl = document.createElement('div');
    viewEl.id = 'personal-view-content';
    viewEl.style.paddingBottom = '80px';
    listEl.parentElement.insertBefore(viewEl, listEl.nextSibling);
  }
  viewEl.style.display = '';
  viewEl.innerHTML = '<div class="spinner" style="margin:40px auto; display:block;"></div>';

  if (!personalMonthlyData) {
    await loadPersonalMonthlyData();
  }

  if (mode === 'monthly') {
    renderMonthlyView(viewEl);
  } else if (mode === 'category') {
    renderCategoryView(viewEl);
  }
};

function renderMonthlyView(container) {
  if (!personalMonthlyData || !personalMonthlyData.months || !personalMonthlyData.months.length) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:rgba(255,255,255,0.5);">
        <div style="font-size:2.5rem; margin-bottom:10px;">📅</div>
        <p>No expenses yet.</p>
      </div>
    `;
    return;
  }

  const expensesByMonth = {};
  (personalMonthlyData.expenses || []).forEach(ex => {
    if (!expensesByMonth[ex.month]) expensesByMonth[ex.month] = [];
    expensesByMonth[ex.month].push(ex);
  });

  const html = personalMonthlyData.months.map(m => {
    const monthExpenses = expensesByMonth[m.month] || [];
    const expenseRows = monthExpenses.map(ex => `
      <div class="expense-card" style="margin:0; border-radius:0; border-bottom:1px solid #f5f5f5; box-shadow:none;">
        <div class="expense-info">
          <h4>${ex.description || 'Expense'}</h4>
          <p>
            ${ex.category_icon || '📦'} ${ex.category_name || 'Other'}
            ${ex.is_synced_from_chapter ? `<span class="synced-expense-tag">🔗 ${ex.source_chapter_name || 'Synced'}</span>` : ''}
          </p>
        </div>
        <div style="text-align:right;">
          <div class="expense-amount">₹${parseFloat(ex.amount).toFixed(2)}</div>
          <div style="font-size:0.7rem; color:#aaa;">${new Date(ex.expense_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="month-group">
        <div class="month-group-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='none' ? '' : 'none'">
          <h4>${m.month_label}</h4>
          <div>
            <span style="font-size:0.75rem; color:#aaa; margin-right:8px;">${m.expense_count} expense${m.expense_count !== 1 ? 's' : ''}</span>
            <span class="month-group-total">₹${parseFloat(m.total).toFixed(2)}</span>
          </div>
        </div>
        <div class="month-group-body">${expenseRows}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function renderCategoryView(container) {
  if (!personalMonthlyData || !personalMonthlyData.categories || !personalMonthlyData.categories.length) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:rgba(255,255,255,0.5);">
        <div style="font-size:2.5rem; margin-bottom:10px;">🏷️</div>
        <p>No categorised expenses yet.</p>
      </div>
    `;
    return;
  }

  const grandTotal = personalMonthlyData.categories.reduce((sum, c) => sum + parseFloat(c.total), 0);

  const rows = personalMonthlyData.categories.map(cat => {
    const pct = grandTotal > 0 ? ((parseFloat(cat.total) / grandTotal) * 100).toFixed(1) : 0;
    return `
      <div class="category-breakdown-row">
        <div class="category-dot" style="background:${cat.category_color};"></div>
        <span class="category-label">${cat.category_icon} ${cat.category_name}</span>
        <span class="category-amount">₹${parseFloat(cat.total).toFixed(2)}</span>
        <span class="category-pct">${pct}%</span>
      </div>
      <div style="margin:0 16px 8px; background:#f0f0f0; border-radius:3px; height:5px; overflow:hidden;">
        <div style="width:${pct}%; height:100%; background:${cat.category_color}; border-radius:3px;"></div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="background:rgba(255,255,255,0.95); border-radius:16px; overflow:hidden; box-shadow:0 3px 12px rgba(0,0,0,0.08);">
      <div style="padding:14px 16px; background:#f5f5f7; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700; color:#333; font-size:0.9rem;">Total Spent</span>
        <span style="font-weight:700; color:#d000ff; font-size:1.1rem;">₹${grandTotal.toFixed(2)}</span>
      </div>
      ${rows}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// PROFILE: Category management section
// ─────────────────────────────────────────────────────────────

function injectCategorySectionInProfile() {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) return;
  if (document.getElementById('profile-categories-section')) return;

  // Find the Account section title
  const sectionTitles = profileModal.querySelectorAll('.profile-section-title');
  let accountTitle = null;
  sectionTitles.forEach(el => {
    if (el.textContent.includes('Account')) accountTitle = el;
  });
  if (!accountTitle) return;

  const section = document.createElement('div');
  section.id = 'profile-categories-section';
  section.innerHTML = `
    <div class="profile-section-title">
      <span>My Categories</span>
      <button class="btn-small" onclick="openAddCategoryForm()"
        style="background:#f0f0f0; font-size:0.75rem; padding:4px 10px; border-radius:6px; border:none; cursor:pointer; font-family:var(--font-main); font-weight:600;">
        + Add
      </button>
    </div>
    <div id="profile-categories-list" style="margin-bottom:20px;">
      <div style="text-align:center; padding:10px; color:#aaa; font-size:0.85rem;">Loading...</div>
    </div>
    <div id="category-form-container" style="display:none;"></div>
  `;

  accountTitle.parentElement.insertBefore(section, accountTitle);
}

async function loadAndRenderProfileCategories() {
  const listEl = document.getElementById('profile-categories-list');
  if (!listEl) return;

  await loadCategories();

  if (allCategories.length === 0) {
    listEl.innerHTML = '<div style="color:#aaa; font-size:0.85rem; text-align:center; padding:10px;">No categories yet.</div>';
    return;
  }

  listEl.innerHTML = allCategories.map(cat => `
    <div class="category-list-item" data-cat-id="${cat.id}">
      <div class="category-icon-bubble" style="background:${cat.color}22;">
        <span style="font-size:1rem;">${cat.icon}</span>
      </div>
      <span class="category-list-name">${cat.name}</span>
      ${cat.is_system
        ? '<span class="category-system-badge">Built-in</span>'
        : `
          <button class="btn-edit-category" onclick="openEditCategoryForm(${cat.id})" title="Edit">✏️</button>
          <button class="btn-delete-category" onclick="deleteCategoryById(${cat.id}, '${cat.name.replace(/'/g, "\\'")}')">🗑️</button>
        `
      }
    </div>
  `).join('');
}

window.openAddCategoryForm = function() {
  renderCategoryForm(null);
};

window.openEditCategoryForm = function(id) {
  const cat = allCategories.find(c => c.id === id);
  if (cat) renderCategoryForm(cat);
};

const PRESET_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#F9CA24','#F0932B',
  '#6C5CE7','#A29BFE','#00B894','#E17055','#D63031',
  '#74B9FF','#55EFC4','#FDCB6E','#E84393','#636E72'
];

function renderCategoryForm(cat) {
  const container = document.getElementById('category-form-container');
  if (!container) return;

  const isEdit = !!cat;
  const currentColor = cat?.color || '#888888';
  const currentIcon = cat?.icon || '📦';

  container.style.display = 'block';
  container.innerHTML = `
    <div style="background:#f9f9f9; border-radius:12px; padding:16px; border:1px solid #eee; margin-bottom:14px;">
      <h4 style="margin:0 0 14px 0; font-size:0.95rem; color:#333;">${isEdit ? 'Edit Category' : 'New Category'}</h4>

      <label style="font-size:0.8rem; font-weight:600; color:#555; display:block; margin-bottom:4px;">Name *</label>
      <input type="text" id="cat-name-input" value="${cat?.name || ''}"
        placeholder="e.g. Groceries"
        style="width:100%; margin-bottom:12px; padding:8px 12px; border-radius:8px; border:1.5px solid #eee; font-family:var(--font-main); font-size:0.9rem; box-sizing:border-box;">

      <label style="font-size:0.8rem; font-weight:600; color:#555; display:block; margin-bottom:4px;">Icon (emoji)</label>
      <input type="text" id="cat-icon-input" value="${currentIcon}"
        placeholder="📦"
        style="width:80px; margin-bottom:12px; padding:8px 12px; border-radius:8px; border:1.5px solid #eee; font-family:var(--font-main); font-size:1.1rem; text-align:center;">

      <label style="font-size:0.8rem; font-weight:600; color:#555; display:block; margin-bottom:6px;">Color</label>
      <div class="color-swatches" id="cat-color-swatches">
        ${PRESET_COLORS.map(c => `
          <div class="color-swatch ${c === currentColor ? 'selected' : ''}"
            style="background:${c};"
            data-color="${c}"
            onclick="selectColorSwatch(this, '${c}')">
          </div>
        `).join('')}
      </div>
      <input type="hidden" id="cat-color-value" value="${currentColor}">

      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn-primary" style="flex:1; padding:10px;"
          onclick="saveCategoryForm(${isEdit ? cat.id : 'null'})">
          ${isEdit ? 'Save Changes' : 'Create'}
        </button>
        <button class="btn-secondary" style="flex:1; padding:10px; margin-top:0;"
          onclick="closeCategoryForm()">
          Cancel
        </button>
      </div>
    </div>
  `;
}

window.selectColorSwatch = function(el, color) {
  document.querySelectorAll('#cat-color-swatches .color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('cat-color-value').value = color;
};

window.closeCategoryForm = function() {
  const container = document.getElementById('category-form-container');
  if (container) { container.style.display = 'none'; container.innerHTML = ''; }
};

window.saveCategoryForm = async function(editId) {
  const name = document.getElementById('cat-name-input')?.value?.trim();
  const icon = document.getElementById('cat-icon-input')?.value?.trim() || '📦';
  const color = document.getElementById('cat-color-value')?.value || '#888888';

  if (!name) { showToast('Category name is required', 'error'); return; }

  const btn = document.querySelector('#category-form-container .btn-primary');
  if (btn) setBtnLoading(btn, true);

  try {
    if (editId && editId !== 'null') {
      await apiFetch(`/categories/${editId}`, { method: 'PUT', body: { name, icon, color } });
      showToast('Category updated', 'success');
    } else {
      await apiFetch('/categories', { method: 'POST', body: { name, icon, color } });
      showToast('Category created', 'success');
    }
    closeCategoryForm();
    await loadAndRenderProfileCategories();
  } catch (err) {
    showToast(err.message || 'Failed to save category', 'error');
    if (btn) setBtnLoading(btn, false);
  }
};

window.deleteCategoryById = async function(id, name) {
  if (!confirm(`Delete category "${name}"? Expenses using it will become uncategorised.`)) return;

  try {
    await apiFetch(`/categories/${id}`, { method: 'DELETE' });
    showToast('Category deleted', 'info');
    await loadAndRenderProfileCategories();
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'error');
  }
};

// ─────────────────────────────────────────────────────────────
// HOOK: openProfileModal — inject category section
// ─────────────────────────────────────────────────────────────
(function() {
  const tryPatch = () => {
    if (typeof window.openProfileModal !== 'function') {
      setTimeout(tryPatch, 300);
      return;
    }

    const _orig = window.openProfileModal;
    window.openProfileModal = function() {
      _orig();
      setTimeout(() => {
        injectCategorySectionInProfile();
        loadAndRenderProfileCategories();
      }, 150);
    };
  };

  if (document.getElementById('profile-modal')) tryPatch();
})();

// ─────────────────────────────────────────────────────────────
// HOOK: inject personal view tabs only on personal chapters
// ─────────────────────────────────────────────────────────────
(function() {
  if (!document.getElementById('expense-list-container')) return;

  const waitForChapter = setInterval(() => {
    if (!window.currentChapter) return;
    clearInterval(waitForChapter);

    if (window.currentChapter.is_personal) {
      injectPersonalViewTabs();
      loadPersonalMonthlyData();
    }
  }, 400);
})();

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('add-expense-modal')) {
    loadCategories();
  }
});