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
      <div class="expense-amount">₹${ex.amount}</div>
    `;
    expenseListEl.appendChild(card);
  });
}

// --- ADD EXPENSE LOGIC ---

window.openAddExpenseModal = function() {
  addExpenseForm.reset();
  
  // 1. Populate Payers (Radio Logic)
  payerContainer.innerHTML = "";
  currentMembers.forEach((m, idx) => {
    const el = document.createElement("label");
    el.className = "payer-option";
    // Auto-select the first person (usually Admin/You)
    if (idx === 0) el.classList.add("selected");
    
    el.innerHTML = `
      <input type="radio" name="payerMemberId" value="${m.id}" ${idx===0 ? 'checked' : ''}>
      <div style="font-weight:600; font-size:0.9rem;">${m.member_name}</div>
    `;
    
    // Click Handler for Styling
    el.addEventListener("click", () => {
      document.querySelectorAll(".payer-option").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
    });
    
    payerContainer.appendChild(el);
  });

  // 2. Populate Splits (Checkbox Logic)
  splitContainer.innerHTML = "";
  currentMembers.forEach(m => {
    const el = document.createElement("label");
    el.className = "split-option selected"; // Default: Select All
    
    el.innerHTML = `
      <input type="checkbox" name="involvedMemberIds[]" value="${m.id}" checked>
      <div class="custom-check"></div>
      <span>${m.member_name}</span>
    `;
    
    el.addEventListener("change", () => {
      if (el.querySelector("input").checked) el.classList.add("selected");
      else el.classList.remove("selected");
    });

    splitContainer.appendChild(el);
  });

  addExpenseModal.classList.add("active");
  // Focus Amount Input
  setTimeout(() => addExpenseForm.querySelector(".big-amount-input").focus(), 100);
};

window.closeAddExpenseModal = function() {
  addExpenseModal.classList.remove("active");
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

// --- OPTIMISTIC FORM SUBMIT ---
addExpenseForm.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(addExpenseForm);
  
  // 1. Extract Data
  const amount = parseFloat(formData.get("amount"));
  const description = formData.get("description");
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

  // 3. OPTIMISTIC UPDATE (Instant UI)
  const payerName = currentMembers.find(m => m.id === payerId)?.member_name || "You";
  
  const tempExpense = {
    id: "temp-" + Date.now(),
    amount: amount,
    description: description,
    expense_date: new Date().toISOString(),
    payer_name: payerName,
    isTemp: true // Flag for visual style
  };

  // Add to top of list
  expenses.unshift(tempExpense);
  renderExpenses();
  closeAddExpenseModal(); // Close immediately

  // 4. API CALL (Background)
  try {
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
    // Reload real data to get correct IDs and server timestamp
    loadExpenses();

  } catch (err) {
    // 5. ROLLBACK on Error
    expenses = expenses.filter(ex => ex.id !== tempExpense.id);
    renderExpenses();
    showToast(err.message || "Failed to save expense", "error");
    // Re-open modal so user doesn't lose data? (Optional, skipping for simplicity)
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

// Dropdown Toggles (Members)
const toggleBtn = document.getElementById("member-toggle-btn");
const dropdown = document.getElementById("member-dropdown");

toggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdown.classList.toggle("active");
});
document.addEventListener("click", () => dropdown.classList.remove("active"));
dropdown.addEventListener("click", (e) => e.stopPropagation());

// Add Member Modal Logic (Re-adding since we overwrote the file)
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

// Delete Member (keeping from previous version)
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

  // Find max value for progress bars
  const maxSpent = Math.max(...summary.map(s => parseFloat(s.total_spent)), 1);

  summary.forEach(item => {
    const amount = parseFloat(item.total_spent);
    const percent = (amount / maxSpent) * 100;
    
    const row = document.createElement("div");
    row.style.marginBottom = "15px";
    
    row.innerHTML = `
      <div class="summary-row" style="border:none; padding-bottom:5px;">
        <div class="summary-name">
          <div class="small-avatar" style="width:30px; height:30px; font-size:0.8rem; background:${getAvatarColor(item.member_name)}">
            ${getInitials(item.member_name)}
          </div>
          ${item.member_name}
        </div>
        <div class="summary-amount">₹${amount.toFixed(2)}</div>
      </div>
      <div class="summary-bar-bg">
        <div class="summary-bar-fill" style="width: ${percent}%;"></div>
      </div>
    `;
    summaryList.appendChild(row);
  });
}
