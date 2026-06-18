/* ================================================================
   HISAAB-KITAAB — js/ui/command-palette.js
   Dynamic command palette modal loader and interactive logic.
   ================================================================ */

(function () {
  let overlay = null;
  let input = null;
  let list = null;
  let selectedIndex = 0;
  let visibleItems = [];

  const COMMANDS = {
    global: [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        icon: 'home',
        shortcut: 'G D',
        action: () => { window.location.href = 'dashboard.html'; }
      },
      {
        id: 'toggle-theme',
        label: 'Toggle Theme',
        icon: 'sliders',
        shortcut: 'T T',
        action: () => {
          const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
          const newTheme = currentTheme === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', newTheme);
          localStorage.setItem('hk_theme', newTheme);
          if (window.showToast) {
            showToast(`Theme switched to ${newTheme} mode`, 'info');
          }
        }
      }
    ],
    dashboard: [
      {
        id: 'dash-create-chapter',
        label: 'Create New Chapter',
        icon: 'plus',
        shortcut: 'C C',
        action: () => {
          const btn = document.querySelector('[onclick="openCreateChapterModal()"]') || document.querySelector('#dashboard-fab');
          if (btn) btn.click();
          else if (window.openCreateChapterModal) window.openCreateChapterModal();
        }
      },
      {
        id: 'dash-search',
        label: 'Search Chapters...',
        icon: 'search',
        shortcut: '/',
        action: () => {
          const search = document.querySelector('.search-input');
          if (search) setTimeout(() => search.focus(), 100);
        }
      },
      {
        id: 'dash-profile',
        label: 'Open My Profile & Settings',
        icon: 'user',
        shortcut: 'G P',
        action: () => {
          if (window.openProfileModal) window.openProfileModal();
          else {
            const btn = document.querySelector('.profile-btn');
            if (btn) btn.click();
          }
        }
      }
    ],
    chapter: [
      {
        id: 'chap-add-expense',
        label: 'Add New Expense',
        icon: 'plus',
        shortcut: 'A E',
        action: () => {
          if (window.openAddExpenseModal) window.openAddExpenseModal();
          else {
            const fab = document.getElementById('chapter-fab');
            if (fab) fab.click();
          }
        }
      },
      {
        id: 'chap-settle-up',
        label: 'Settle Up Balances',
        icon: 'credit-card',
        shortcut: 'S U',
        action: () => {
          if (window.openSettlementModal) window.openSettlementModal();
        }
      },
      {
        id: 'chap-summary',
        label: 'View Chapter Summary',
        icon: 'bar-chart-2',
        shortcut: 'V S',
        action: () => {
          if (window.openSummaryModal) window.openSummaryModal();
        }
      },
      {
        id: 'chap-members',
        label: 'View Chapter Members',
        icon: 'users',
        shortcut: 'V M',
        action: () => {
          if (window.openMembersPanel) window.openMembersPanel();
        }
      },
      {
        id: 'chap-export',
        label: 'Export Excel Report',
        icon: 'download',
        shortcut: 'E R',
        action: () => {
          if (window.downloadReport) window.downloadReport();
        }
      },
      {
        id: 'chap-refresh',
        label: 'Refresh Settlements',
        icon: 'rotate-cw',
        shortcut: 'R S',
        action: () => {
          if (window.refreshSettlements) window.refreshSettlements();
        }
      }
    ]
  };

  function getPageContext() {
    const path = window.location.pathname;
    if (path.includes('chapter.html')) return 'chapter';
    if (path.includes('dashboard.html')) return 'dashboard';
    return 'global';
  }

  function getActiveCommands() {
    const context = getPageContext();
    const list = [...COMMANDS.global];
    if (context === 'dashboard') {
      list.push(...COMMANDS.dashboard);
    } else if (context === 'chapter') {
      list.push(...COMMANDS.chapter);
    }
    return list;
  }

  function buildPaletteDOM() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'cmd-palette-overlay';
    overlay.innerHTML = `
      <div class="cmd-palette" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div class="cmd-palette-search">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18"><use href="icons/sprite.svg#search"></use></svg>
          <input type="text" class="cmd-palette-input" placeholder="Type a command or search..." autocomplete="off" spellcheck="false">
        </div>
        <div class="cmd-palette-list" role="listbox"></div>
        <div class="cmd-palette-footer">
          <div class="cmd-palette-tip-item"><kbd class="cmd-palette-kbd">↑↓</kbd> <span>to navigate</span></div>
          <div class="cmd-palette-tip-item"><kbd class="cmd-palette-kbd">↵</kbd> <span>to select</span></div>
          <div class="cmd-palette-tip-item"><kbd class="cmd-palette-kbd">esc</kbd> <span>to close</span></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    input = overlay.querySelector('.cmd-palette-input');
    list = overlay.querySelector('.cmd-palette-list');

    // Close on click backdrop
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closePalette();
      }
    });

    // Handle input change
    input.addEventListener('input', () => {
      renderItems();
    });

    // Keyboard navigation inside input
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectIndex(selectedIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectIndex(selectedIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        triggerSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      }
    });
  }

  function openPalette() {
    buildPaletteDOM();
    selectedIndex = 0;
    input.value = '';
    renderItems();
    overlay.classList.add('is-open');
    setTimeout(() => input.focus(), 50);
  }

  function closePalette() {
    if (overlay) {
      overlay.classList.remove('is-open');
      input.blur();
    }
  }

  function selectIndex(index) {
    if (visibleItems.length === 0) return;
    const items = list.querySelectorAll('.cmd-palette-item');
    items[selectedIndex]?.classList.remove('is-selected');

    // Bound loop
    selectedIndex = (index + visibleItems.length) % visibleItems.length;
    items[selectedIndex]?.classList.add('is-selected');
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function triggerSelected() {
    const cmd = visibleItems[selectedIndex];
    if (cmd) {
      cmd.action();
      closePalette();
    }
  }

  function renderItems() {
    const query = input.value.toLowerCase().trim();
    const activeCmds = getActiveCommands();

    visibleItems = activeCmds.filter(cmd => 
      cmd.label.toLowerCase().includes(query)
    );

    if (visibleItems.length === 0) {
      list.innerHTML = `<div class="cmd-palette-empty">No results found for "${escapeHTML(query)}"</div>`;
      return;
    }

    list.innerHTML = visibleItems.map((cmd, idx) => {
      const isSelected = idx === selectedIndex;
      return `
        <button class="cmd-palette-item${isSelected ? ' is-selected' : ''}" role="option" aria-selected="${isSelected}" data-index="${idx}">
          <div class="cmd-palette-item-left">
            <div class="cmd-palette-item-icon">
              <svg fill="none" stroke="currentColor"><use href="icons/sprite.svg#${cmd.icon}"></use></svg>
            </div>
            <span class="cmd-palette-item-label">${escapeHTML(cmd.label)}</span>
          </div>
          ${cmd.shortcut ? `<span class="cmd-palette-shortcut">${cmd.shortcut}</span>` : ''}
        </button>
      `;
    }).join('');

    // Attach item clicks
    list.querySelectorAll('.cmd-palette-item').forEach(el => {
      el.addEventListener('click', () => {
        selectedIndex = parseInt(el.dataset.index);
        triggerSelected();
      });
    });
  }

  // Safe HTML escaper helper
  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // Listen for shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay && overlay.classList.contains('is-open')) {
        closePalette();
      } else {
        openPalette();
      }
    }
  });
})();
