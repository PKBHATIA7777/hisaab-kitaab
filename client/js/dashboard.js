/* client/js/dashboard.js */

const chaptersGrid = document.getElementById("chapters-grid");
const createModal = document.getElementById("create-modal");
const createForm = document.getElementById("create-chapter-form");
const memberListContainer = document.getElementById("member-list-container");
const logoutBtn = document.getElementById("logout-btn");

function renderSkeletons() {
  chaptersGrid.innerHTML = "";
  
  // Render 4 skeleton cards to simulate content
  for (let i = 0; i < 4; i++) {
    const div = document.createElement("div");
    div.className = "chapter-card skeleton skeleton-card";
    chaptersGrid.appendChild(div);
  }
}

// 1. OPTIMIZED INIT: Fetch Auth & Data in Parallel
document.addEventListener("DOMContentLoaded", async () => {
  renderSkeletons(); // Show placeholders immediately

  // SETUP VALIDATION FOR CREATE MODAL
  const nameInput = createForm.querySelector('input[name="name"]');
  
  // Define rules
  window.setupInlineValidation(nameInput, (value) => {
    if (!value.trim()) return "Chapter name is required.";
    if (value.length > 50) return "Name is too long (max 50 chars).";
    if (/[<>]/.test(value)) return "HTML characters (< >) are not allowed.";
    return null; // Valid
  });

  try {
    // Fire both requests at the same time
    const [authData, chaptersData] = await Promise.all([
      apiFetch("/auth/me"),
      apiFetch("/chapters")
    ]);

    // If we get here, Auth is good.
    renderGrid(chaptersData.chapters);

  } catch (err) {
    console.error("Init failed", err);
    // If auth failed, redirect. If chapters failed, show error.
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

function openModal() {
  createModal.classList.add("active");
  createForm.reset();
  memberListContainer.innerHTML = "";
  addMemberInput();
}

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

// 6. Handle Create Submission
createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // 1. GET BUTTON
  const submitBtn = createForm.querySelector('button[type="submit"]');

  const formData = new FormData(createForm);
  const name = formData.get("name");
  const description = formData.get("description");
  
  const members = [];
  document.querySelectorAll('input[name="members[]"]').forEach(input => {
    if(input.value.trim()) members.push(input.value.trim());
  });

  if(members.length === 0) {
    showToast("Please add at least one member.", "error");
    return;
  }

  try {
    // 2. START LOADING (Replaces manual text change)
    setBtnLoading(submitBtn, true);

    await apiFetch("/chapters", {
      method: "POST",
      body: { name, description, members }
    });
    
    closeModal();
    // Use the reload helper from Step 18
    await reloadChaptersGrid(); 
    showToast("Chapter created successfully!", "success");

  } catch (err) {
    showToast(err.message || "Failed to create chapter", "error");
  } finally {
    // 3. STOP LOADING
    setBtnLoading(submitBtn, false);
  }
});

/* ======================================
   MODAL ACCESSIBILITY (STEP 19)
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

// 3. EDIT Logic (Re-uses the Create Modal)
window.openEditModal = function(id, currentName, currentDesc) {
  // Populate the form
  const form = document.getElementById("create-chapter-form");
  form.name.value = currentName;
  form.description.value = currentDesc;
  
  // Hide members input (Simpler to just allow renaming for now)
  document.getElementById("member-list-container").style.display = "none";
  document.querySelector("button[type='button']").style.display = "none"; // Hide "Add Member" btn
  
  // Change Button Text
  const btn = form.querySelector("button[type='submit']");
  btn.textContent = "Save Changes";
  
  // Hijack the submit event
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      setBtnLoading(btn, true);
      await apiFetch(`/chapters/${id}`, {
        method: "PUT",
        body: { 
          name: form.name.value, 
          description: form.description.value 
        }
      });
      closeModal();
      showToast("Chapter updated", "success");
      reloadChaptersGrid();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btn, false);
    }
  };
  
  openModal();
};

// Reset Modal logic when closing (so "Create New" works again)
const originalOpenModal = window.openModal;
window.openModal = function() {
  // Reset form to "Create Mode"
  const form = document.getElementById("create-chapter-form");
  form.reset();
  form.onsubmit = null; // Remove hijack (will revert to default listener)
  
  // Show members again
  document.getElementById("member-list-container").style.display = "block";
  document.querySelector("button[type='button']").style.display = "inline-block";
  form.querySelector("button[type='submit']").textContent = "Create Chapter";
  
  // Call original logic (show overlay)
  createModal.classList.add("active");
  setTimeout(() => createModal.querySelector(".modal-box").focus(), 100);
};
