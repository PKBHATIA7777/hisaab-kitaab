/* client/js/chapter.js */

const urlParams = new URLSearchParams(window.location.search);
const chapterId = urlParams.get("id");

if (!chapterId) {
  window.location.href = "dashboard.html";
}

// State
let currentUser = null;
let currentChapter = null;
let currentMembers = [];
let expenses = []; 
let cachedFriends = []; 
let myFriendsCache = []; 

// ✅ NEW: Event State
let events = [];
let currentEventId = null; // null means "All"

// Edit Mode State
let isEditingExpense = false;
let editingExpenseId = null;

// Elements
const titleEl = document.getElementById("chapter-title");
const descEl = document.getElementById("chapter-desc");
const iconEl = document.getElementById("chapter-icon-display");
const memberListEl = document.getElementById("member-list-content");
const adminActions = document.getElementById("admin-actions");
const expenseListEl = document.getElementById("expense-list-container");
const emptyStateEl = document.getElementById("chapter-empty-state");
const fabBtn = document.querySelector(".fab-btn");
const eventsContainer = document.getElementById("events-strip-container"); // ✅ New Container

// Modals
const addExpenseModal = document.getElementById("add-expense-modal");
const addExpenseForm = document.getElementById("add-expense-form");
const payerContainer = document.getElementById("payer-selection-container");
const splitContainer = document.getElementById("split-selection-container");
const createEventModal = document.getElementById("create-event-modal"); // ✅ New Modal

// --- NEW MENU LOGIC ---
const menuBtn = document.getElementById("chapter-menu-btn");
const menuDropdown = document.getElementById("chapter-menu-dropdown");
const membersTrigger = document.getElementById("nav-members-trigger");
const memberDropdown = document.getElementById("member-dropdown");

// 1. Toggle Main Menu
if(menuBtn) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevents immediate closing by the document listener
    menuDropdown.classList.toggle("active");
    
    // Safety: Close member dropdown if it's open
    if(memberDropdown) memberDropdown.classList.remove("active");
  });
}

// 2. Handle "Members" click inside the menu
if(membersTrigger) {
  membersTrigger.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent document click from closing it immediately
    // Close the main menu
    menuDropdown.classList.remove("active");
    
    // Toggle the existing member list dropdown
    if(memberDropdown) {
        memberDropdown.style.display = "block";
        requestAnimationFrame(() => {
            memberDropdown.classList.toggle("active");
        });
    }
  });
}

// 3. Close menus when clicking anywhere else on the page
document.addEventListener("click", () => {
  if(menuDropdown) menuDropdown.classList.remove("active");
  if(memberDropdown) memberDropdown.classList.remove("active");
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [authData, chapterData] = await Promise.all([
      apiFetch("/auth/me"),
      apiFetch(`/chapters/${chapterId}`)
    ]);
    
    currentUser = authData.user;
    currentChapter = chapterData.chapter;
    currentMembers = chapterData.members;

    loadFriendsForAutocomplete();
    renderChapterInfo();
    renderMembers();
    
    // Load Events first, then trigger unified data load
    await loadEvents(); 
    loadExpenses(); // This now handles expenses AND settlements

  } catch (err) {
    console.error(err);
    alert("Failed to load chapter");
    window.location.href = "dashboard.html";
  }
});

// 👇 NEW FUNCTION: Fetch friends and populate datalist
async function loadFriendsForAutocomplete() {
  try {
    const data = await apiFetch("/friends"); 
    if (data.ok) {
      myFriendsCache = data.friends;
      
      const dataList = document.getElementById("friends-datalist");
      if (dataList) {
        dataList.innerHTML = myFriendsCache
          .map(f => `<option value="${f.name}">${f.username}</option>`)
          .join("");
      }
    }
  } catch (err) {
    console.error("Failed to load friends for autocomplete", err);
  }
}

// --- INITIALIZATION ---
// NOTE: This duplicate DOMContentLoaded listener has been removed to avoid conflicts
// The single listener above handles all initialization

// ✅ NEW: Load Events
async function loadEvents() {
  try {
    const data = await apiFetch(`/chapters/${chapterId}/events`);
    events = data.events || [];
    renderEventTabs();
  } catch (err) {
    console.warn("Failed to load events", err);
  }
}

