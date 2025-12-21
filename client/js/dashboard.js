/* client/js/dashboard.js */

const chaptersGrid = document.getElementById("chapters-grid");
const createModal = document.getElementById("create-modal");
const createForm = document.getElementById("create-chapter-form");
const memberListContainer = document.getElementById("member-list-container");
const logoutBtn = document.getElementById("logout-btn");

// ==========================================
// ✅ STATE MANAGEMENT
// ==========================================
// ✅ NEW: Store data globally for sorting
let allChapters = []; 

let isEditMode = false;
let editChapterId = null;

// ✅ Updated skeleton loader: centered spinner
function renderSkeletons() {
  const grid = document.getElementById("chapters-grid");
  grid.innerHTML = `
    <div class="loader-container">
      <div class="spinner"></div>
    </div>
  `;
}

// ==========================================
// HELPER FUNCTIONS (NEW)
// ==========================================
function getInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

function getAvatarColor(name) {
  const colors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', 
    '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function timeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  if (diff < 2592000000) return Math.floor(diff / 86400000) + "d ago";
  return Math.floor(diff / 2592000000) + "mo ago";
}

document.addEventListener("DOMContentLoaded", async () => {
  renderSkeletons();

  // ==========================================
  // ✅ FIX: Inject Search & Sort Controls
  // ==========================================
  const controlsHtml = `
    <div style="
      display: flex; 
      gap: 15px; 
      margin-bottom: 25px; 
      flex-wrap: wrap; 
      align-items: center;
      width: 100%;
    ">
      <div style="position: relative; flex-grow: 1; min-width: 240px;">
        <span style="
          position: absolute; left: 15px; top: 50%; transform: translateY(-50%); 
          opacity: 0.5; font-size: 1.1rem; pointer-events: none;
        ">🔍</span>
        
        <input type="text" id="chapter-search" placeholder="Find a chapter... (Ctrl + K)" 
        style="
          width: 100%;
          padding: 12px 40px 12px 45px;
          border-radius: 12px; 
          border: 2px solid #eee; 
          font-family: var(--font-main);
          font-size: 0.95rem;
          background: #fff;
          transition: all 0.2s;
        ">
        
        <button id="search-clear-btn" style="
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: #eee; border: none; border-radius: 50%; width: 24px; height: 24px;
          cursor: pointer; display: none; align-items: center; justify-content: center;
          font-size: 0.8rem; color: #666;
        ">✕</button>
      </div>

      <div style="min-width: 160px;">
        <select id="chapter-sort" style="
          width: 100%;
          padding: 12px 15px;
          border-radius: 12px;
          border: 2px solid #eee;
          background: #fff;
          font-family: var(--font-main);
          font-size: 0.95rem;
          cursor: pointer;
        ">
          <option value="newest">📅 Newest First</option>
          <option value="oldest">📅 Oldest First</option>
          <option value="az">🔤 Name (A-Z)</option>
          <option value="members">👥 Most Members</option>
        </select>
      </div>
    </div>
  `;
  
  chaptersGrid.insertAdjacentHTML('beforebegin', controlsHtml);

  // --- LOGIC ---
  const searchInput = document.getElementById('chapter-search');
  const clearBtn = document.getElementById('search-clear-btn');
  const sortSelect = document.getElementById('chapter-sort');

  // Helper: Filter Visible Cards
  const runFilter = () => {
    const term = searchInput.value.toLowerCase();
    const cards = document.querySelectorAll('.chapter-card.card-content');
    
    cards.forEach(card => {
      const name = card.querySelector('.chapter-name').textContent.toLowerCase();
      card.style.display = name.includes(term) ? 'flex' : 'none';
    });
    
    if (clearBtn) clearBtn.style.display = term.length > 0 ? 'flex' : 'none';
  };

  // Helper: Sort Data & Re-render
  const runSort = () => {
    const criteria = sortSelect.value;
    
    // Create a copy to sort
    const sorted = [...allChapters];
    
    if (criteria === 'newest') {
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (criteria === 'oldest') {
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (criteria === 'az') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (criteria === 'members') {
      sorted.sort((a, b) => b.member_count - a.member_count);
    }
    
    // Re-render
    renderGrid(sorted);
    
    // Re-apply search filter if user had typed something
    runFilter(); 
  };

  // Event Listeners
  if (searchInput) {
    searchInput.addEventListener('input', runFilter);
    searchInput.addEventListener('focus', () => searchInput.style.borderColor = '#d000ff');
    searchInput.addEventListener('blur', () => searchInput.style.borderColor = '#eee');
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      runFilter();
      searchInput.focus();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', runSort);
  }

  // Keyboard Shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // --- DATA FETCHING ---
  const slowNetworkTimeout = setTimeout(() => {
    showToast("Server is waking up...", "info");
  }, 2500);

  // ✅ FIX: Character Counters
  const nameInput = createForm.querySelector('input[name="name"]');
  const descInput = createForm.querySelector('input[name="description"]');
  const nameCount = document.getElementById("name-count");
  const descCount = document.getElementById("desc-count");

  const updateCount = (input, display) => {
    display.textContent = input.value.length;
  };

  // Listeners
  if (nameInput && nameCount) {
    nameInput.addEventListener("input", () => updateCount(nameInput, nameCount));
  }
  if (descInput && descCount) {
    descInput.addEventListener("input", () => updateCount(descInput, descCount));
  }

  // SETUP VALIDATION FOR CREATE MODAL
  window.setupInlineValidation(nameInput, (value) => {
    if (!value.trim()) return "Chapter name is required.";
    if (value.length > 50) return "Name is too long (max 50 chars).";
    if (/[<>]/.test(value)) return "HTML characters (< >) are not allowed.";
    return null;
  });

  try {
    const [authData, chaptersData] = await Promise.all([
      apiFetch("/auth/me"),
      apiFetch("/chapters")
    ]);
    
    clearTimeout(slowNetworkTimeout);

    // ✅ FIX: Store data globally
    allChapters = chaptersData.chapters;
    renderGrid(allChapters);

  } catch (err) {
    clearTimeout(slowNetworkTimeout);
    console.error("Init failed", err);
    
    if (err.status === 401 || err.status === 403) {
      window.location.href = "login.html";
    } else {
      // ✅ FIX: Retry Button
      showToast("Failed to load data", "error", {
        label: "Retry ↻",
        callback: () => window.location.reload()
      });
    }
  }
});

// 2. Logout Logic
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      // ✅ FIX: Show spinner immediately
      setBtnLoading(logoutBtn, true);

      await apiFetch("/auth/logout", { method: "POST" });
      showToast("Logged out successfully", "success");

      // small delay to let them read the toast
      setTimeout(() => window.location.href = "login.html", 500);
    } catch(e) {
      // Even if it fails, redirect
      window.location.href = "login.html";
    } finally {
      // (Optional) Reset button if for some reason redirect didn't happen
      setBtnLoading(logoutBtn, false);
    }
  });
}

