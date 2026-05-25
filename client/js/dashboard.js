/* client/js/dashboard.js */

const chaptersGrid = document.getElementById("chapters-grid");
const createModal = document.getElementById("create-modal");
const createForm = document.getElementById("create-chapter-form");
const memberListContainer = document.getElementById("member-list-container");

// ==========================================
// ✅ STATE MANAGEMENT
// ==========================================
let allChapters = [];
let isEditMode = false;
let editChapterId = null;
let currentUser = null; // ✅ NEW: Store global user
let cachedFriends = []; // ✅ NEW: Cache friends
let myFriends = [];     // ✅ Moved here for global access
let showingArchived = false; // ✅ CHANGE 2: Archived toggle state

// ✅ NEW: Track who we are looking at in friend details
let currentViewFriendId = null;

// 👇 NEW: Placeholder Animation State
let placeholderInterval = null;
const placeholderSuggestions = [
  "e.g. College Friends Group",  // 1. Suggest Long-term Group
  "e.g. Goa Trip 2025",          // 2. Suggest Event
  "e.g. Flatmates 404",          // 3. Suggest Household
  "e.g. Office Lunch Crew"       // 4. Suggest Daily Life
];

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
// HELPER FUNCTIONS
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

  // AUTH-09 FIX: Soft banner then redirect on cross-tab logout
  if (typeof SessionManager !== 'undefined' && SessionManager.on) {
    SessionManager.on('logout', () => {
      // Show a non-intrusive banner before redirecting
      const banner = document.createElement('div');
      banner.style.cssText = `
        position:fixed; top:0; left:0; width:100%; z-index:99999;
        background:#333; color:#fff; text-align:center;
        padding:12px 16px; font-family:var(--font-main); font-size:0.9rem;
        font-weight:500; letter-spacing:0.2px;
        animation: slideDown 0.3s ease;
      `;
      banner.textContent = "You've been logged out from another tab. Redirecting...";
      document.body.prepend(banner);
      setTimeout(() => {
        window.location.replace("login.html?expired=true");
      }, 2500);
    });
  }

  // ✅ NEW: Fetch Friends in background for autocomplete
  try {
    const fData = await apiFetch("/friends");
    cachedFriends = fData.friends || [];
  } catch(e) { console.warn("Failed to preload friends"); }

  // ==========================================
  // ✅ STEP 3: Professional Toolbar Injection (UPDATED)
  // ==========================================
  const controlsHtml = `
    <div class="dashboard-toolbar">
      <div class="toolbar-search">
        <span class="search-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
        
        <input type="text" id="chapter-search" placeholder="Search chapters..." autocomplete="off">
        
        <span class="shortcut-badge">Ctrl K</span>
        
        <button id="search-clear-btn" class="search-clear" aria-label="Clear search">✕</button>
      </div>

      <div class="toolbar-sort">
        <select id="chapter-sort">
          <option value="last_opened" selected>🕐 Recently Opened</option>
          <option value="newest">📅 Newest First</option>
          <option value="oldest">📅 Oldest First</option>
          <option value="az">🔤 Name (A-Z)</option>
          <option value="members">👥 Members</option>
        </select>
        <span class="sort-arrow">▼</span>
      </div>
      
      <!-- ✅ CHANGE 1: Archived toggle button -->
      <button id="btn-show-archived" 
        style="padding:10px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.9); font-family:var(--font-main); font-size:0.9rem; cursor:pointer; color:#555; white-space:nowrap;">
        🗃️ Archived
      </button>
    </div>
  `;
  
  chaptersGrid.insertAdjacentHTML('beforebegin', controlsHtml);

  // --- LOGIC ---
  const searchInput = document.getElementById('chapter-search');
  const clearBtn = document.getElementById('search-clear-btn');
  const sortSelect = document.getElementById('chapter-sort');

  // ✅ CHANGE 3: Wire up the Archived toggle button
  const archivedBtn = document.getElementById('btn-show-archived');
  if (archivedBtn) {
    archivedBtn.addEventListener('click', async () => {
      showingArchived = !showingArchived;
      archivedBtn.textContent = showingArchived ? '📋 Active' : '🗃️ Archived';
      archivedBtn.style.background = showingArchived ? 'rgba(208,0,255,0.1)' : 'rgba(255,255,255,0.9)';
      archivedBtn.style.borderColor = showingArchived ? '#d000ff' : 'rgba(255,255,255,0.2)';
      archivedBtn.style.color = showingArchived ? '#d000ff' : '#555';
      await reloadChaptersGrid();
    });
  }

  // ✅ FIX P2: Enhanced runFilter with empty state handling & mobile optimization
  const runFilter = () => {
    const term = searchInput.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.chapter-card.card-content');
    let visibleCount = 0;

    cards.forEach(card => {
      const name = card.querySelector('.chapter-name').textContent.toLowerCase();
      const match = name.includes(term);
      card.style.display = match ? 'flex' : 'none';
      if (match) visibleCount++;
    });
    
    // Toggle Clear Button
    if (clearBtn) clearBtn.style.display = term.length > 0 ? 'flex' : 'none';

    // ✅ FIX U8: Show "No Results" message
    const emptyState = document.querySelector('.empty-state-container');
    const noResultsMsg = document.getElementById('no-search-results');
    
    if (visibleCount === 0 && term.length > 0) {
       // Hide normal empty state if it exists
       if(emptyState) emptyState.style.display = 'none';
       
       // Create temp "No Results" if missing
       if(!noResultsMsg) {
         const msg = document.createElement('div');
         msg.id = 'no-search-results';
         msg.style.cssText = 'text-align: center; padding: 40px; color: #888; grid-column: 1 / -1;';
         msg.innerHTML = `<p>No chapters found for "<b>${term}</b>"</p>`;
         chaptersGrid.appendChild(msg);
       } else {
         noResultsMsg.style.display = 'block';
         noResultsMsg.innerHTML = `<p>No chapters found for "<b>${term}</b>"</p>`;
       }
    } else {
       if(noResultsMsg) noResultsMsg.style.display = 'none';
       // Re-show empty state if we really have 0 chapters total
       if(visibleCount === 0 && term.length === 0 && emptyState) {
         emptyState.style.display = 'flex';
       }
    }
  };

  // ✅ FIX P2: Debounce Search (Wait 300ms before filtering) - Uses global debounce from main.js
  if (searchInput) {
    searchInput.addEventListener('input', debounce(runFilter, 300));
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
    // ✅ CHANGE 2: Add last_opened sort case
    else if (criteria === 'last_opened') {
      sorted.sort((a, b) => {
        const aTime = a.last_opened_at ? new Date(a.last_opened_at) : new Date(a.created_at);
        const bTime = b.last_opened_at ? new Date(b.last_opened_at) : new Date(b.created_at);
        return bTime - aTime; // Most recent first
      });
    }
    
    // Re-render
    renderGrid(sorted);
    
    // Re-apply search filter if user had typed something
    runFilter(); 
  };

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
    
    // ✅ NEW: Capture User Data & Render Profile Icon
    currentUser = authData.user;
    renderProfileIcon();

    clearTimeout(slowNetworkTimeout);

    // ✅ FIX: Store data globally
    allChapters = chaptersData.chapters;
    
    // ✅ CHANGE 3: Trigger default sort immediately so the default applies on load
    // Removed standalone renderGrid(allChapters) - runSort calls renderGrid internally
    const sortSelectEl = document.getElementById('chapter-sort');
    if (sortSelectEl) sortSelectEl.dispatchEvent(new Event('change'));

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

      // Check if creator is included (creator row checkbox)
      const creatorCheckbox = memberListContainer.querySelector('#creator-checkbox');
      const creatorIncluded = creatorCheckbox ? creatorCheckbox.checked : true;

      // Collect additional members from smart inputs
      const members = [];
      const inputs = memberListContainer.querySelectorAll('.member-input-smart');
      
      inputs.forEach(input => {
        const nameVal = input.value.trim();
        if (nameVal) {
          let friendId = input.dataset.friendId ? parseInt(input.dataset.friendId) : null;
          
          // 🟢 Auto-link to friend if name matches exactly (and ID was missing)
          if (!friendId && cachedFriends.length > 0) {
             const match = cachedFriends.find(f => 
               f.name.toLowerCase() === nameVal.toLowerCase() || 
               f.username.toLowerCase() === nameVal.toLowerCase()
             );
             if (match) {
               friendId = match.id;
               console.log(`Auto-linked "${nameVal}" to Friend ID: ${friendId}`);
             }
          }

          members.push({ 
            name: nameVal,
            friendId: friendId 
          });
        }
      });

      // Enforce minimum one member: creator must be included OR at least one extra member added
      if (!creatorIncluded && members.length === 0) {
        showToast("A chapter needs at least one member. Either include yourself or add someone.", "error");
        setBtnLoading(submitBtn, false);
        return;
      }

      await apiFetch("/chapters", {
        method: "POST",
        body: { name, description, members, creatorExcluded: !creatorIncluded }
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
    // ✅ CHANGE 4: Pass archived param based on toggle state
    const url = showingArchived ? "/chapters?archived=true" : "/chapters";
    const data = await apiFetch(url);
    
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
// ✅ RENDERGRID FUNCTION
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
  addCard.setAttribute("aria-label", "Create new chapter");
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
    // ✅ PATCH A APPLIED: Store chapter ID as data attribute
    card.dataset.chapterId = chapter.id;

    const initials = getInitials(chapter.name);
    const color = getAvatarColor(chapter.name);
    const timeString = timeAgo(chapter.created_at);

    // ✅ CHANGE 5: Updated menu dropdown with archive/unarchive option
    card.innerHTML = `
      <div class="card-header-row">
        <div class="chapter-initials" style="background: ${color}; color: #fff; box-shadow: 0 5px 15px ${color}40;">
          ${initials}
        </div>

        <button class="menu-btn" onclick="toggleMenu(event, '${chapter.id}')" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
        </button>

        <div id="menu-${chapter.id}" class="menu-dropdown">
          <button class="menu-item" onclick="openEditModal('${chapter.id}', '${chapter.name}', '${chapter.description || ''}')">Edit</button>
          <button class="menu-item" onclick="toggleArchive('${chapter.id}', ${chapter.is_archived})">${chapter.is_archived ? '📋 Restore' : '✅ Mark Settled'}</button>
          <button class="menu-item delete" onclick="confirmDelete('${chapter.id}')">Delete</button>
        </div>
      </div>

      <h3 class="chapter-name">${chapter.name}</h3>

      <div class="card-footer">
        <span>${chapter.member_count} members</span>
        <span>${timeString}</span>
      </div>
    `;

    // ✅ CHANGE 7: Add visual indicator for archived chapters
    if (chapter.is_archived) {
      card.style.opacity = "0.75";
      card.style.borderLeft = "3px solid #d000ff";
    }

    card.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.closest(".menu-dropdown")) return;
      window.location.href = `chapter.html?id=${chapter.id}`;
    });

    chaptersGrid.appendChild(card);
  });
}