// ✅ NEW: Render Tabs (Pills)
function renderEventTabs() {
  if (!eventsContainer) return;
  
  // 1. "All" Pill
  let html = `
    <button class="event-pill ${currentEventId === null ? 'active' : ''}" 
      onclick="switchEvent(null)">
      All
    </button>
  `;

  // 2. Event Pills
  events.forEach(ev => {
    html += `
      <button class="event-pill ${currentEventId === ev.id ? 'active' : ''}" 
        onclick="switchEvent(${ev.id})">
        ${ev.name}
      </button>
    `;
  });

  // 3. "+ New" Pill
  html += `
    <button class="event-pill new" onclick="openCreateEventModal()">
      + New
    </button>
  `;

  eventsContainer.innerHTML = html;
}

// ✅ NEW: Switch Logic
window.switchEvent = function(eventId) {
  if (currentEventId === eventId) return; // No change
  currentEventId = eventId;
  
  // Re-render tabs to highlight active
  renderEventTabs();
  
  // Reload data filtered by this event
  expenseListEl.innerHTML = '<div class="spinner" style="margin:20px auto;"></div>';
  loadExpenses();
};

// --- UPDATED: Load Expenses (Accepts Event Filter) ---
async function loadExpenses() {
  try {
    let url = `/expenses/chapter/${chapterId}`;
    if (currentEventId) url += `?eventId=${currentEventId}`;

    // REMOVED: Reference to deleted hero-status-amount element
    // document.getElementById('hero-status-amount').innerHTML = '<span class="spinner-small"></span>';
    
    const data = await apiFetch(url);
    expenses = data.expenses;
    
    // Sync UI components
    renderExpenses();
    loadHeroSettlements(); // Sync the Hero section with new data
  } catch (err) {
    console.error("Failed to load expenses");
    expenseListEl.innerHTML = '<div style="color:red; text-align:center;">Error loading expenses</div>';
  }
}

// --- UPDATED: Render Expenses ---
function renderExpenses() {
  expenseListEl.innerHTML = "";
  
  if (expenses.length === 0) {
    // Custom Empty State for Events
    if (currentEventId) {
       emptyStateEl.querySelector('p').textContent = "No expenses in this event yet.";
    } else {
       emptyStateEl.querySelector('p').textContent = "No expenses yet. Tap + to add one.";
    }
    emptyStateEl.style.display = "block";
    return;
  }
  
  emptyStateEl.style.display = "none";

  expenses.forEach(ex => {
    const card = document.createElement("div");
    card.className = "expense-card";
    if (ex.isTemp) card.style.opacity = "0.7";

    card.innerHTML = `
      <div class="expense-info">
        <h4>${ex.description || "Untitled Expense"}</h4>
        <p>paid by <strong>${ex.payer_name || "Unknown"}</strong> • ${timeAgo(ex.expense_date)}</p>
      </div>
      <div style="text-align:right;">
        <div class="expense-amount">₹${ex.amount}</div>
        <button onclick="openEditExpenseModal('${ex.id}')" style="background:none; border:none; color:#d000ff; font-size:0.8rem; cursor:pointer; margin-top:5px; padding:0;">
          View / Edit
        </button>
      </div>
    `;
    expenseListEl.appendChild(card);
  });
}

// --- RENDER FUNCTIONS ---
function renderChapterInfo() {
  document.getElementById("chapter-skeleton").style.display = "none";
  document.getElementById("chapter-content").style.display = "block";
  
  titleEl.textContent = currentChapter.name;
  descEl.textContent = currentChapter.description || "";
  descEl.style.display = currentChapter.description ? "block" : "none";

  iconEl.textContent = getInitials(currentChapter.name);
  const color = getAvatarColor(currentChapter.name);
  iconEl.style.background = color;
  iconEl.style.boxShadow = `0 0 30px ${color}60`;

  if (currentUser.id === currentChapter.created_by) {
    adminActions.style.display = "block";
  }
}