// ==========================================
// ✅ UNIFIED FORM SUBMISSION HANDLER
// ==========================================
createForm.onsubmit = async (e) => {
  e.preventDefault();

  // 1. GET BUTTON & DATA
  const submitBtn = createForm.querySelector('button[type="submit"]');
  const formData = new FormData(createForm);
  const name = formData.get("name");
  const description = formData.get("description");

  try {
    setBtnLoading(submitBtn, true);

    if (isEditMode) {
      // --- UPDATE EXISTING ---
      await apiFetch(`/chapters/${editChapterId}`, {
        method: "PUT",
        body: { name, description }
      });
      showToast("Chapter updated successfully", "success");
    } else {
      // --- CREATE NEW ---
      const members = [];
      document.querySelectorAll('input[name="members[]"]').forEach(input => {
        if(input.value.trim()) members.push(input.value.trim());
      });

      if(members.length === 0) {
        throw new Error("Please add at least one member.");
      }

      await apiFetch("/chapters", {
        method: "POST",
        body: { name, description, members }
      });
      showToast("Chapter created successfully!", "success");
    }

    closeModal();
    await reloadChaptersGrid();

  } catch (err) {
    showToast(err.message || "Operation failed", "error");
  } finally {
    setBtnLoading(submitBtn, false);
  }
};