// ==========================================
// ✅ MODAL FUNCTIONS (UPDATED WITH PLACEHOLDER)
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

  // Reset member inputs and pre-add the current user (creator)
  memberListContainer.innerHTML = "";
  _addCreatorRow();

  createModal.classList.add("active");

  // 👇 START PLACEHOLDER ANIMATION
  const input = createForm.querySelector('input[name="name"]');
  if (input) {
    let index = 0;
    input.setAttribute("placeholder", placeholderSuggestions[0]);
    
    // Clear any existing interval
    if (placeholderInterval) clearInterval(placeholderInterval);
    
    placeholderInterval = setInterval(() => {
      index = (index + 1) % placeholderSuggestions.length;
      input.setAttribute("placeholder", placeholderSuggestions[index]);
    }, 2500);

    setTimeout(() => {
      input.focus();

      // Reset counters visually
      const nameCount = document.getElementById("name-count");
      const descCount = document.getElementById("desc-count");
      if (nameCount) nameCount.textContent = "0";
      if (descCount) descCount.textContent = "0";
    }, 100);
  }
};

// 2. Open for EDITING
window.openEditModal = function(id, currentName, currentDesc) {
  isEditMode = true;
  editChapterId = id;

  // Stop animation if running
  if (placeholderInterval) clearInterval(placeholderInterval);

  // Populate form
  createForm.name.value = currentName;
  createForm.description.value = (currentDesc && currentDesc !== 'null') ? currentDesc : '';
  createForm.name.setAttribute("placeholder", "Chapter Name"); // Reset to static

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
  // 👇 Stop Animation on Close
  if (placeholderInterval) {
    clearInterval(placeholderInterval);
    placeholderInterval = null;
  }
}