function renderMembers() {
  memberListEl.innerHTML = "";
  currentMembers.forEach(m => {
    const isMemberAdmin = (m.user_id === currentChapter.created_by);
    
    const row = document.createElement("div");
    row.className = "dropdown-member-item";
    
    row.innerHTML = `
      <div class="small-avatar" style="background:${getAvatarColor(m.member_name)}">${getInitials(m.member_name)}</div>
      <div class="member-name-text">
        ${m.member_name}
        ${isMemberAdmin ? '<span class="admin-badge">Admin</span>' : ''}
      </div>
    `;
    memberListEl.appendChild(row);
  });
}

// --- HELPER: Render Payer and Split Options ---
function renderPayerAndSplitOptions(selectedPayerId = null, selectedSplitIds = []) {
  payerContainer.innerHTML = "";
  currentMembers.forEach((m, idx) => {
    const isSelected = selectedPayerId ? (m.id === selectedPayerId) : (idx === 0);
    
    const el = document.createElement("label");
    el.className = `payer-option ${isSelected ? 'selected' : ''}`;
    el.innerHTML = `
      <input type="radio" name="payerMemberId" value="${m.id}" ${isSelected ? 'checked' : ''}>
      <div style="font-weight:600; font-size:0.9rem;">${m.member_name}</div>
    `;
    el.addEventListener("click", () => {
      document.querySelectorAll(".payer-option").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
    });
    payerContainer.appendChild(el);
  });

  splitContainer.innerHTML = "";
  const isAddMode = selectedSplitIds.length === 0 && !isEditingExpense; 
  
  currentMembers.forEach(m => {
    const isChecked = isAddMode || selectedSplitIds.includes(m.id);
    
    const el = document.createElement("label");
    el.className = `split-option ${isChecked ? 'selected' : ''}`;
    el.innerHTML = `
      <input type="checkbox" name="involvedMemberIds[]" value="${m.id}" ${isChecked ? 'checked' : ''}>
      <div class="custom-check"></div>
      <span>${m.member_name}</span>
    `;
    el.addEventListener("change", () => {
      if (el.querySelector("input").checked) el.classList.add("selected");
      else el.classList.remove("selected");
    });
    splitContainer.appendChild(el);
  });
}

// --- EXPENSE MODAL LOGIC ---
window.openAddExpenseModal = function() {
  isEditingExpense = false;
  editingExpenseId = null;
  document.getElementById("expense-modal-title").textContent = "Add Expense";
  
  // 🔒 SAFETY RESET: Explicitly enable button and reset text for new expense
  const saveBtn = document.getElementById("btn-save-expense");
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = "Save Expense";
  }
  
  document.getElementById("btn-delete-expense").style.display = "none";
  
  addExpenseForm.reset();
  renderPayerAndSplitOptions(); 
  
  addExpenseModal.classList.add("active");
  setTimeout(() => addExpenseForm.querySelector(".big-amount-input").focus(), 100);
};

window.openEditExpenseModal = async function(id) {
  isEditingExpense = true;
  editingExpenseId = id;
  
  showToast("Loading details...", "info");

  try {
    const data = await apiFetch(`/expenses/${id}`);
    const { expense, involvedMemberIds } = data;

    addExpenseForm.reset();
    document.getElementById("expense-modal-title").textContent = "Edit Expense";
    
    // 🔒 SAFETY RESET: Explicitly enable button and set update text for editing
    const saveBtn = document.getElementById("btn-save-expense");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Update Expense";
    }
    
    document.getElementById("btn-delete-expense").style.display = "block";

    addExpenseForm.querySelector("input[name='amount']").value = expense.amount;
    addExpenseForm.querySelector("input[name='description']").value = expense.description;

    renderPayerAndSplitOptions(expense.payer_member_id, involvedMemberIds);

    addExpenseModal.classList.add("active");

  } catch (err) {
    showToast("Failed to load expense details", "error");
    isEditingExpense = false;
    editingExpenseId = null;
  }
};

