/* client/js/dashboard.js */

const chaptersGrid = document.getElementById("chapters-grid");
const createModal = document.getElementById("create-modal");
const createForm = document.getElementById("create-chapter-form");
const memberListContainer = document.getElementById("member-list-container");

// 1. Fetch and Render on Load
document.addEventListener("DOMContentLoaded", () => {
  loadChapters();
});

async function loadChapters() {
  try {
    const data = await apiFetch("/chapters");
    renderGrid(data.chapters);
  } catch (err) {
    console.error("Failed to load chapters", err);
  }
}

// 2. Logic: Initials Generator
function getInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  // First char of first two words
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

// 3. Render the Grid
function renderGrid(chapters) {
  // Clear grid but keep the "Add New" button (which we will re-add effectively)
  chaptersGrid.innerHTML = "";

  // A. Create "Add New" Card
  const addCard = document.createElement("div");
  addCard.className = "chapter-card card-add";
  addCard.onclick = openModal;
  addCard.innerHTML = `
    <div class="plus-icon">+</div>
    <div style="margin-top:10px; font-weight:600; color:#888;">Create Chapter</div>
  `;
  chaptersGrid.appendChild(addCard);

  // B. Render User Chapters
  chapters.forEach((chapter) => {
    const card = document.createElement("a");
    // Link to the future chapter details page
    card.href = `chapter.html?id=${chapter.id}`; 
    card.className = "chapter-card card-content";
    
    const initials = getInitials(chapter.name);

    card.innerHTML = `
      <div class="chapter-initials">${initials}</div>
      <h3 class="chapter-name">${chapter.name}</h3>
    `;
    chaptersGrid.appendChild(card);
  });
}

// 4. Modal Functions
function openModal() {
  createModal.classList.add("active");
  // Reset form
  createForm.reset();
  memberListContainer.innerHTML = ""; // Clear dynamic members
  addMemberInput(); // Add one empty slot
}

function closeModal() {
  createModal.classList.remove("active");
}

// 5. Dynamic Member Inputs
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
  const formData = new FormData(createForm);
  
  const name = formData.get("name");
  const description = formData.get("description");
  
  // Collect all member inputs
  const members = [];
  document.querySelectorAll('input[name="members[]"]').forEach(input => {
    if(input.value.trim()) members.push(input.value.trim());
  });

  if(members.length === 0) {
    alert("Please add at least one member.");
    return;
  }

  try {
    await apiFetch("/chapters", {
      method: "POST",
      body: { name, description, members }
    });
    
    closeModal();
    loadChapters(); // Reload grid to show new chapter
  } catch (err) {
    alert(err.message || "Failed to create chapter");
  }
});

// Close modal when clicking outside
createModal.addEventListener("click", (e) => {
  if (e.target === createModal) closeModal();
});