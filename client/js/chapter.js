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
let expenses = []; // ✅ Store expenses locally

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

// Modals
const addExpenseModal = document.getElementById("add-expense-modal");
const addExpenseForm = document.getElementById("add-expense-form");
const payerContainer = document.getElementById("payer-selection-container");
const splitContainer = document.getElementById("split-selection-container");

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [authData, chapterData] = await Promise.all([
      apiFetch("/auth/me"),
      apiFetch(`/chapters/${chapterId}`)
    ]);
    
    currentUser = authData.user;
    currentChapter = chapterData.chapter;
    currentMembers = chapterData.members;

    renderChapterInfo();
    renderMembers();

    // ✅ FETCH EXPENSES
    loadExpenses();

  } catch (err) {
    console.error(err);
    alert("Failed to load chapter");
    window.location.href = "dashboard.html";
  }
});

async function loadExpenses() {
  try {
    const data = await apiFetch(`/expenses/chapter/${chapterId}`);
    expenses = data.expenses;
    renderExpenses();
  } catch (err) {
    console.error("Failed to load expenses");
  }
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
    const row = document.createElement("div");
    row.className = "dropdown-member-item";
    const isMemberAdmin = (m.user_id === currentChapter.created_by);
    
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

function renderExpenses() {
  expenseListEl.innerHTML = "";
  
  if (expenses.length === 0) {
    emptyStateEl.style.display = "block";
    return;
  }
  
  emptyStateEl.style.display = "none";

  expenses.forEach(ex => {
    const card = document.createElement("div");
    card.className = "expense-card";
    
    // Check if it's a temporary optimistic expense
    if (ex.isTemp) {
      card.style.opacity = "0.7";
      card.style.filter = "grayscale(1)";
    }

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

// --- HELPER: Render Payer and Split Options ---
function renderPayerAndSplitOptions(selectedPayerId = null, selectedSplitIds = []) {
  // Payers
  payerContainer.innerHTML = "";
  currentMembers.forEach((m, idx) => {
    // If Editing: match ID. If Adding: match first index.
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

  // Splits
  splitContainer.innerHTML = "";
  // Default to ALL checked if adding new, or match IDs if editing
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
  document.getElementById("btn-save-expense").textContent = "Save Expense";
  document.getElementById("btn-delete-expense").style.display = "none";
  
  addExpenseForm.reset();
  renderPayerAndSplitOptions(); 
  
  addExpenseModal.classList.add("active");
  setTimeout(() => addExpenseForm.querySelector(".big-amount-input").focus(), 100);
};

window.openEditExpenseModal = async function(id) {
  isEditingExpense = true;
  editingExpenseId = id;
  
  // Show loading toast
  showToast("Loading details...", "info");

  try {
    const data = await apiFetch(`/expenses/${id}`);
    const { expense, involvedMemberIds } = data;

    // Reset Form & Set Mode
    addExpenseForm.reset();
    document.getElementById("expense-modal-title").textContent = "Edit Expense";
    document.getElementById("btn-save-expense").textContent = "Update Expense";
    document.getElementById("btn-delete-expense").style.display = "block"; // Show Delete

    // Fill Basic Data
    addExpenseForm.querySelector("input[name='amount']").value = expense.amount;
    addExpenseForm.querySelector("input[name='description']").value = expense.description;

    // Render Payers & Splits (Reuse logic but set checked status)
    renderPayerAndSplitOptions(expense.payer_member_id, involvedMemberIds);

    addExpenseModal.classList.add("active");

  } catch (err) {
    showToast("Failed to load expense details", "error");
    isEditingExpense = false;
    editingExpenseId = null;
  }
};

window.closeAddExpenseModal = function() {
  addExpenseModal.classList.remove("active");
  isEditingExpense = false;
  editingExpenseId = null;
};

window.toggleSelectAll = function() {
  const checkboxes = splitContainer.querySelectorAll("input[type='checkbox']");
  const allChecked = Array.from(checkboxes).every(c => c.checked);
  
  checkboxes.forEach(c => {
    c.checked = !allChecked;
    // Trigger visual update
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
    loadExpenses(); // Refresh list
  } catch(err) {
    showToast("Failed to delete", "error");
  }
};

// --- FORM SUBMIT (Handles Both Add & Edit) ---
addExpenseForm.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(addExpenseForm);
  
  // 1. Extract Data
  const amount = parseFloat(formData.get("amount"));
  const description = formData.get("description") || "";
  const payerId = parseInt(formData.get("payerMemberId"));
  
  // Get all checked split IDs
  const involvedIds = [];
  splitContainer.querySelectorAll("input:checked").forEach(cb => involvedIds.push(parseInt(cb.value)));

  // 2. Validation
  if (!amount || amount <= 0) {
    return showToast("Please enter a valid amount", "error");
  }
  if (involvedIds.length === 0) {
    return showToast("Select at least one person to split with", "error");
  }

  try {
    if (isEditingExpense) {
      // --- UPDATE MODE ---
      await apiFetch(`/expenses/${editingExpenseId}`, {
        method: "PUT",
        body: {
          amount,
          description,
          payerMemberId: payerId,
          involvedMemberIds: involvedIds
        }
      });
      showToast("Expense updated", "success");
    } else {
      // --- CREATE MODE (Optimistic UI) ---
      const payerName = currentMembers.find(m => m.id === payerId)?.member_name || "You";
      
      const tempExpense = {
        id: "temp-" + Date.now(),
        amount: amount,
        description: description,
        expense_date: new Date().toISOString(),
        payer_name: payerName,
        isTemp: true
      };

      // Optimistic update
      expenses.unshift(tempExpense);
      renderExpenses();
      
      await apiFetch("/expenses", {
        method: "POST",
        body: {
          chapterId: chapterId,
          amount: amount,
          description: description,
          payerMemberId: payerId,
          involvedMemberIds: involvedIds
        }
      });
      
      showToast("Expense saved", "success");
      loadExpenses(); // Replace temp with real data
    }
    
    closeAddExpenseModal();
  } catch (err) {
    if (!isEditingExpense) {
      // Rollback optimistic update
      expenses = expenses.filter(ex => !ex.id.startsWith("temp-"));
      renderExpenses();
    }
    showToast(err.message || "Failed to save expense", "error");
  }
};

// --- SUMMARY LOGIC ---
const summaryModal = document.getElementById("summary-modal");
const summaryList = document.getElementById("summary-list");
const summaryGrandTotal = document.getElementById("summary-grand-total");

window.openSummaryModal = async function() {
  summaryModal.classList.add("active");
  
  // Show loading state
  summaryList.innerHTML = '<div style="text-align:center; padding:20px;">Loading...</div>';
  
  try {
    const data = await apiFetch(`/expenses/chapter/${chapterId}/summary`);
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

  // Calculate max for progress bars based on the higher of the two values
  const maxVal = Math.max(...summary.map(s => Math.max(parseFloat(s.total_spent), parseFloat(s.total_used))), 1);

  summary.forEach(item => {
    const spent = parseFloat(item.total_spent);
    const used = parseFloat(item.total_used);
    
    const row = document.createElement("div");
    row.style.marginBottom = "20px"; // More spacing for double bars
    
    // UI: Name Row
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

// Dropdown Toggles (Members)
const toggleBtn = document.getElementById("member-toggle-btn");
const dropdown = document.getElementById("member-dropdown");

toggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdown.classList.toggle("active");
});
document.addEventListener("click", () => dropdown.classList.remove("active"));
dropdown.addEventListener("click", (e) => e.stopPropagation());

// Add Member Modal Logic
const addMemberModal = document.getElementById("add-member-modal");
const addMemberFormEl = document.getElementById("add-member-form");

window.openAddMemberModal = function() {
  if(!addMemberFormEl) return; 
  addMemberFormEl.reset();
  addMemberModal.classList.add("active");
  setTimeout(() => addMemberFormEl.querySelector("input").focus(), 100);
};

window.closeAddMemberModal = function() {
  if(addMemberModal) addMemberModal.classList.remove("active");
};

if(addMemberFormEl) {
  addMemberFormEl.onsubmit = async (e) => {
    e.preventDefault();
    const name = new FormData(addMemberFormEl).get("memberName");
    try {
      await apiFetch(`/chapters/${chapterId}/members`, { method: "POST", body: { memberName: name } });
      showToast("Member added", "success");
      closeAddMemberModal();
      // Reload everything
      const d = await apiFetch(`/chapters/${chapterId}`);
      currentMembers = d.members;
      renderMembers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };
}

// Delete Member
window.deleteMember = async function(memberId) {
  if (!confirm("Remove this member? This cannot be undone.")) return;

  try {
    await apiFetch(`/chapters/${chapterId}/members/${memberId}`, {
      method: "DELETE"
    });
    showToast("Member removed", "info");
    
    // Refresh
    const data = await apiFetch(`/chapters/${chapterId}`);
    currentMembers = data.members;
    renderMembers();
  } catch (err) {
    showToast(err.message || "Failed to remove member", "error");
  }
};

// =========================================================
// ✅ NEW: SETTLEMENT LOGIC
// =========================================================
const settlementModal = document.getElementById("settlement-modal");
const settlementList = document.getElementById("settlement-list");
const settlementLoading = document.getElementById("settlement-loading");
const settlementEmpty = document.getElementById("settlement-empty");

window.openSettlementModal = async function() {
  settlementModal.classList.add("active");
  
  // Reset State
  settlementList.innerHTML = "";
  settlementList.style.display = "none";
  settlementEmpty.style.display = "none";
  settlementLoading.style.display = "block";

  try {
    const data = await apiFetch(`/expenses/chapter/${chapterId}/settlements`);
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
    // Structure: From (Debtor) -> To (Creditor) : Amount
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
// ✅ EXCEL EXPORT LOGIC
// ==========================================
window.downloadReport = async function() {
  const btn = document.querySelector("button[onclick='downloadReport()']");
  
  try {
    if (btn) setBtnLoading(btn, true); // Use existing helper
    showToast("Generating report...", "info");

    // 1. Get CSRF Token using the existing utility
    // We need this because we are bypassing apiFetch for the binary download
    const { csrfToken } = await apiFetch("/csrf-token");

    // 2. Request the Blob
    const response = await fetch(`${APP_CONFIG.API_BASE}/chapters/${chapterId}/export`, {
      method: "GET",
      headers: {
        "X-CSRF-Token": csrfToken
      },
      credentials: "include" // Important: Sends auth cookies
    });

    if (!response.ok) {
      // Try to parse error message if possible
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || "Export failed");
    }

    // 3. Convert Response to Blob & Trigger Download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    // Create temporary link
    const a = document.createElement("a");
    a.href = url;
    // Name the file: ChapterName_Timestamp.xlsx
    const cleanName = currentChapter.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `hisaab_kitaab_${cleanName}_${Date.now()}.xlsx`;
    
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showToast("Report downloaded successfully", "success");

  } catch (err) {
    console.error("Download error:", err);
    showToast(err.message || "Failed to download report", "error");
  } finally {
    if (btn) setBtnLoading(btn, false);
  }
};