// ✅ FIX #1: Added document.activeElement.blur() to prevent focus traps
window.closeAddExpenseModal = function() {
  addExpenseModal.classList.remove("active");
  
  // 🔒 Clear focus to prevent focus traps & keyboard issues
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  
  // 🔒 Re-enable the save button and reset to default text
  const saveBtn = document.getElementById("btn-save-expense");
  if (saveBtn) {
    saveBtn.disabled = false;
    // Always reset to default "Save Expense" since modal opens in add mode by default
    saveBtn.innerHTML = "Save Expense";
  }
  
  // Reset state after button update
  isEditingExpense = false;
  editingExpenseId = null;
};

window.toggleSelectAll = function() {
  const checkboxes = splitContainer.querySelectorAll("input[type='checkbox']");
  const allChecked = Array.from(checkboxes).every(c => c.checked);
  
  checkboxes.forEach(c => {
    c.checked = !allChecked;
    const row = c.closest(".split-option");
    if (c.checked) row.classList.add("selected");
    else row.classList.remove("selected");
  });
};

window.handleDeleteExpense = async function() {
  if(!confirm("Are you sure you want to delete this expense?")) return;
  
  try {
    await apiFetch(`/expenses/${editingExpenseId}`, { method: "DELETE" });
    showToast("Expense deleted", "success");
    closeAddExpenseModal();
    loadExpenses();
  } catch(err) {
    showToast("Failed to delete", "error");
  }
};

// --- FORM SUBMIT (Handles Both Add & Edit) ---
// --- Updated to include eventId ---
// ✅ FIX #2: Changed from .onsubmit = to addEventListener for robustness
addExpenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const saveBtn = document.getElementById("btn-save-expense");
  
  // 🔒 GUARD CLAUSE: Prevent duplicate submissions if button is already in loading state
  // This prevents race conditions where multiple clicks stack up pending promises
  if (saveBtn.disabled || saveBtn.innerHTML.includes('spinner')) {
    return;
  }
  
  const formData = new FormData(addExpenseForm);
  
  const amount = parseFloat(formData.get("amount"));
  const description = formData.get("description") || "";
  const payerId = parseInt(formData.get("payerMemberId"));
  const involvedIds = [];
  splitContainer.querySelectorAll("input:checked").forEach(cb => involvedIds.push(parseInt(cb.value)));

  // --- Validation ---
  if (!amount || amount <= 0) return showToast("Please enter a valid amount", "error");
  if (involvedIds.length === 0) return showToast("Select at least one person to split with", "error");

  // --- STEP 1: PREVENT DOUBLE CLICK & INSTANT FEEDBACK ---
  saveBtn.disabled = true; // Physically prevent second click
  saveBtn.innerHTML = `<span class="spinner-small"></span> Saving...`; // Visual feedback

  const payload = {
    chapterId: chapterId,
    eventId: currentEventId,
    amount,
    description,
    payerMemberId: payerId,
    involvedMemberIds: involvedIds
  };

  // --- OPTIMISTIC UI: Add to list immediately if creating new ---
  let tempId = "temp-" + Date.now();
  if (!isEditingExpense) {
    const payerName = currentMembers.find(m => m.id === payerId)?.member_name || "You";
    const tempExpense = {
      id: tempId,
      amount: amount,
      description: description,
      expense_date: new Date().toISOString(),
      payer_name: payerName,
      isTemp: true // CSS will make this look slightly faded
    };

    expenses.unshift(tempExpense);
    renderExpenses();
    
    // 🔒 CHANGE: Use wrapper function to ensure proper button reset
    closeAddExpenseModal(); 
  }

  try {
    if (isEditingExpense) {
      await apiFetch(`/expenses/${editingExpenseId}`, {
        method: "PUT",
        body: payload
      });
      showToast("Expense updated", "success");
      closeAddExpenseModal(); // Close after update (since we don't optimistic update edits yet)
    } else {
      await apiFetch("/expenses", {
        method: "POST",
        body: payload
      });
      // No need to call showToast here if we want "silent" success, or do it anyway:
      // showToast("Expense saved", "success");
    }
    
    // Refresh to replace optimistic data with real server data
    loadExpenses(); 

  } catch (err) {
    // --- ROLLBACK: If server fails, remove the fake entry and re-open/enable ---
    if (!isEditingExpense) {
      expenses = expenses.filter(ex => ex.id !== tempId);
      renderExpenses();
      addExpenseModal.classList.add("active"); // Re-open so user doesn't lose data
    }
    
    // 🔒 Ensure button is re-enabled and spinner replaced with original text on error
    saveBtn.disabled = false;
    saveBtn.innerHTML = isEditingExpense ? "Update Expense" : "Save Expense";
    
    // ✅ IMPROVED: Display user-friendly error messages from main.js apiFetch
    // Handles rate limit (429) and server errors (5xx) with clear messaging
    const errorMsg = err.isRateLimit 
      ? "You're adding expenses too fast, please wait a moment."
      : err.isServerError
        ? "Server is temporarily unavailable. Please try again."
        : (err.message || "Failed to save expense");
    
    showToast(errorMsg, "error");
    
  } finally {
    // ✅ CRITICAL: GUARANTEE button re-enables regardless of success/failure
    // This ensures the UI never gets stuck in "Saving..." state
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = isEditingExpense ? "Update Expense" : "Save Expense";
    }
  }
});

