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
      newest:  (a, b) => new Date(b.created_at) - new Date(a.created_at),
      oldest:  (a, b) => new Date(a.created_at) - new Date(b.created_at),
      az:      (a, b) => a.name.localeCompare(b.name),
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
    const color    = getAvatarColor(chapter.name);
    const time     = window.timeAgo(chapter.created_at);
    const isPersonal = chapter.is_personal;
    const isArchived = chapter.is_archived;

    const card = document.createElement('div');
    card.className = `card card--interactive chapter-card${isArchived ? ' chapter-card--archived' : ''}`;
    card.dataset.chapterId = chapter.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Open ${chapter.name}`);

    card.innerHTML = `
      <div class="chapter-card__header">
        <div class="avatar avatar--sm" style="background:${color}">${initials}</div>
        ${isPersonal ? '<span class="badge badge--brand">My Expenses</span>' : ''}
        <button class="btn btn--icon chapter-card__menu"
                aria-label="More options for ${escapeHTML(chapter.name)}"
                aria-haspopup="true" aria-expanded="false"
                data-chapter-id="${chapter.id}"
                data-chapter-name="${escapeHTML(chapter.name)}"
                data-chapter-desc="${escapeHTML(chapter.description || '')}"
                data-is-archived="${chapter.is_archived}"
                data-is-personal="${isPersonal}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>
      <div class="chapter-card__name">${escapeHTML(chapter.name)}</div>
      <div class="chapter-card__footer">
        <span>${chapter.member_count} member${chapter.member_count !== 1 ? 's' : ''}</span>
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
      apiFetch(`/chapters/${chapter.id}`).catch(() => {});
      apiFetch(`/expenses/chapter/${chapter.id}?limit=50&offset=0`).catch(() => {});
    };
    card.addEventListener('mouseenter', prefetch, { passive: true });
    card.addEventListener('touchstart', prefetch, { passive: true });

    return card;
  }

  function _buildAddCard() {
    const card = document.createElement('div');
    card.className = 'card chapter-card chapter-card--add';
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
        <span class="empty-state__icon">📂</span>
        <h3 class="empty-state__title">No chapters yet</h3>
        <p class="empty-state__subtitle">Create a chapter to start tracking expenses with friends or family.</p>
        <div class="empty-state__action">
          <button class="btn btn--brand" onclick="EventBus.emit(EVENTS.CHAPTER_MODAL_OPEN, {})">
            + Create First Chapter
          </button>
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

  function renderSkeletons(count = 4) {
    const g = grid();
    if (!g) return;
    g.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'card skeleton chapter-card';
      sk.setAttribute('aria-hidden', 'true');
      sk.innerHTML = `
        <div class="skeleton" style="width:38px;height:38px;border-radius:var(--r-sm);"></div>
        <div class="skeleton" style="width:60%;height:14px;border-radius:var(--r-sm);margin:var(--s-3) auto;"></div>
        <div class="skeleton" style="width:40%;height:10px;border-radius:var(--r-sm);margin:0 auto;"></div>
      `;
      g.appendChild(sk);
    }
  }

  function navigateToChapter(id) {
    document.body.classList.add('is-navigating');
    setTimeout(() => window.location.href = `chapter.html?id=${id}`, 150);
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

  // Wire up toolbar controls
  function initToolbar() {
    const searchInput = document.getElementById('chapter-search');
    const sortSelect  = document.getElementById('chapter-sort');
    const archiveBtn  = document.getElementById('btn-show-archived');

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
      archiveBtn.textContent = _showArchived ? '📋 Active' : '🗃️ Archived';
      archiveBtn.classList.toggle('btn--active', _showArchived);
      load();
    });
  }

  return { load, render, renderSkeletons, initToolbar };
})();

window.ChaptersGrid = ChaptersGrid;