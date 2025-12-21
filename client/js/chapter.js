/* client/js/chapter.js */

// 1. Get Chapter ID from URL
const urlParams = new URLSearchParams(window.location.search);
const chapterId = urlParams.get("id");

if (!chapterId) {
  alert("No chapter specified");
  window.location.href = "dashboard.html";
}

// Elements
const titleEl = document.getElementById("chapter-title");
const descEl = document.getElementById("chapter-desc");
const iconEl = document.getElementById("chapter-icon-display");
const memberListEl = document.getElementById("member-list-content");
const toggleBtn = document.getElementById("member-toggle-btn");
const dropdown = document.getElementById("member-dropdown");

// ✅ NEW: Skeleton & Content Elements
const skeletonEl = document.getElementById("chapter-skeleton");
const contentEl = document.getElementById("chapter-content");
const emptyStateEl = document.getElementById("chapter-empty-state");

// 2. Load Data on Start
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await apiFetch("/auth/me");
    
    // Simulate short delay so user sees the skeleton (optional, feels smoother)
    // await new Promise(r => setTimeout(r, 500)); 

    const data = await apiFetch(`/chapters/${chapterId}`);
    
    renderChapter(data);
    
    // ✅ FIX: Swap Skeleton for Real Content
    skeletonEl.style.display = "none";
    contentEl.style.display = "block";
    
    // Show empty state for expenses (since we have none yet)
    emptyStateEl.style.display = "block";

  } catch (err) {
    console.error(err);
    alert("Failed to load chapter or unauthorized");
    window.location.href = "dashboard.html";
  }
});

// 3. Render Functions
function getInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

function renderChapter(data) {
  const { chapter, members } = data;

  // Header
  titleEl.textContent = chapter.name;
  
  if (chapter.description && chapter.description.trim() !== "") {
    descEl.textContent = chapter.description;
    descEl.style.display = "block";
  } else {
    descEl.style.display = "none";
  }

  // Visuals
  iconEl.textContent = getInitials(chapter.name);
  const color = getAvatarColor(chapter.name); // Use the helper from main.js
  
  iconEl.style.background = color;
  iconEl.style.color = "#fff";
  iconEl.style.boxShadow = `0 0 30px ${color}60`; // Soft glow

  // Members List
  memberListEl.innerHTML = "";
  members.forEach(m => {
    const row = document.createElement("div");
    row.className = "dropdown-member-item";
    
    const initials = getInitials(m.member_name);
    
    row.innerHTML = `
      <div class="small-avatar">${initials}</div>
      <div class="member-name-text">${m.member_name}</div>
    `;
    memberListEl.appendChild(row);
  });
}

// 4. Dropdown Toggle Logic
toggleBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent immediate closing
  dropdown.classList.toggle("active");
});

// Close dropdown if clicking anywhere else
document.addEventListener("click", () => {
  dropdown.classList.remove("active");
});

// Prevent closing if clicking inside the dropdown
dropdown.addEventListener("click", (e) => {
  e.stopPropagation();
});