// --- SUMMARY LOGIC ---
const summaryModal = document.getElementById("summary-modal");
const summaryList = document.getElementById("summary-list");
const summaryGrandTotal = document.getElementById("summary-grand-total");

// --- UPDATED: Summary Modal (Use currentEventId) ---
window.openSummaryModal = async function() {
  summaryModal.classList.add("active");
  summaryList.innerHTML = '<div style="text-align:center; padding:20px;">Loading...</div>';
  
  // ✅ Update Title based on Context
  const title = currentEventId 
    ? events.find(e => e.id === currentEventId)?.name + " Summary"
    : "Chapter Summary";
  summaryModal.querySelector("h2").textContent = title;

  try {
    let url = `/expenses/chapter/${chapterId}/summary`;
    if (currentEventId) url += `?eventId=${currentEventId}`; // Filter!

    const data = await apiFetch(url);
    renderSummary(data);
  } catch (err) {
    summaryList.innerHTML = '<div style="color:red; text-align:center;">Failed to load summary</div>';
  }
};

window.closeSummaryModal = function() {
  summaryModal.classList.remove("active");
};

function renderSummary(data) {
  const { summary, grandTotal } = data;
  summaryGrandTotal.textContent = `₹${grandTotal}`;
  summaryList.innerHTML = "";

  const maxVal = Math.max(...summary.map(s => Math.max(parseFloat(s.total_spent), parseFloat(s.total_used))), 1);

  summary.forEach(item => {
    const spent = parseFloat(item.total_spent);
    const used = parseFloat(item.total_used);
    
    const row = document.createElement("div");
    row.style.marginBottom = "20px";
    
    row.innerHTML = `
      <div class="summary-row" style="border:none; padding-bottom:5px;">
        <div class="summary-name">
          <div class="small-avatar" style="width:30px; height:30px; font-size:0.8rem; background:${getAvatarColor(item.member_name)}">
            ${getInitials(item.member_name)}
          </div>
          ${item.member_name}
        </div>
      </div>
      
      <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#666; margin-bottom:2px;">
        <span>Paid</span> <span>₹${spent.toFixed(2)}</span>
      </div>
      <div class="summary-bar-bg" style="height:6px; margin-top:0; margin-bottom:8px;">
        <div class="summary-bar-fill" style="width: ${(spent/maxVal)*100}%; background: #00e676;"></div>
      </div>

      <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#666; margin-bottom:2px;">
        <span>Consumed</span> <span>₹${used.toFixed(2)}</span>
      </div>
      <div class="summary-bar-bg" style="height:6px; margin-top:0;">
        <div class="summary-bar-fill" style="width: ${(used/maxVal)*100}%; background: #d000ff;"></div>
      </div>
    `;
    summaryList.appendChild(row);
  });
}

// =========================================================
// ✅ SETTLEMENT LOGIC (Updated)
// =========================================================
const settlementModal = document.getElementById("settlement-modal");
const settlementList = document.getElementById("settlement-list");
const settlementLoading = document.getElementById("settlement-loading");
const settlementEmpty = document.getElementById("settlement-empty");

