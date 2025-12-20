/* client/js/dashboard.js */

const chaptersGrid = document.getElementById("chapters-grid");
const createModal = document.getElementById("create-modal");
const createForm = document.getElementById("create-chapter-form");
const memberListContainer = document.getElementById("member-list-container");
const logoutBtn = document.getElementById("logout-btn");

// ==========================================
// ✅ STATE MANAGEMENT
// ==========================================
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

document.addEventListener("DOMContentLoaded", async () => {
  renderSkeletons(); // Show placeholders immediately

  // ==========================================
  // ✅ FIX 1: Client-Side Search
  // ==========================================
  // Inject Search Bar HTML dynamically above the grid
  const searchHtml = `
    <div style="margin-bottom: 25px; position: relative; max-width: 400px; width: 100%;">
      <input type="text" id="chapter-search" placeholder="🔍 Find a chapter..." 
      style="
        width: 100%;
        padding: 12px 15px 12px 40px; 
        border-radius: 12px; 
        border: 2px solid #eee; 
        font-family: var(--font-main);
        font-size: 0.95rem;
        background: #fff;
        transition: border-color 0.2s;
      ">
      <span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5;"></span>
    </div>
  `;
  
  // Insert before the grid container
  chaptersGrid.insertAdjacentHTML('beforebegin', searchHtml);
  
  // Attach Search Logic
  const searchInput = document.getElementById('chapter-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const cards = document.querySelectorAll('.chapter-card.card-content');
      
      cards.forEach(card => {
        const name = card.querySelector('.chapter-name').textContent.toLowerCase();
        // Simple filter: Show if name contains term, else hide
        card.style.display = name.includes(term) ? 'flex' : 'none';
      });
    });
  }

  // ==========================================
  // ✅ FIX 2: Cold Start Feedback
  // ==========================================
  // If data hasn't loaded in 2.5 seconds, tell the user the server is waking up
  const slowNetworkTimeout = setTimeout(() => {
    showToast("Server is waking up... please wait about 20s", "info");
  }, 2500);

  // SETUP VALIDATION FOR CREATE MODAL
  const nameInput = createForm.querySelector('input[name="name"]');
  window.setupInlineValidation(nameInput, (value) => {
    if (!value.trim()) return "Chapter name is required.";
    if (value.length > 50) return "Name is too long (max 50 chars).";
    if (/[<>]/.test(value)) return "HTML characters (< >) are not allowed.";
    return null; 
  });

  try {
    // Fire both requests
    const [authData, chaptersData] = await Promise.all([
      apiFetch("/auth/me"),
      apiFetch("/chapters")
    ]);

    // Data loaded! Cancel the "Slow Network" warning
    clearTimeout(slowNetworkTimeout);

    renderGrid(chaptersData.chapters);

  } catch (err) {
    clearTimeout(slowNetworkTimeout); // Cancel warning on error too
    console.error("Init failed", err);
    
    if (err.status === 401 || err.status === 403) {
      window.location.href = "login.html";
    } else {
      showToast("Failed to load data. Please refresh.", "error");
    }
  }
});

// 2. Logout Logic
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try { 
      await apiFetch("/auth/logout", { method: "POST" }); 
      showToast("Logged out successfully", "success");
      setTimeout(() => window.location.href = "login.html", 500);
    } catch(e) {
      window.location.href = "login.html";
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
    renderGrid(data.chapters);
  } catch (err) {
    showToast("Failed to refresh chapters", "error");
  }
}

function getInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

// 3. Render the Grid (UPDATED WITH MENU BUTTONS)
function renderGrid(chapters) {
  chaptersGrid.innerHTML = "";

  // SCENARIO A: No Chapters -> Show Beautiful Empty State
  if (!chapters || chapters.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state-container";
    emptyState.innerHTML = `
      <div class="empty-icon">📂</div>
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

  // SCENARIO B: Has Chapters -> Show Grid (Add Button + Content)
  
  // 1. "Add New" Card
  const addCard = document.createElement("div");
  addCard.className = "chapter-card card-add";
  addCard.onclick = openModal;
  // Make it accessible
  addCard.setAttribute("role", "button");
  addCard.setAttribute("tabindex", "0");
  addCard.innerHTML = `
    <div class="plus-icon">+</div>
    <div style="margin-top:10px; font-weight:600; color:#888;">Create Chapter</div>
  `;
  // Add keyboard support for the card
  addCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openModal();
  });
  
  chaptersGrid.appendChild(addCard);

  // 2. Render User Chapters WITH MENU BUTTONS
  chapters.forEach((chapter) => {
    // CHANGE: Use DIV, not A tag, so we can handle clicks manually
    const card = document.createElement("div"); 
    card.className = "chapter-card card-content";
    card.style.position = "relative"; // Needed for dropdown positioning

    const initials = getInitials(chapter.name);

    card.innerHTML = `
      <div class="card-header-row">
        <div class="chapter-initials">${initials}</div>
        
        <button class="menu-btn" onclick="toggleMenu(event, '${chapter.id}')">⋮</button>
        
        <div id="menu-${chapter.id}" class="menu-dropdown">
          <button class="menu-item" onclick="openEditModal('${chapter.id}', '${chapter.name}', '${chapter.description || ''}')">Edit</button>
          <button class="menu-item delete" onclick="confirmDelete('${chapter.id}')">Delete</button>
        </div>
      </div>

      <h3 class="chapter-name">${chapter.name}</h3>
      ${chapter.member_count ? `<small style="color:#666;">${chapter.member_count} members</small>` : ''}
    `;

    // Make the whole card clickable (Navigate to Chapter)
    card.addEventListener("click", (e) => {
      // Don't navigate if we clicked a button or menu item
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
  // Focus for accessibility
  setTimeout(() => createModal.querySelector(".modal-box").focus(), 100);
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

// 2. DELETE Logic
window.confirmDelete = async function(id) {
  if (confirm("Are you sure you want to delete this chapter? This cannot be undone.")) {
    try {
      await apiFetch(`/chapters/${id}`, { method: "DELETE" });
      showToast("Chapter deleted", "success");
      reloadChaptersGrid(); // Refresh grid
    } catch (err) {
      showToast("Failed to delete", "error");
    }
  }
};
