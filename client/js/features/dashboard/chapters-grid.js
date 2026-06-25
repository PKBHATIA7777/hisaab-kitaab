/**
 * Chapters grid — renders cards, handles search/sort/filter.
 * Emits EVENTS.DASHBOARD_CHAPTERS_RENDERED when rendered.
 */
const ChaptersGrid = (() => {
  let _chapters = [];
  let _searchTerm = '';
  let _sortKey = 'last_opened';
  let _showArchived = false;

  const grid = () => document.getElementById('chapters-grid');

  function _sortChapters(list) {
    const sorted = [...list];
    const sorters = {
      last_opened: (a, b) => {
        const ta = a.last_opened_at || a.created_at;
        const tb = b.last_opened_at || b.created_at;
        return new Date(tb) - new Date(ta);
      },
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      az: (a, b) => a.name.localeCompare(b.name),
      members: (a, b) => b.member_count - a.member_count,
    };
    return sorted.sort(sorters[_sortKey] || sorters.last_opened);
  }

  function _filterChapters(list) {
    if (!_searchTerm) return list;
    const term = _searchTerm.toLowerCase();
    return list.filter(c => c.name.toLowerCase().includes(term));
  }

  function _buildCard(chapter) {
    const initials = getInitials(chapter.name);
    const color = getAvatarColor(chapter.name);
    const time = window.timeAgo(chapter.created_at);
    const isPersonal = chapter.is_personal;
    const isArchived = chapter.is_archived;

    // Get net balance from precalculated user_net_balance field
    const balNum = parseFloat(chapter.user_net_balance || 0);
    let balanceClass = 'settled';
    let balanceText = 'All settled up';
    
    if (balNum > 0.005) {
      balanceClass = 'owed';
      balanceText = `You are owed ₹${balNum.toFixed(2)}`;
    } else if (balNum < -0.005) {
      balanceClass = 'owe';
      balanceText = `You owe ₹${Math.abs(balNum).toFixed(2)}`;
    }

    const card = document.createElement('div');
    card.className = `chapter-card${isArchived ? ' chapter-card--archived' : ''}`;
    card.dataset.chapterId = chapter.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open ${chapter.name}, ${balanceText}`);

    card.innerHTML = `
      <div class="chapter-card__header">
        <div class="chapter-card__avatar" style="background:${color}">${initials}</div>
        ${isPersonal ? '<span class="badge badge--brand" style="margin-left:auto; margin-right:8px;">My Expenses</span>' : ''}
        <button class="chapter-card__menu-btn chapter-card__menu"
                aria-label="More options for ${escapeHTML(chapter.name)}"
                aria-haspopup="true" aria-expanded="false"
                data-chapter-id="${chapter.id}"
                data-chapter-name="${escapeHTML(chapter.name)}"
                data-chapter-desc="${escapeHTML(chapter.description || '')}"
                data-is-archived="${chapter.is_archived}"
                data-is-personal="${isPersonal}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
      </div>
      <div class="chapter-card__body">
        <div class="chapter-card__name">${escapeHTML(chapter.name)}</div>
        <div class="chapter-card__balance ${balanceClass}">${balanceText}</div>
      </div>
      <div class="chapter-card__footer">
        <span class="chapter-card__members">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          ${chapter.member_count} member${chapter.member_count !== 1 ? 's' : ''}
        </span>
        <span>${time}</span>
      </div>
    `;

    // Navigation on card click (not on menu button)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.chapter-card__menu')) return;
      navigateToChapter(chapter.id);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToChapter(chapter.id);
      }
    });

    // Prefetch on hover/touch
    let prefetched = false;
    const prefetch = () => {
      if (prefetched) return;
      prefetched = true;
      apiFetch(`/chapters/${chapter.id}`).catch(() => { });
      apiFetch(`/expenses/chapter/${chapter.id}?limit=50&offset=0`).catch(() => { });
    };
    card.addEventListener('mouseenter', prefetch, { passive: true });
    card.addEventListener('touchstart', prefetch, { passive: true });

    return card;
  }

  function _buildAddCard() {
    const card = document.createElement('div');
    card.className = 'chapter-card chapter-card--add';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Create new chapter');
    card.innerHTML = `
      <div class="chapter-card--add__icon" aria-hidden="true">+</div>
      <div class="chapter-card--add__label">Create Chapter</div>
    `;
    card.addEventListener('click', () => EventBus.emit(EVENTS.CHAPTER_MODAL_OPEN, {}));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        EventBus.emit(EVENTS.CHAPTER_MODAL_OPEN, {});
      }
    });
    return card;
  }

  function _buildEmptyState() {
    const div = document.createElement('div');
    div.style.gridColumn = '1 / -1';
    div.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        </div>
        <h3 class="empty-state__title">Welcome to Hisaab-Kitaab</h3>
        <p class="empty-state__subtitle">
          A <strong style="color:var(--text-on-dark)">chapter</strong> is a shared expense group —
          for a trip, your flat, a birthday dinner, or any group expense you want to split fairly.
        </p>
        <div class="empty-state__action" style="margin-bottom: var(--s-5);">
          <button class="btn btn--primary" onclick="EventBus.emit(EVENTS.CHAPTER_MODAL_OPEN, {})">
            Create your first chapter
          </button>
        </div>
        <div class="empty-state__features">
          <div class="empty-state__feature-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Add members — friends, flatmates, anyone</span>
          </div>
          <div class="empty-state__feature-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            <span>Log expenses and who paid</span>
          </div>
          <div class="empty-state__feature-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>Settle up with one tap — we do the math</span>
          </div>
        </div>
      </div>
    `;
    return div;
  }

  function render() {
    const g = grid();
    if (!g) return;
    g.innerHTML = '';

    const filtered = _filterChapters(_sortChapters(_chapters));

    // Update overall summary header balance widget
    _updateNetBalanceWidget(_chapters);

    if (!_chapters.length) {
      g.appendChild(_buildEmptyState());
      return;
    }

    // Add card always first
    g.appendChild(_buildAddCard());

    if (!filtered.length) {
      const noResults = document.createElement('div');
      noResults.style.gridColumn = '1 / -1';
      noResults.style.textAlign = 'center';
      noResults.style.padding = '40px';
      noResults.style.color = 'rgba(255,255,255,0.5)';
      noResults.textContent = `No chapters match "${_searchTerm}"`;
      g.appendChild(noResults);
      return;
    }

    filtered.forEach(c => g.appendChild(_buildCard(c)));

    EventBus.emit(EVENTS.DASHBOARD_CHAPTERS_RENDERED, { chapters: filtered });
  }

  function _updateNetBalanceWidget(chapters) {
    const widget = document.getElementById('balance-overview-box');
    if (!widget) return;
    
    // Sum balances across active chapters
    const activeChaps = chapters.filter(c => !c.is_archived);
    const sum = activeChaps.reduce((acc, c) => acc + parseFloat(c.user_net_balance || 0), 0);
    
    const amtEl = widget.querySelector('.balance-overview-amount');
    const descEl = widget.querySelector('.balance-overview-desc');
    if (!amtEl || !descEl) return;

    if (sum > 0.005) {
      amtEl.className = 'balance-overview-amount positive';
      amtEl.textContent = `+ ₹${sum.toFixed(2)}`;
      descEl.textContent = 'You are owed this sum across all active chapters';
    } else if (sum < -0.005) {
      amtEl.className = 'balance-overview-amount negative';
      amtEl.textContent = `- ₹${Math.abs(sum).toFixed(2)}`;
      descEl.textContent = 'You owe this sum across all active chapters';
    } else {
      amtEl.className = 'balance-overview-amount settled';
      amtEl.textContent = `₹0.00`;
      descEl.textContent = 'You are fully settled up across all active chapters';
    }
  }

  function renderSkeletons(count = 4) {
    const g = grid();
    if (!g) return;
    g.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'chapter-skeleton-grid';
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-label', 'Loading chapters...');
    wrapper.style.width = '100%';
    wrapper.style.gridColumn = '1 / -1';
    
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'chapter-skeleton-card';
      sk.setAttribute('aria-hidden', 'true');
      sk.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="skeleton" style="width:40px; height:40px; border-radius:var(--avatar-radius);"></div>
          <div class="skeleton" style="width:24px; height:24px; border-radius:var(--r-sm);"></div>
        </div>
        <div style="margin: var(--s-3) 0 var(--s-4); flex:1; display:flex; flex-direction:column; gap:var(--s-1h);">
          <div class="skeleton" style="width:70%; height:14px; border-radius:var(--r-xs);"></div>
          <div class="skeleton" style="width:40%; height:10px; border-radius:var(--r-xs);"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--surface-border); padding-top:var(--s-3);">
          <div class="skeleton" style="width:30%; height:8px; border-radius:var(--r-xs);"></div>
          <div class="skeleton" style="width:20%; height:8px; border-radius:var(--r-xs);"></div>
        </div>
      `;
      wrapper.appendChild(sk);
    }
    g.appendChild(wrapper);
  }

  function navigateToChapter(id) {
    if (typeof window.navigateTo === 'function') {
      window.navigateTo(`chapter.html?id=${id}`);
    } else {
      window.location.href = `chapter.html?id=${id}`;
    }
  }

  async function load() {
    renderSkeletons();
    try {
      const url = `/chapters${_showArchived ? '?archived=true' : ''}`;
      const data = await apiFetch(url);
      _chapters = data.chapters || [];
      render();
    } catch (err) {
      const { message } = handleApiError(err, 'ChaptersGrid.load');
      showToast(message, 'error', {
        label: 'Retry',
        callback: load,
      });
      grid().innerHTML = ''; // clear skeletons
    }
  }

  function initToolbar() {
    const searchInput = document.getElementById('chapter-search');
    const sortSelect = document.getElementById('chapter-sort');
    const archiveBtn = document.getElementById('btn-show-archived');

    searchInput?.addEventListener('input', debounce((e) => {
      _searchTerm = e.target.value.trim();
      render();
    }, 250));

    sortSelect?.addEventListener('change', (e) => {
      _sortKey = e.target.value;
      render();
    });

    archiveBtn?.addEventListener('click', () => {
      _showArchived = !_showArchived;
      archiveBtn.classList.toggle('active', _showArchived);
      load();
    });
  }

  return { load, render, renderSkeletons, initToolbar };
})();

window.ChaptersGrid = ChaptersGrid;