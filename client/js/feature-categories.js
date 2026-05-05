/* client/js/feature-categories.js */
/* Feature 4: Expense Categories + Monthly View in My Expenses */
/* Include in chapter.html and dashboard.html AFTER their respective JS files */
/* <script src="js/feature-categories.js"></script> */

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
        style="background:${bg}; border-color:${border}; color:${color};"
        onclick="selectCategoryPill(this, ${cat.id}, '${cat.color}')">
        ${cat.icon} ${cat.name}
      </button>
    `;
  }).join('');
}

window.selectCategoryPill = function(btn, categoryId, color) {
  // Deselect all
  const container = btn.closest('.category-pill-container');
  if (!container) return;
  container.querySelectorAll('.category-pill').forEach(b => {
    const c = b.dataset.color || color;
    b.classList.remove('selected');
    b.style.background = `${c}22`;
    b.style.borderColor = `${c}55`;
    b.style.color = c;
  });

  // Select clicked
  if (selectedCategoryId === categoryId) {
    // Toggle off if same
    selectedCategoryId = null;
    return;
  }
  btn.classList.add('selected');
  btn.style.background = color;
  btn.style.borderColor = color;
  btn.style.color = '#fff';
  selectedCategoryId = categoryId;
};

// ─────────────────────────────────────────────────────────────
// INJECT CATEGORY ROW INTO EXPENSE MODAL
// Called after expense modal opens
// ─────────────────────────────────────────────────────────────
async function injectCategoryRowInExpenseModal(currentCategoryId) {
  const form = document.getElementById('add-expense-form');
  if (!form) return;

  // Remove any existing category row
  const existing = document.getElementById('expense-category-row');
  if (existing) existing.remove();

  // Ensure categories are loaded
  if (allCategories.length === 0) {
    await loadCategories();
  }

  // Insert before the payer label (after description)
  const payerLabel = form.querySelector('label[style*="margin-top:15px"]')
    || form.querySelector('label:nth-of-type(2)');

  const row = document.createElement('div');
  row.id = 'expense-category-row';
  row.style.marginTop = '15px';
  row.innerHTML = `
    <div style="font-size:0.85rem; color:#333; font-weight:600; margin-bottom:8px; margin-left:5px;">
      Category <span style="font-weight:400; color:#aaa;">(optional)</span>
    </div>
    <div id="expense-category-pills" class="category-pill-container"></div>
  `;

  // Store color data on each pill button after render
  if (payerLabel) {
    form.insertBefore(row, payerLabel);
  } else {
    // Fallback: append before submit button
    const submitDiv = form.querySelector('div[style*="margin-top:25px"]');
    if (submitDiv) form.insertBefore(row, submitDiv);
    else form.appendChild(row);
  }

  // Store color on each pill for toggle logic
  renderCategoryPills('expense-category-pills', currentCategoryId);

  // Store color on each pill element for toggle deselect
  document.querySelectorAll('#expense-category-pills .category-pill').forEach(btn => {
    const cat = allCategories.find(c => c.id === parseInt(btn.dataset.catId));
    if (cat) btn.dataset.color = cat.color;
  });
}

// ─────────────────────────────────────────────────────────────
// GET SELECTED CATEGORY ID (called during form submit)
// ─────────────────────────────────────────────────────────────
window.getSelectedCategoryId = function() {
  return selectedCategoryId;
};

// ─────────────────────────────────────────────────────────────
// PATCH expense modal open/close to inject category row
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
    window.openEditExpenseModal = async function(id) {
      await _origEdit(id);
      // After edit modal opens, get the expense's category
      try {
        const data = await apiFetch(`/expenses/${id}`);
        const catId = data.expense?.category_id || null;
        selectedCategoryId = catId;
        await injectCategoryRowInExpenseModal(catId);
      } catch (err) {
        await injectCategoryRowInExpenseModal(null);
      }
    };
  };

  if (document.getElementById('add-expense-modal')) {
    tryPatch();
  }
})();

// ─────────────────────────────────────────────────────────────
// PATCH addExpenseForm submit to include categoryId
// ─────────────────────────────────────────────────────────────
(function() {
  const tryPatch = () => {
    const form = document.getElementById('add-expense-form');
    if (!form) return;

    // We intercept via a capture-phase listener that runs BEFORE chapter.js submit
    form.addEventListener('submit', (e) => {
      // We don't prevent default — just inject categoryId into the payload
      // chapter.js reads from form fields; we add a hidden input
      let hiddenCat = form.querySelector('input[name="categoryId"]');
      if (!hiddenCat) {
        hiddenCat = document.createElement('input');
        hiddenCat.type = 'hidden';
        hiddenCat.name = 'categoryId';
        form.appendChild(hiddenCat);
      }
      hiddenCat.value = selectedCategoryId || '';
    }, true); // capture phase
  };

  if (document.getElementById('add-expense-form')) {
    tryPatch();
  }
})();

// ─────────────────────────────────────────────────────────────
// EXPENSE CARD: Show category badge on each expense
// ─────────────────────────────────────────────────────────────
function addCategoryBadgeToExpenseCard(card, expense) {
  if (!expense.category_name || expense.category_name === 'Other') return;
  if (card.querySelector('.expense-category-badge')) return;

  const badge = document.createElement('div');
  badge.className = 'expense-category-badge';
  badge.style.cssText = `
    display:inline-flex; align-items:center; gap:3px;
    background:${expense.category_color}22;
    color:${expense.category_color};
    border:1px solid ${expense.category_color}44;
    border-radius:5px; padding:1px 7px;
    font-size:0.68rem; font-weight:600;
    margin-top:3px;
  `;
  badge.innerHTML = `${expense.category_icon} ${expense.category_name}`;

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

      // After render, add category badges
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

let personalViewMode = 'list'; // 'list' | 'monthly' | 'category'
let personalMonthlyData = null;

async function loadPersonalMonthlyData() {
  try {
    const data = await apiFetch('/categories/monthly');
    personalMonthlyData = data;
    return data;
  } catch (err) {
    console.warn('Failed to load monthly data:', err.message);
    return null;
  }
}

// Inject view tabs into personal chapter page
function injectPersonalViewTabs() {
  if (document.getElementById('personal-view-tabs')) return;
  if (!window.currentChapter?.is_personal) return;

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

  // Update tab active state
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

  // Ensure container exists
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
  if (!personalMonthlyData || !personalMonthlyData.months.length) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:rgba(255,255,255,0.5);">
        <div style="font-size:2.5rem; margin-bottom:10px;">📅</div>
        <p>No expenses yet.</p>
      </div>
    `;
    return;
  }

  // Group expenses by month
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
            ${ex.category_icon} ${ex.category_name}
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
  if (!personalMonthlyData || !personalMonthlyData.categories.length) {
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
// PROFILE PAGE: Category management section
// ─────────────────────────────────────────────────────────────

function injectCategorySectionInProfile() {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) return;
  if (document.getElementById('profile-categories-section')) return;

  // Find where to inject (after friends section, before account section)
  const accountTitle = profileModal.querySelector('.profile-section-title:last-of-type');
  if (!accountTitle) return;

  const section = document.createElement('div');
  section.id = 'profile-categories-section';
  section.innerHTML = `
    <div class="profile-section-title">
      <span>My Categories</span>
      <button class="btn-small" onclick="openAddCategoryForm()" style="background:#f0f0f0; font-size:0.75rem; padding:4px 10px; border-radius:6px; border:none; cursor:pointer; font-family:var(--font-main); font-weight:600;">+ Add</button>
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
          <button class="btn-delete-category" onclick="deleteCategoryById(${cat.id}, '${cat.name.replace(/'/g,"\\'")}')">🗑️</button>
        `
      }
    </div>
  `).join('');
}

// Add category form
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
        style="width:100%; margin-bottom:12px; padding:8px 12px; border-radius:8px; border:1.5px solid #eee; font-family:var(--font-main); font-size:0.9rem;">

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
    if (editId) {
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
// HOOK into openProfileModal to inject category section
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
      }, 100);
    };
  };

  if (document.getElementById('profile-modal')) tryPatch();
})();

// ─────────────────────────────────────────────────────────────
// HOOK into chapter page: inject personal view tabs if personal chapter
// ─────────────────────────────────────────────────────────────
(function() {
  if (!document.getElementById('expense-list-container')) return;

  // After chapter data loads (chapterController sets currentChapter)
  const waitForChapter = setInterval(() => {
    if (!window.currentChapter) return;
    clearInterval(waitForChapter);

    if (window.currentChapter.is_personal) {
      injectPersonalViewTabs();
      // Load monthly data in background
      loadPersonalMonthlyData();
    }
  }, 400);
})();

// ─────────────────────────────────────────────────────────────
// INIT: Load categories on page load (for expense modal readiness)
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Pre-load categories if on chapter page
  if (document.getElementById('add-expense-modal')) {
    loadCategories();
  }
});