// --- UPDATED: Settlements Modal (Use currentEventId) ---
window.openSettlementModal = async function() {
  settlementModal.classList.add("active");
  
  settlementList.innerHTML = "";
  settlementList.style.display = "none";
  settlementEmpty.style.display = "none";
  settlementLoading.style.display = "block";

  // ✅ Update Title
  const title = currentEventId 
    ? "Settle Up: " + events.find(e => e.id === currentEventId)?.name
    : "Who Pays Whom?";
  settlementModal.querySelector("h2").textContent = title;

  try {
    let url = `/expenses/chapter/${chapterId}/settlements`;
    if (currentEventId) url += `?eventId=${currentEventId}`; // Filter!

    const data = await apiFetch(url);
    renderSettlements(data.settlements);
  } catch (err) {
    console.error(err);
    settlementList.innerHTML = `<div style="color:red; text-align:center;">Failed to calculate settlements</div>`;
    settlementList.style.display = "block";
  } finally {
    settlementLoading.style.display = "none";
  }
};

window.closeSettlementModal = function() {
  settlementModal.classList.remove("active");
};

function renderSettlements(settlements) {
  if (!settlements || settlements.length === 0) {
    settlementEmpty.style.display = "block";
    return;
  }

  settlementList.style.display = "block";
  settlementList.innerHTML = "";

  settlements.forEach(item => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:15px 0; border-bottom:1px solid #f0f0f0;";
    
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; flex:1;">
        <div class="small-avatar" style="background:${getAvatarColor(item.from)}">
          ${getInitials(item.from)}
        </div>
        
        <div style="font-size:0.9rem; line-height:1.3;">
          <span style="font-weight:600; color:#333;">${item.from}</span>
          <div style="color:#888; font-size:0.8rem;">pays <span style="font-weight:600;">${item.to}</span></div>
        </div>
      </div>

      <div style="text-align:right;">
        <div style="font-weight:700; font-size:1.1rem; color:#d000ff;">₹${item.amount}</div>
        <div style="font-size:0.7rem; color:#ccc;">➔</div>
      </div>
    `;

    settlementList.appendChild(row);
  });
};

// ==========================================
// ✅ EXCEL EXPORT LOGIC (Unchanged)
// ==========================================
window.downloadReport = async function() {
  const btn = document.querySelector("button[onclick='downloadReport()']");
  
  // 🔒 GUARD CLAUSE: Prevent duplicate export requests
  if (btn && (btn.disabled || btn.innerHTML.includes('spinner'))) {
    return;
  }
  
  try {
    if (btn) setBtnLoading(btn, true);
    
    // UI Feedback: Show what we are downloading
    const label = currentEventId 
      ? "Generating Event Report..." 
      : "Generating Full Report...";
    showToast(label, "info");

    const { csrfToken } = await apiFetch("/csrf-token");

    // ✅ Append eventId if selected
    let url = `${APP_CONFIG.API_BASE}/chapters/${chapterId}/export`;
    if (currentEventId) {
      url += `?eventId=${currentEventId}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-CSRF-Token": csrfToken
      },
      credentials: "include"
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || "Export failed");
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = downloadUrl;
    
    // Filename is set by the Content-Disposition header in the backend, 
    // but we can set a fallback here.
    const cleanName = currentChapter.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `hisaab_kitaab_${cleanName}.xlsx`;
    
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);

    showToast("Report downloaded successfully", "success");

  } catch (err) {
    console.error("Download error:", err);
    
    // ✅ IMPROVED: Handle rate limit and server errors for export too
    const errorMsg = err.isRateLimit 
      ? "You're requesting reports too fast, please wait a moment."
      : err.isServerError
        ? "Server is temporarily unavailable. Please try again."
        : (err.message || "Failed to download report");
    
    showToast(errorMsg, "error");
  } finally {
    if (btn) setBtnLoading(btn, false);
  }
};

// ✅ NEW: Create Event Logic
const createEventForm = document.getElementById("create-event-form");

window.openCreateEventModal = function() {
  createEventForm.reset();
  createEventModal.classList.add("active");
  setTimeout(() => createEventForm.querySelector("input").focus(), 100);
};