// ── Creator row (pre-added, toggleable) ──────────────────────
function _addCreatorRow() {
  if (!currentUser) return; // Guard: user not loaded yet

  const div = document.createElement("div");
  div.className = "member-item creator-row";
  div.style.cssText = "position:relative; display:flex; align-items:center; gap:10px;";
  div.dataset.isCreator = "true";

  // Tick / untick checkbox
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.id = "creator-checkbox";
  checkbox.style.cssText = "width:18px; height:18px; accent-color:#d000ff; cursor:pointer; flex-shrink:0;";
  checkbox.title = "Uncheck to exclude yourself from this chapter";

  // Label showing the creator's name
  const label = document.createElement("label");
  label.htmlFor = "creator-checkbox";
  label.textContent = currentUser.real_name || currentUser.username || "You";
  label.style.cssText = "flex:1; font-weight:600; color:#d000ff; cursor:pointer; user-select:none;";

  const badge = document.createElement("span");
  badge.textContent = "You";
  badge.style.cssText = "font-size:0.7rem; background:rgba(208,0,255,0.15); color:#d000ff; border:1px solid rgba(208,0,255,0.3); border-radius:20px; padding:2px 8px; flex-shrink:0;";

  div.appendChild(checkbox);
  div.appendChild(label);
  div.appendChild(badge);
  memberListContainer.appendChild(div);
}