// Helper to reload just the grid (used after creating a chapter)
async function reloadChaptersGrid() {
  renderSkeletons();
  try {
    const data = await apiFetch("/chapters");
    
    // ✅ FIX: Update global state and re-apply sort
    allChapters = data.chapters;
    
    // Trigger the sort logic manually to respect current dropdown selection
    const sortSelect = document.getElementById('chapter-sort');
    if (sortSelect) {
      sortSelect.dispatchEvent(new Event('change')); 
    } else {
      renderGrid(allChapters);
    }
    
  } catch (err) {
    showToast("Failed to refresh chapters", "error");
  }
}

// ==========================================
// ✅ UPDATED RENDERGRID FUNCTION (NEW VERSION)
// ==========================================
function renderGrid(chapters) {
  chaptersGrid.innerHTML = "";

  // 1. SCENARIO A: No Chapters (SVG Empty State)
  if (!chapters || chapters.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state-container";
    emptyState.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:15px">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <h3 class="empty-title">No chapters yet</h3>
      <p class="empty-subtitle">
        Create a chapter to start tracking expenses for a trip, a project, or your daily life.
      </p>
      <button class="btn-primary" onclick="openModal()" style="max-width:200px;">
        + Create First Chapter
      </button>
    `;
    chaptersGrid.appendChild(emptyState);
    return;
  }

  // 2. SCENARIO B: Has Chapters

  // "Add New" Card
  const addCard = document.createElement("div");
  addCard.className = "chapter-card card-add";
  addCard.onclick = openModal;
  addCard.setAttribute("role", "button");
  addCard.setAttribute("tabindex", "0");
  addCard.innerHTML = `
    <div class="plus-icon">+</div>
    <div style="margin-top:10px; font-weight:600; color:#888;">Create Chapter</div>
  `;
  addCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openModal();
  });
  chaptersGrid.appendChild(addCard);

  // User Chapters
  chapters.forEach((chapter) => {
    const card = document.createElement("div");
    card.className = "chapter-card card-content";
    card.style.position = "relative";

    const initials = getInitials(chapter.name);
    // ✅ FIX: Dynamic Color & Time
    const color = getAvatarColor(chapter.name);
    const timeString = timeAgo(chapter.created_at);

    card.innerHTML = `
      <div class="card-header-row">
        <div class="chapter-initials" style="background: ${color}; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 5px 15px ${color}40;">
          ${initials}
        </div>

        <button class="menu-btn" onclick="toggleMenu(event, '${chapter.id}')" aria-label="Open chapter menu">⋮</button>

        <div id="menu-${chapter.id}" class="menu-dropdown">
          <button class="menu-item" onclick="openEditModal('${chapter.id}', '${chapter.name}', '${chapter.description || ''}')">Edit</button>
          <button class="menu-item delete" onclick="confirmDelete('${chapter.id}')">Delete</button>
        </div>
      </div>

      <h3 class="chapter-name">${chapter.name}</h3>

      <div style="margin-top:auto; width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:#888;">
        <span>${chapter.member_count} members</span>
        <span>${timeString}</span>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.closest(".menu-dropdown")) return;
      window.location.href = `chapter.html?id=${chapter.id}`;
    });

    chaptersGrid.appendChild(card);
  });
}

// ==========================================
// ✅ UPDATED MODAL FUNCTIONS
// ==========================================

// 1. Open for CREATING (Reset everything)
window.openModal = function() {
  isEditMode = false;
  editChapterId = null;

  createForm.reset();

  // Show members section
  document.getElementById("member-list-container").style.display = "block";
  document.querySelector("button[type='button']").style.display = "inline-block";

  // Reset UI Text
  createModal.querySelector(".modal-header h2").textContent = "New Chapter";
  createForm.querySelector("button[type='submit']").textContent = "Create Chapter";

  // Reset member inputs to default (1 empty input)
  memberListContainer.innerHTML = "";
  addMemberInput();

  createModal.classList.add("active");

  // ✅ FIX: Focus the INPUT, not the box, for better accessibility
  setTimeout(() => {
    const firstInput = createForm.querySelector('input[name="name"]');
    if (firstInput) firstInput.focus();

    // Reset counters visually
    const nameCount = document.getElementById("name-count");
    const descCount = document.getElementById("desc-count");
    if (nameCount) nameCount.textContent = "0";
    if (descCount) descCount.textContent = "0";
  }, 100);
};

