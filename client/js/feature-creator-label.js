/* client/js/feature-creator-label.js */
/* Feature 2: Creator row in chapter creation + "You" label inside chapters */
/* Refactored for Phase 6: Uses EventBus instead of monkey-patching and setTimeout polling */

// ─────────────────────────────────────────────────────────────
// DASHBOARD SIDE: Inject creator row when "New Chapter" modal opens
// ─────────────────────────────────────────────────────────────

if (document.getElementById('create-modal')) {
  EventBus.on('chapter:modal:open', injectCreatorRow);
}

function injectCreatorRow() {
  const user = window.currentUser;
  if (!user) return;

  const memberContainer = document.getElementById('member-list-container');
  if (!memberContainer) return;

  const existing = memberContainer.querySelector('.creator-member-row');
  if (existing) existing.remove();

  const name = user.realName || user.username || '?';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#ff6b6b','#4ecdc4','#45b7d1','#f9ca24','#f0932b','#6c5ce7'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];

  const row = document.createElement('div');
  row.className = 'creator-member-row';
  row.dataset.creatorAdded = 'true';
  row.innerHTML = `
    <div class="creator-member-avatar" style="background:${color};">${initials}</div>
    <div class="creator-member-name">
      ${name}
      <span class="you-badge">You</span>
    </div>
    <div class="creator-tick" id="creator-tick-btn" title="Click to toggle your membership"></div>
  `;

  memberContainer.prepend(row);
  row.querySelector('#creator-tick-btn').addEventListener('click', toggleCreatorMembership);
}

function toggleCreatorMembership(e) {
  const btn = e.currentTarget;
  const row = btn.closest('.creator-member-row');
  const isAdded = row.dataset.creatorAdded === 'true';

  if (isAdded) {
    const confirmed = confirm(
      'Removing yourself means you won\'t appear in expense splits by default.\n\nAre you sure?'
    );
    if (!confirmed) return;

    row.dataset.creatorAdded = 'false';
    btn.classList.add('removed');
    btn.textContent = '+';
    btn.title = 'Click to add yourself back';
    row.style.opacity = '0.5';
  } else {
    row.dataset.creatorAdded = 'true';
    btn.classList.remove('removed');
    btn.textContent = '';
    btn.title = 'Click to remove yourself';
    row.style.opacity = '1';
  }
}

// ─────────────────────────────────────────────────────────────
// Intercept createChapter form submission to include/exclude creator
// (No polling needed since script is loaded at the end of <body>)
// ─────────────────────────────────────────────────────────────
const createForm = document.getElementById('create-chapter-form');
if (createForm) {
  createForm.addEventListener('submit', (e) => {
    const creatorRow = document.querySelector('.creator-member-row');
    if (creatorRow) {
      const isAdded = creatorRow.dataset.creatorAdded === 'true';
      let hiddenInput = createForm.querySelector('input[name="creatorExcluded"]');
      if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'creatorExcluded';
        createForm.appendChild(hiddenInput);
      }
      hiddenInput.value = (!isAdded).toString();
    }
  }, true); // capture phase so it runs before dashboard.js submit
}

// ─────────────────────────────────────────────────────────────
// CHAPTER PAGE SIDE: Add "you" label wherever member names appear
// ─────────────────────────────────────────────────────────────

function isMemberCurrentUser(member) {
  if (!window.currentUser) return false;
  return member.user_id && parseInt(member.user_id) === parseInt(window.currentUser.id);
}

window.getMemberDisplayName = function(member) {
  if (isMemberCurrentUser(member)) {
    return `${member.member_name} <span class="you-badge">you</span>`;
  }
  return member.member_name;
};

window.getMemberDisplayNamePlain = function(member) {
  if (isMemberCurrentUser(member)) {
    return `${member.member_name} (you)`;
  }
  return member.member_name;
};

function addYouToSettlementName(name) {
  if (!window.currentUser || !window.currentMembers) return name;
  const member = (window.currentMembers || []).find(
    m => m.member_name === name && isMemberCurrentUser(m)
  );
  return member ? `${name} <span class="you-badge">you</span>` : name;
}

// ─────────────────────────────────────────────────────────────
// Add "you" badges to member list (dropdown/panel)
// ─────────────────────────────────────────────────────────────
function _addYouBadgesToMemberList() {
  if (!window.currentUser || !window.currentMembers) return;

  const memberListEl = document.getElementById('member-list-content');
  if (!memberListEl) return;

  const items = memberListEl.querySelectorAll('.dropdown-member-item');
  items.forEach(item => {
    const nameEl = item.querySelector('.member-name-text');
    if (!nameEl) return;
    if (nameEl.querySelector('.you-badge')) return;

    const nameText = nameEl.childNodes[0]?.textContent?.trim();
    if (!nameText) return;

    const match = (window.currentMembers || []).find(m =>
      m.member_name === nameText && isMemberCurrentUser(m)
    );

    if (match) {
      const badge = document.createElement('span');
      badge.className = 'you-badge';
      badge.textContent = 'you';
      nameEl.appendChild(badge);
    }
  });
}

EventBus.on('chapter:loaded', ({ members, currentUser }) => {
  // Sync global state if passed via event payload
  if (members) window.currentMembers = members;
  if (currentUser) window.currentUser = currentUser;
  
  _addYouBadgesToMemberList();
  EventBus.on('expenses:rendered', _addYouBadgesToMemberList);
  EventBus.on('members:rendered', _addYouBadgesToMemberList);
});

// ─────────────────────────────────────────────────────────────
// Add "you" label in payer/split options inside expense modal
// ─────────────────────────────────────────────────────────────
function _addYouBadges(openModal) {
  if (!window.currentUser || !window.currentMembers) return;

  // Payer options
  const payerContainer = openModal.querySelector('#payer-selection-container') || document.getElementById('payer-selection-container');
  if (payerContainer) {
    payerContainer.querySelectorAll('.payer-option').forEach(el => {
      const radio = el.querySelector('input[type=radio]');
      if (!radio) return;
      const memberId = parseInt(radio.value);
      const member = (window.currentMembers || []).find(m => m.id === memberId);
      if (member && isMemberCurrentUser(member)) {
        const nameDiv = el.querySelector('div');
        if (nameDiv && !nameDiv.querySelector('.you-badge')) {
          const badge = document.createElement('span');
          badge.className = 'you-badge';
          badge.textContent = 'you';
          nameDiv.appendChild(badge);
        }
      }
    });
  }

  // Split options
  const splitContainer = openModal.querySelector('#split-selection-container') || document.getElementById('split-selection-container');
  if (splitContainer) {
    splitContainer.querySelectorAll('.split-option').forEach(el => {
      const checkbox = el.querySelector('input[type=checkbox]');
      if (!checkbox) return;
      const memberId = parseInt(checkbox.value);
      const member = (window.currentMembers || []).find(m => m.id === memberId);
      if (member && isMemberCurrentUser(member)) {
        const nameSpan = el.querySelector('span');
        if (nameSpan && !nameSpan.querySelector('.you-badge')) {
          const badge = document.createElement('span');
          badge.className = 'you-badge';
          badge.textContent = 'you';
          nameSpan.appendChild(badge);
        }
      }
    });
  }
}

EventBus.on('expense:modal:open', () => {
  const openModal = document.querySelector('.modal-overlay.is-open');
  if (!openModal) return;
  _addYouBadges(openModal);
});