// ✅ UPDATED: Add Smart Input (auto-focuses new row)
window.addMemberInput = function() {
  const div = document.createElement("div");
  div.className = "member-item";
  div.style.position = "relative"; // Context for dropdown
  
  // 1. Create the Input
  const input = document.createElement("input");
  input.type = "text";
  input.className = "member-input-smart"; // Marker class
  input.placeholder = "Name (or select friend)";
  input.autocomplete = "off"; // Disable browser autocomplete

  // 2. Delete Button
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerHTML = "✕";
  btn.style.cssText = "color:red; border:none; background:none; font-weight:bold; cursor:pointer; position:absolute; right:10px; top:12px; z-index:10;";
  btn.onclick = () => {
    // Clean up autocomplete instance before removing
    if (input._autocomplete) input._autocomplete.destroy();
    div.remove();
  };

  div.appendChild(input);
  div.appendChild(btn);
  memberListContainer.appendChild(div);

  // 3. Attach Autocomplete
  const ac = new MemberAutocomplete(input, {
    friends: cachedFriends,
    onSelect: (result) => {
      // Optional: Add visual feedback (Green border if friend selected)
      if (result.type === 'friend') {
        input.style.borderColor = "#00e676";
        input.dataset.friendId = result.id;
      } else {
        input.style.borderColor = "#eee";
        delete input.dataset.friendId;
      }
    }
  });
  input._autocomplete = ac; // Store reference for cleanup

  // 4. Auto-focus so user can start typing immediately
  setTimeout(() => input.focus(), 0);
};

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
  if (e.target === createModal) {
    closeModal();
  }
});

// ======================================
// EDIT & DELETE ACTIONS
// ======================================

// 1. Toggle the little menu
window.toggleMenu = function(e, id) {
  e.stopPropagation();
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

/* Delete Logic */
let deleteTargetId = null;
const deleteModal = document.getElementById("delete-modal");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

// 1. Open Modal
window.confirmDelete = function(id) {
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
    closeDeleteModal();

    performDeleteWithUndo(id);
  });
}

// 4. The "Undo" Logic — ✅ STEP 3.4: Fixed with beforeunload guarantee
function performDeleteWithUndo(id) {
  let isUndoClicked = false;
  let deleteExecuted = false;

  const executeDelete = async () => {
    if (isUndoClicked || deleteExecuted) return;
    deleteExecuted = true;
    try {
      await apiFetch(`/chapters/${id}`, { method: "DELETE" });
      reloadChaptersGrid();
    } catch (err) {
      showToast("Failed to delete chapter", "error");
    }
  };

  // Handle page navigation/close — execute delete immediately
  const beforeUnloadHandler = (e) => {
    if (!isUndoClicked && !deleteExecuted) {
      // Send a synchronous beacon so delete fires even on tab close
      const csrfToken = window.__csrfToken || 
        document.cookie.split("; ").find(r => r.startsWith("csrf_token="))?.split("=")[1] || "";
      navigator.sendBeacon(
        `/api/chapters/${id}/beacon-delete`,
        new Blob([JSON.stringify({ _beacon: true })], { type: "application/json" })
      );
    }
    window.removeEventListener("beforeunload", beforeUnloadHandler);
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);

  showToast("Chapter deleted", "info", {
    label: "UNDO ↩️",
    callback: () => {
      isUndoClicked = true;
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      showToast("Deletion cancelled", "success");
      reloadChaptersGrid();
    }
  });

  setTimeout(() => {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    executeDelete();
  }, 5000);
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
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  });
}

const originalOpenModal = window.openModal;
window.openModal = function() {
  originalOpenModal();
  trapFocus(document.getElementById('create-modal'));
};

// ==========================================
// ✅ PROFILE & LOGOUT LOGIC
// ==========================================
function renderProfileIcon() {
  const iconEl = document.getElementById("header-profile-icon");
  if (!iconEl || !currentUser) return;

  const baseName = currentUser.realName || currentUser.username || "";
  const initials = getInitials(baseName);
  const color = getAvatarColor(baseName);
  
  iconEl.textContent = initials;
  iconEl.style.background = color;
  iconEl.style.boxShadow = `0 0 15px ${color}60`; // Glow effect
}