window.closeCreateEventModal = function() {
  createEventModal.classList.remove("active");
};

createEventForm.onsubmit = async (e) => {
  e.preventDefault();
  const btn = createEventForm.querySelector("button[type='submit']");
  
  // 🔒 GUARD CLAUSE: Prevent duplicate event creation requests
  if (btn && (btn.disabled || btn.innerHTML.includes('spinner'))) {
    return;
  }
  
  const name = createEventForm.name.value.trim();
  
  if(!name) return;

  try {
    setBtnLoading(btn, true);
    const data = await apiFetch(`/chapters/${chapterId}/events`, {
      method: "POST",
      body: { name }
    });
    
    showToast("Event created!", "success");
    closeCreateEventModal();
    
    // Refresh events and auto-switch to new event
    await loadEvents();
    switchEvent(data.event.id);

  } catch(err) {
    // ✅ IMPROVED: Handle rate limit and server errors for event creation
    const errorMsg = err.isRateLimit 
      ? "You're creating events too fast, please wait a moment."
      : err.isServerError
        ? "Server is temporarily unavailable. Please try again."
        : (err.message || "Failed to create event");
    
    showToast(errorMsg, "error");
  } finally {
    setBtnLoading(btn, false);
  }
};

// --- UTILS ---
function getInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 60%)`;
}

function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Add Member Modal Logic
const addMemberModal = document.getElementById("add-member-modal");
const addMemberFormEl = document.getElementById("add-member-form");

window.openAddMemberModal = function() {
  if(!addMemberFormEl) return; 
  addMemberFormEl.reset();
  addMemberModal.classList.add("active");
  const input = document.getElementById("new-member-name");
  if (input) setTimeout(() => input.focus(), 100);
};

window.closeAddMemberModal = function() {
  if(addMemberModal) addMemberModal.classList.remove("active");
};

// ✅ REPLACED: New add-member form submit logic with friend lookup
if(addMemberFormEl) {
  addMemberFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // 🔒 GUARD CLAUSE: Prevent duplicate member addition requests
    const submitBtn = addMemberFormEl.querySelector('button[type="submit"]');
    if (submitBtn && (submitBtn.disabled || submitBtn.innerHTML.includes('spinner'))) {
      return;
    }
    
    const nameInput = document.getElementById("new-member-name");
    const name = nameInput.value.trim();
    if (!name) return;

    // LOOKUP: Check if the typed name matches a known friend
    const matchedFriend = myFriendsCache.find(
      f => f.name.toLowerCase() === name.toLowerCase() || 
           f.username.toLowerCase() === name.toLowerCase()
    );

    const payload = {
      memberName: matchedFriend ? matchedFriend.name : name,
      friendId: matchedFriend ? matchedFriend.id : null
    };

    try {
      // Disable button during request if it exists
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner-small"></span> Adding...`;
      }
      
      const data = await apiFetch(`/chapters/${chapterId}/members`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (data.ok) {
        closeModal("add-member-modal");
        nameInput.value = "";
        showToast("Member added successfully");
        loadChapterDetails(); // Refresh the list
      } else {
        showToast(data.message || "Failed to add member", "error");
      }
    } catch (err) {
      console.error(err);
      
      // ✅ IMPROVED: Handle rate limit and server errors for member addition
      const errorMsg = err.isRateLimit 
        ? "You're adding members too fast, please wait a moment."
        : err.isServerError
          ? "Server is temporarily unavailable. Please try again."
          : "Server error";
      
      showToast(errorMsg, "error");
    } finally {
      // Re-enable button in finally block
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Add Member";
      }
    }
  });
}

// Helper to close modals by ID (used above)
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}

// Reload chapter details (used after adding member)
async function loadChapterDetails() {
  try {
    const data = await apiFetch(`/chapters/${chapterId}`);
    currentMembers = data.members;
    renderMembers();
  } catch (err) {
    console.error("Failed to reload chapter", err);
  }
}