// 2. Open for EDITING
window.openEditModal = function(id, currentName, currentDesc) {
  isEditMode = true;
  editChapterId = id;

  // Populate form
  createForm.name.value = currentName;
  // Handle null/undefined description
  createForm.description.value = (currentDesc && currentDesc !== 'null') ? currentDesc : '';

  // Hide members section (Rename only)
  document.getElementById("member-list-container").style.display = "none";
  document.querySelector("button[type='button']").style.display = "none";

  // Update UI Text
  createModal.querySelector(".modal-header h2").textContent = "Edit Chapter";
  createForm.querySelector("button[type='submit']").textContent = "Save Changes";

  createModal.classList.add("active");
};

function closeModal() {
  createModal.classList.remove("active");
}

function addMemberInput() {
  const div = document.createElement("div");
  div.className = "member-item";
  div.innerHTML = `
    <input type="text" name="members[]" placeholder="Member Name (e.g. Alice)" required>
    <button type="button" onclick="this.parentElement.remove()" style="color:red; border:none; background:none; font-weight:bold; cursor:pointer;">✕</button>
  `;
  memberListContainer.appendChild(div);
}

/* ======================================
MODAL ACCESSIBILITY
====================================== */

// 1. Close on Escape Key
document.addEventListener('keydown', (e) => {
  if (e.key === "Escape" && createModal.classList.contains("active")) {
    closeModal();
  }
});

// 2. Close on Outside Click (Refined)
createModal.addEventListener("click", (e) => {
  // Only close if clicking the overlay itself (not the box inside)
  if (e.target === createModal) {
    closeModal();
  }
});

// ======================================
// EDIT & DELETE ACTIONS
// ======================================

// 1. Toggle the little menu
window.toggleMenu = function(e, id) {
  e.stopPropagation(); // Don't open chapter
  // Close all other menus
  document.querySelectorAll('.menu-dropdown').forEach(el => {
    if (el.id !== `menu-${id}`) el.classList.remove('active');
  });

  const menu = document.getElementById(`menu-${id}`);
  menu.classList.toggle('active');
};

// Close menus when clicking anywhere else
document.addEventListener('click', () => {
  document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.remove('active'));
});

/* client/js/dashboard.js - Delete Logic */

let deleteTargetId = null;
const deleteModal = document.getElementById("delete-modal");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

// 1. Open Modal
window.confirmDelete = function(id) {
  // Close the dropdown menu first
  document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.remove('active'));

  deleteTargetId = id;
  deleteModal.classList.add("active");
};

// 2. Close Modal
window.closeDeleteModal = function() {
  deleteModal.classList.remove("active");
  deleteTargetId = null;
};

// 3. Handle "Yes, Delete" Click
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", () => {
    if (!deleteTargetId) return;

    const id = deleteTargetId;
    closeDeleteModal(); // Close UI immediately

    performDeleteWithUndo(id);
  });
}

// 4. The "Undo" Logic
function performDeleteWithUndo(id) {
  // A. Visually hide the card immediately (Optimistic UI)
  // We will schedule the API call
  let isUndoClicked = false;

  // Show Toast with Undo
  showToast("Chapter deleted", "info", {
    label: "UNDO ↩️",
    callback: () => {
      isUndoClicked = true;
      showToast("Deletion cancelled", "success");
      // No visual change needed if we didn't touch DOM,
      // but if we hid it, we would show it back.
      // Since we haven't touched DOM yet, we just don't run the API call.
    }
  });

  // B. Wait 4 seconds. If no Undo, kill it.
  setTimeout(async () => {
    if (!isUndoClicked) {
      try {
        await apiFetch(`/chapters/${id}`, { method: "DELETE" });
        // NOW we remove it from screen (Refresh Grid)
        reloadChaptersGrid();
      } catch (err) {
        showToast("Failed to delete", "error");
      }
    }
  }, 4000);
}

// ✅ NEW: Focus Trap for Modals
function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll(
    'a[href], button, textarea, input, select'
  );
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  modal.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) { /* Shift + Tab */
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else { /* Tab */
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  });
}

// Attach to existing openModal
const originalOpenModal = window.openModal;
window.openModal = function() {
  originalOpenModal(); // Call the old one
  trapFocus(document.getElementById('create-modal'));
};