window.openProfileModal = function() {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;

  // Fill User Data
  if (currentUser) {
    document.getElementById("profile-realname").textContent = currentUser.realName;
    document.getElementById("profile-username").textContent = `@${currentUser.username}`;
    
    const avatar = document.getElementById("profile-avatar");
    avatar.textContent = getInitials(currentUser.realName);
    avatar.style.background = getAvatarColor(currentUser.realName);
  }

  // ✅ NEW: Load Friends List

  // Ensure we start in list mode (not stuck in edit mode)
// Load Friends List
  loadFriends();
  // Ensure we start in list mode (not stuck in edit mode)
  window.cancelFriendEdit();

  // Update profile install hint
  updateProfileInstallHint();

  modal.classList.add("active");
};

window.closeProfileModal = function() {
  const modal = document.getElementById("profile-modal");
  if (modal) modal.classList.remove("active");
};

// ==========================================
// ✅ STEP 1.4 — Add profile install handler in dashboard.js
// ==========================================
// PWA Install from profile
window.handleProfileInstallClick = function() {
  if (!window.PWAInstall) return;
  const config = window.PWAInstall.getConfig();
  
  if (config.type === 'installed') {
    showToast('App is already installed!', 'success');
    return;
  }
  
  if (config.canInstallDirectly && window.PWAInstall.detect && 
      !window.PWAInstall.detect.isStandalone) {
    window.PWAInstall.triggerInstall();
  } else {
    // Close profile modal first, then show guide
    closeProfileModal();
    setTimeout(() => window.PWAInstall.showGuide(), 200);
  }
};

// Update the profile install hint text when profile opens
function updateProfileInstallHint() {
  const hintEl = document.getElementById('profile-install-hint');
  const sectionEl = document.getElementById('profile-install-section');
  
  if (!window.PWAInstall || !hintEl || !sectionEl) return;
  
  if (window.PWAInstall.detect.isStandalone) {
    sectionEl.style.display = 'none';
    return;
  }
  
  sectionEl.style.display = '';
  const detect = window.PWAInstall.detect;
  
  if (detect.isIOS) {
    hintEl.textContent = 'Add to your iPhone/iPad home screen for offline access';
  } else if (detect.isAndroid) {
    hintEl.textContent = 'Install for a native app-like experience';
  } else {
    hintEl.textContent = 'Install on your computer for quick access';
  }
}

// Re-bind Logout (since ID changed to logout-btn-profile)
const profileLogoutBtn = document.getElementById("logout-btn-profile");
if (profileLogoutBtn) {
  profileLogoutBtn.addEventListener("click", async () => {
    await showLogoutDeviceScreen();
  });
}