// Delete Member
window.deleteMember = async function(memberId) {
  if (!confirm("Remove this member? This cannot be undone.")) return;

  try {
    await apiFetch(`/chapters/${chapterId}/members/${memberId}`, {
      method: "DELETE"
    });
    showToast("Member removed", "info");
    
    const data = await apiFetch(`/chapters/${chapterId}`);
    currentMembers = data.members;
    renderMembers();
  } catch (err) {
    // ✅ IMPROVED: Handle rate limit and server errors for member deletion
    const errorMsg = err.isRateLimit 
      ? "Please wait a moment before trying again."
      : err.isServerError
        ? "Server is temporarily unavailable. Please try again."
        : (err.message || "Failed to remove member");
    
    showToast(errorMsg, "error");
  }
};

// ==========================================
// ✅ SETTLEMENT HERO LOGIC - COMPLETELY REPLACED (Steps 1, 2, 4)
// ==========================================
// --- Updated Toggle Logic (Step 4) ---
const heroCard = document.getElementById('hero-summary-card');
if (heroCard) {
    heroCard.onclick = (e) => {
        // Prevent toggle when clicking refresh button (has stopPropagation in HTML)
        const content = document.getElementById('hero-details-content');
        const btn = document.getElementById('hero-expand-btn');
        content.classList.toggle('active');
        btn.classList.toggle('active');
    };
}

// --- Updated Settlement Refresh (Step 2 & 4) ---
window.refreshSettlements = async function() {
    // 🔒 GUARD CLAUSE: Prevent duplicate refresh requests
    const refreshBtn = document.getElementById('hero-refresh-btn');
    if (refreshBtn && (refreshBtn.disabled || refreshBtn.innerHTML.includes('spinner'))) {
      return;
    }
    
    try {
        // Disable refresh button during request
        if (refreshBtn) {
          refreshBtn.disabled = true;
          refreshBtn.innerHTML = `<span class="spinner-small"></span>`;
        }
        
        await loadHeroSettlements();
        showToast("Settlements updated", "info");
    } catch (err) {
        console.error("Refresh settlements error:", err);
        
        // ✅ IMPROVED: Handle rate limit and server errors for settlement refresh
        const errorMsg = err.isRateLimit 
          ? "Please wait a moment before refreshing."
          : err.isServerError
            ? "Server is temporarily unavailable. Please try again."
            : "Failed to refresh";
        
        showToast(errorMsg, "error");
    } finally {
        // Re-enable refresh button
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = "⟳";
        }
    }
};

// --- Data Loading for Hero Settlements (Unchanged core logic) ---
async function loadHeroSettlements() {
    try {
        let url = `/expenses/chapter/${chapterId}/settlements`;
        if (currentEventId) url += `?eventId=${currentEventId}`;

        const data = await apiFetch(url);
        renderHeroSettlements(data.settlements);
    } catch (err) {
        console.error("Hero Settlement Error:", err);
        const listEl = document.getElementById('hero-settlement-list');
        if (listEl) {
            listEl.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Error loading settlements</div>';
        }
    }
}

// --- Updated Render Logic (Step 2 & 4) ---
function renderHeroSettlements(settlements) {
    const listEl = document.getElementById('hero-settlement-list');
    const content = document.getElementById('hero-details-content');
    const btn = document.getElementById('hero-expand-btn');

    // 1. Keep it expanded if there are settlements
    if (settlements && settlements.length > 0) {
        content.classList.add('active');
        btn.classList.add('active');
    }

    if (!settlements || settlements.length === 0) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No pending payments. 🎉</div>';
        return;
    }

    // 2. Render List without the "N payments pending" footer
    listEl.innerHTML = settlements.map(item => `
        <div class="mini-settle-item" style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
            <div class="settle-info" style="display:flex; align-items:center; gap:10px;">
                <div class="small-avatar" style="background:${getAvatarColor(item.from)}; width:24px; height:24px; font-size:0.7rem;">
                    ${getInitials(item.from)}
                </div>
                <span style="font-size:0.85rem;"><strong>${item.from}</strong> <span style="color:#ccc;">→</span> <strong>${item.to}</strong></span>
            </div>
            <span class="settle-amount" style="font-weight:600; color:#d000ff; font-size:0.9rem;">₹${item.amount}</span>
        </div>
    `).join('');
}