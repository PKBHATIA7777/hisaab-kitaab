/* client/js/feature-creator-label.js */
/* Feature 2: Creator row in chapter creation + "You" label inside chapters */
/* Include in dashboard.html AFTER dashboard.js */
/* Include in chapter.html AFTER chapter.js */
/* <script src="js/feature-creator-label.js"></script> */

// ─────────────────────────────────────────────────────────────
// DASHBOARD SIDE: Inject creator row when "New Chapter" modal opens
// ─────────────────────────────────────────────────────────────

// We wrap the existing openModal from dashboard.js
(function() {
  // Wait for dashboard.js to be fully loaded
  const _waitAndWrap = () => {
    const originalOpenModal = window.openModal;
    if (!originalOpenModal) {
      setTimeout(_waitAndWrap, 100);
      return;
    }

    window.openModal = function() {
      // Call original
      originalOpenModal();

      // After original runs, inject creator row into member list
      injectCreatorRow();
    };
  };

  // Only run on dashboard page
  if (document.getElementById('create-modal')) {
    _waitAndWrap();
  }
})();

function injectCreatorRow() {
  // Get current user from dashboard.js global
  const user = window.currentUser;
  if (!user) return;

  const memberContainer = document.getElementById('member-list-container');
  if (!memberContainer) return;

  // Remove any existing creator row
  const existing = memberContainer.querySelector('.creator-member-row');
  if (existing) existing.remove();

  const initials = getInitials(user.realName || user.username || '?');
  const color = getAvatarColor(user.realName || '');

  // Create the row
  const row = document.createElement('div');
  row.className = 'creator-member-row';
  row.dataset.creatorAdded = 'true';

  row.innerHTML = `
    <div class="creator-member-avatar" style="background:${color};">${initials}</div>
    <div class="creator-member-name">
      ${user.realName || user.username}
      <span class="you-badge">You</span>
    </div>
    <div class="creator-tick" id="creator-tick-btn" title="Click to toggle your membership">✓</div>
  `;

  // Prepend so it's first
  memberContainer.prepend(row);

  // Wire up toggle
  row.querySelector('#creator-tick-btn').addEventListener('click', toggleCreatorMembership);
}

function toggleCreatorMembership(e) {
  const btn = e.currentTarget;
  const row = btn.closest('.creator-member-row');
  const isAdded = row.dataset.creatorAdded === 'true';

  if (isAdded) {
    // Warn before removing
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
    btn.textContent = '✓';
    btn.title = 'Click to remove yourself';
    row.style.opacity = '1';
  }
}

// ─────────────────────────────────────────────────────────────
// Intercept createChapter form submission to include/exclude creator
// ─────────────────────────────────────────────────────────────
(function() {
  const tryWrap = () => {
    const createForm = document.getElementById('create-chapter-form');
    if (!createForm) return;

    // Listen on form submit to add creatorExcluded flag
    createForm.addEventListener('submit', (e) => {
      const creatorRow = document.querySelector('.creator-member-row');
      if (creatorRow) {
        const isAdded = creatorRow.dataset.creatorAdded === 'true';
        // Add a hidden input the form can read
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
  };

  if (document.getElementById('create-chapter-form')) {
    tryWrap();
  }
})();

// ─────────────────────────────────────────────────────────────
// CHAPTER PAGE SIDE: Add "you" label wherever member names appear
// ─────────────────────────────────────────────────────────────

// Helper: returns true if member belongs to current user
function isMemberCurrentUser(member) {
  if (!window.currentUser) return false;
  return member.user_id && parseInt(member.user_id) === parseInt(window.currentUser.id);
}

// Returns display name with (you) suffix if applicable
window.getMemberDisplayName = function(member) {
  if (isMemberCurrentUser(member)) {
    return `${member.member_name} <span class="you-badge">you</span>`;
  }
  return member.member_name;
};

// Plain text version (no HTML) for use in places that don't render HTML
window.getMemberDisplayNamePlain = function(member) {
  if (isMemberCurrentUser(member)) {
    return `${member.member_name} (you)`;
  }
  return member.member_name;
};

// ─────────────────────────────────────────────────────────────
// OVERRIDE renderMembers in chapter.js to add "you" label
// This is additive only — the original logic runs unchanged
// ─────────────────────────────────────────────────────────────
(function() {
  const tryOverride = () => {
    if (!window.renderMembers) {
      setTimeout(tryOverride, 200);
      return;
    }

    // We will patch renderMembers by re-running after it finishes
    // and adding "you" badges to matching rows
    const _orig = window.renderMembers;
    window.renderMembers = async function() {
      await _orig.apply(this, arguments);
      addYouBadgesToMemberList();
    };
  };

  if (document.getElementById('member-list-content')) {
    tryOverride();
  }
})();

function addYouBadgesToMemberList() {
  if (!window.currentUser || !window.currentMembers) return;

  const memberListEl = document.getElementById('member-list-content');
  if (!memberListEl) return;

  const items = memberListEl.querySelectorAll('.dropdown-member-item');
  items.forEach(item => {
    // Find the name text node
    const nameEl = item.querySelector('.member-name-text');
    if (!nameEl) return;

    // Check if already has badge
    if (nameEl.querySelector('.you-badge')) return;

    // Find member data by name match
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

// ─────────────────────────────────────────────────────────────
// Add "you" label in settlement hero/modal
// ─────────────────────────────────────────────────────────────
function addYouToSettlementName(name) {
  if (!window.currentUser || !window.currentMembers) return name;
  const member = (window.currentMembers || []).find(
    m => m.member_name === name && isMemberCurrentUser(m)
  );
  return member ? `${name} <span class="you-badge">you</span>` : name;
}

// ─────────────────────────────────────────────────────────────
// Add "you" label in payer/split options inside expense modal
// Patch renderPayerAndSplitOptions to mark current user
// ─────────────────────────────────────────────────────────────
(function() {
  const tryPatch = () => {
    // Wait for chapter.js
    if (typeof window.renderPayerAndSplitOptions === 'undefined') {
      setTimeout(tryPatch, 300);
      return;
    }

    const _orig = window.renderPayerAndSplitOptions;
    window.renderPayerAndSplitOptions = function(selectedPayerId, selectedSplitIds) {
      _orig(selectedPayerId, selectedSplitIds);

      // After render, patch the labels for current user
      if (!window.currentUser || !window.currentMembers) return;

      // Payer options
      const payerContainer = document.getElementById('payer-selection-container');
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
      const splitContainer = document.getElementById('split-selection-container');
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
    };
  };

  if (document.getElementById('add-expense-modal')) {
    tryPatch();
  }
})();