async function showLogoutDeviceScreen() {
  // Fetch active devices
  let sessions = [];
  try {
    const data = await apiFetch("/auth/devices");
    sessions = data.sessions || [];
  } catch(_) {}
  
  // If only 1 session (current device), just log out directly
  if (sessions.length <= 1) {
    try {
      setBtnLoading(profileLogoutBtn, true);
      closeProfileModal();
      await apiFetch("/auth/logout", { method: "POST" });
    } catch(_) {}
    // Clear in-memory API cache on logout
    if (window.ApiCache) window.ApiCache.clear();
    // Notify other tabs
    SessionManager.broadcastLogout({ reason: 'manual' });
    window.location.replace("login.html");
    return;
  }
  
  // Multiple sessions — show device selection modal
  const existingModal = document.getElementById('device-logout-modal');
  if (existingModal) existingModal.remove();
  
  const deviceIcon = { mobile: '📱', tablet: '📱', desktop: '💻' };
  
  const modal = document.createElement('div');
  modal.id = 'device-logout-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px;">
      <div class="modal-header">
        <h2>Log Out</h2>
        <button class="close-modal" onclick="document.getElementById('device-logout-modal').remove()">×</button>
      </div>
      <p style="color:#666; font-size:0.9rem; margin-bottom:20px;">
        You're logged in on ${sessions.length} device${sessions.length > 1 ? 's' : ''}. 
        What would you like to do?
      </p>
      <div style="margin-bottom:20px;">
        ${sessions.map(s => `
          <div style="display:flex; align-items:center; gap:12px; padding:12px; 
                      background:${s.isCurrent ? '#f0f0ff' : '#f9f9f9'}; 
                      border-radius:10px; margin-bottom:8px;
                      border:${s.isCurrent ? '1.5px solid #d000ff' : '1px solid #eee'};">
            <span style="font-size:1.5rem;">${deviceIcon[s.device_type] || '💻'}</span>
            <div style="flex:1;">
              <div style="font-weight:600; font-size:0.9rem; color:#333;">
                ${escapeHTML(s.device_name)}
                ${s.isCurrent ? '<span style="font-size:0.7rem; color:#d000ff; margin-left:6px; background:rgba(208,0,255,0.1); padding:2px 6px; border-radius:4px;">This device</span>' : ''}
              </div>
              <div style="font-size:0.75rem; color:#888;">
                Last active: ${new Date(s.last_active_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <button class="btn-primary" onclick="handleDeviceLogout('current')" 
          style="background:#000;">
          Log out this device only
        </button>
        <button class="btn-secondary" onclick="handleDeviceLogout('all')"
          style="color:#ff1744; border-color:#ffcdd2;">
          Log out all devices
        </button>
        <button class="btn-secondary" onclick="document.getElementById('device-logout-modal').remove()"
          style="border:none; color:#666;">
          Cancel
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

window.handleDeviceLogout = async function(scope) {
  const modal = document.getElementById('device-logout-modal');
  const btn = modal?.querySelector(`button[onclick="handleDeviceLogout('${scope}')"]`);
  if (btn) setBtnLoading(btn, true);
  
  try {
    if (scope === 'all') {
      await apiFetch("/auth/logout?all=true", { method: "POST" });
      SessionManager.broadcastLogout({ reason: 'all_devices' });
    } else {
      await apiFetch("/auth/logout", { method: "POST" });
      SessionManager.broadcastLogout({ reason: 'current_device' });
    }
} catch(_) {}

// Clear in-memory API cache on logout
if (window.ApiCache) window.ApiCache.clear();

// Clear remembered identifier from this device
try { localStorage.removeItem('last_user'); } catch(_) {}

window.location.replace("login.html");
};

// ==========================================
// ✅ STEP 4.4 — PROFILE NAME EDIT FUNCTIONS
// ==========================================
window.openEditName = function() {
  const currentName = document.getElementById("profile-realname").textContent;
  document.getElementById("input-edit-name").value = currentName;
  document.getElementById("profile-realname").parentElement.style.display = "none";
  document.getElementById("edit-name-form").style.display = "block";
  setTimeout(() => document.getElementById("input-edit-name").focus(), 50);
};

window.cancelEditName = function() {
  document.getElementById("edit-name-form").style.display = "none";
  document.getElementById("profile-realname").parentElement.style.display = "flex";
};

window.saveEditName = async function() {
  const input = document.getElementById("input-edit-name");
  const newName = input.value.trim();

  if (!newName || newName.length < 2) {
    showToast("Name must be at least 2 characters", "error");
    return;
  }

  const saveBtn = input.nextElementSibling?.querySelector("button");

  try {
    if (saveBtn) setBtnLoading(saveBtn, true);

    const data = await apiFetch("/auth/profile", {
      method: "PATCH",
      body: { realName: newName }
    });

    // Update UI
    document.getElementById("profile-realname").textContent = data.realName;
    cancelEditName();

    // Update header avatar and name
    if (currentUser) {
      currentUser.realName = data.realName;
      renderProfileIcon();
      const desktopName = document.getElementById("desktop-profile-name");
      if (desktopName) desktopName.textContent = data.realName;
    }

    showToast("Name updated successfully", "success");

  } catch (err) {
    showToast(err.message || "Failed to update name", "error");
  } finally {
    if (saveBtn) setBtnLoading(saveBtn, false);
  }
};

// ==========================================
// ✅ FRIENDS MANAGEMENT LOGIC
// ==========================================

let isFriendEditMode = false;

// 1. Load Friends when Profile Opens
// (We hook into the existing openProfileModal function later)
async function loadFriends() {
  const listContainer = document.getElementById("friends-list-container");
  const emptyState = document.getElementById("friends-empty-state");
  
  if(!listContainer) return;

  listContainer.innerHTML = '<div class="spinner" style="margin: 20px auto; display:block;"></div>';
  emptyState.style.display = "none";

  try {
    const data = await apiFetch("/friends");
    
    // Update the profile list variable
    myFriends = data.friends;

    // ✅ FIX: Update the autocomplete cache as well!
    cachedFriends = data.friends; 

    renderFriendsList();
  } catch (err) {
    listContainer.innerHTML = `<div style="color:red; text-align:center; padding:10px;">Failed to load friends</div>`;
  }
}

// =========================================
// RENDER FRIENDS LIST (With Settlements)
// =========================================
function renderFriendsList() {
  const list = document.getElementById("friends-list-container");
  list.innerHTML = "";

  if (myFriends.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>You haven't added any friends yet.</p>
      </div>`;
    return;
  }

  myFriends.forEach((f) => {
    const avatarColor = getAvatarColor(f.name); // Utility from main.js
    
    // --- NEW: Settlement Logic ---
    let balanceHtml = "";
    if (f.total_balance && f.total_balance !== 0) {
      const amount = Math.abs(f.total_balance / 100).toFixed(2);
      if (f.total_balance > 0) {
        // Positive: They owe you
        balanceHtml = `
          <div style="font-size: 0.85rem; color: #10b981; margin-top: 4px; font-weight: 500;">
            owes you ₹${amount}
          </div>`;
      } else {
        // Negative: You owe them
        balanceHtml = `
          <div style="font-size: 0.85rem; color: #ef4444; margin-top: 4px; font-weight: 500;">
            you owe ₹${amount}
          </div>`;
      }
    } else {
        // Zero balance or undefined
        balanceHtml = `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 4px;">Settled up</div>`;
    }
    // -----------------------------

    const item = document.createElement("div");
    item.className = "friend-item";
    item.innerHTML = `
      <div class="friend-avatar" style="background-color: ${avatarColor}">
        ${f.name.charAt(0).toUpperCase()}
      </div>
      <div class="friend-info">
        <div class="friend-name">${f.name}</div>
        <div class="friend-username">@${f.username}</div>
        ${balanceHtml} </div>
      <div class="friend-actions">
        <button class="btn-icon" onclick="editFriend(${f.id})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-icon delete" onclick="deleteFriend(${f.id})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    list.appendChild(item);
  });
}

// ==========================================
// ✅ NEW: FRIEND DETAILS LOGIC
// ==========================================

// A. Open the View
window.openFriendDetails = function(id) {
  const friend = myFriends.find(f => f.id == id);
  if(!friend) return;

  currentViewFriendId = id;

  // 1. Populate Basic Info
  document.getElementById("fd-name").textContent = friend.name;
  document.getElementById("fd-username").textContent = `@${friend.username}`;
  
  const avatar = document.getElementById("fd-avatar");
  avatar.textContent = getInitials(friend.name);
  avatar.style.background = getAvatarColor(friend.name);

  // 2. Open Modal
  document.getElementById("friend-details-modal").classList.add("active");

  // 3. Fetch Settlements
  refreshFriendSettlements();
};

window.closeFriendDetails = function() {
  document.getElementById("friend-details-modal").classList.remove("active");
  currentViewFriendId = null;
};

// B. Fetch & Render Settlements
window.refreshFriendSettlements = async function() {
  if(!currentViewFriendId) return;

  const totalEl = document.getElementById("fd-grand-total");
  const labelEl = document.getElementById("fd-status-label");
  const listEl = document.getElementById("fd-chapters-list");
  
  // Loading State
  totalEl.innerHTML = '<div class="spinner" style="border-width:2px; border-color:#ccc; border-top-color:#333;"></div>';
  listEl.innerHTML = '';
  labelEl.textContent = "Checking...";

  try {
    // Call the new API from Step 2
    const data = await apiFetch(`/friends/${currentViewFriendId}/settlements`);
    
    const grandTotal = parseFloat(data.grandTotal);
    
    // 1. Render Big Number
    if (grandTotal > 0) {
      totalEl.textContent = `₹${grandTotal.toFixed(2)}`;
      totalEl.className = "settlement-amount-large text-green";
      labelEl.textContent = "You get back";
    } else if (grandTotal < 0) {
      totalEl.textContent = `₹${Math.abs(grandTotal).toFixed(2)}`;
      totalEl.className = "settlement-amount-large text-red";
      labelEl.textContent = "You owe";
    } else {
      totalEl.textContent = "₹0.00";
      totalEl.className = "settlement-amount-large text-gray";
      labelEl.textContent = "Settled Up";
    }

    // 2. Render Chapters
    if (data.chapters.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#999; font-size:0.85rem;">No shared expense history</div>';
    } else {
      data.chapters.forEach(ch => {
        const bal = parseFloat(ch.balance);
        let balHtml = "";
        
        if (bal > 0) balHtml = `<span class="text-green">+₹${bal.toFixed(0)}</span>`;
        else if (bal < 0) balHtml = `<span class="text-red">-₹${Math.abs(bal).toFixed(0)}</span>`;
        else balHtml = `<span class="text-gray">Settled</span>`;

        const row = document.createElement("div");
        row.className = "shared-chapter-row";
        row.innerHTML = `
          <div class="shared-chapter-name">${ch.chapterName}</div>
          <div class="shared-chapter-balance">${balHtml}</div>
        `;
        listEl.appendChild(row);
      });
    }

  } catch (err) {
    totalEl.textContent = "Error";
    totalEl.className = "settlement-amount-large text-gray";
    listEl.innerHTML = `<div style="color:red; font-size:0.8rem; text-align:center;">${err.message}</div>`;
  }
};

// ==========================================
// ✅ NEW: FRIEND ACTIONS (EDIT/DELETE)
// ==========================================

window.openFriendActions = function() {
  document.getElementById("friend-actions-modal").classList.add("active");
};

window.closeFriendActions = function() {
  document.getElementById("friend-actions-modal").classList.remove("active");
};

window.triggerFriendEdit = function() {
  closeFriendActions();
  closeFriendDetails(); // Close details
  // Use existing editFriend function
  editFriend(currentViewFriendId);
};

window.triggerFriendDelete = function() {
  closeFriendActions();
  
  if (!confirm("Are you sure? This removes them from your list but keeps chapter history.")) return;

  // Use existing deleteFriend function
  deleteFriend(currentViewFriendId).then(() => {
    closeFriendDetails();
  });
};

// 3. UI Toggles
window.openAddFriendMode = function() {
  const form = document.getElementById("friend-form");
  const list = document.getElementById("friends-list-view");
  const addBtn = document.getElementById("btn-add-friend-mode");
  
  // Reset Form
  form.reset();
  form.querySelector('input[name="friendId"]').value = "";
  document.getElementById("friend-form-title").textContent = "Add New Friend";
  
  // Switch Views
  list.style.display = "none";
  addBtn.style.display = "none";
  form.style.display = "block";
  
  setTimeout(() => form.querySelector('input[name="name"]').focus(), 100);
};

window.cancelFriendEdit = function() {
  document.getElementById("friend-form").style.display = "none";
  document.getElementById("friends-list-view").style.display = "block";
  document.getElementById("btn-add-friend-mode").style.display = "inline-block";
};

// 4. Edit Logic
window.editFriend = function(id) {
  const friend = myFriends.find(f => f.id == id);
  if (!friend) return;

  openAddFriendMode(); // Switch to form view
  
  const form = document.getElementById("friend-form");
  document.getElementById("friend-form-title").textContent = "Edit Friend";
  
  // Fill inputs
  form.querySelector('input[name="friendId"]').value = friend.id;
  form.querySelector('input[name="name"]').value = friend.name;
  form.querySelector('input[name="username"]').value = friend.username;
  form.querySelector('input[name="email"]').value = friend.email;
  form.querySelector('input[name="phone"]').value = friend.phone || "";
  form.querySelector('input[name="mobile"]').value = friend.mobile || "";
};

// 5. Save (Create/Update)
const friendForm = document.getElementById("friend-form");
if (friendForm) {
  friendForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = friendForm.querySelector('button[type="submit"]');
    setBtnLoading(btn, true);

    const formData = new FormData(friendForm);
    const id = formData.get("friendId");
    
    const payload = {
      name: formData.get("name"),
      username: formData.get("username"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      mobile: formData.get("mobile")
    };

    try {
      if (id) {
        // UPDATE
        await apiFetch(`/friends/${id}`, { method: "PUT", body: payload });
        showToast("Friend updated", "success");
      } else {
        // CREATE
        await apiFetch("/friends", { method: "POST", body: payload });
        showToast("Friend added", "success");
      }
      
      // Refresh & Go back to list
      await loadFriends();
      cancelFriendEdit();

    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBtnLoading(btn, false);
    }
  };
}

// 6. Delete Logic
window.deleteFriend = async function(id) {
  if (!confirm("Are you sure you want to remove this friend?")) return;
  
  try {
    await apiFetch(`/friends/${id}`, { method: "DELETE" });
    showToast("Friend removed", "info");
    loadFriends(); // Refresh list
  } catch (err) {
    showToast(err.message, "error");
  }
};

// ==========================================
// ✅ CHANGE 6: Toggle Archive Function
// ==========================================
window.toggleArchive = async function(id, currentState) {
  document.querySelectorAll('.menu-dropdown').forEach(el => el.classList.remove('active'));
  const newState = !currentState;
  try {
    await apiFetch(`/chapters/${id}/archive`, {
      method: "PATCH",
      body: { is_archived: newState }
    });
    showToast(newState ? "Chapter marked as settled" : "Chapter restored", "success");
    await reloadChaptersGrid();
  } catch (err) {
    showToast("Failed to update chapter", "error");
  }
};