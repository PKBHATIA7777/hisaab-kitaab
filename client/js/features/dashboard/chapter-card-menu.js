/**
 * Card kebab menu — handles edit, archive, delete for a chapter card.
 */
const ChapterCardMenu = (() => {
  let _activeMenu = null;

  function _closeActive() {
    if (_activeMenu) { _activeMenu.remove(); _activeMenu = null; }
  }

  function open(triggerBtn, chapter) {
    _closeActive();

    const menu = document.createElement('div');
    menu.className = 'card-menu is-open';
    menu.innerHTML = `
      <button class="card-menu__item" data-action="edit"> Edit</button>
      ${!chapter.is_personal ? `<button class="card-menu__item" data-action="archive">${chapter.is_archived ? ' Restore' : ' Mark Settled'}</button>` : ''}
      ${!chapter.is_personal ? `<button class="card-menu__item card-menu__item--danger" data-action="delete"> Delete</button>` : ''}
    `;

    // Position relative to trigger
    const card = triggerBtn.closest('.chapter-card');
    if (card) { card.style.position = 'relative'; card.appendChild(menu); }
    else { document.body.appendChild(menu); }
    _activeMenu = menu;

    menu.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      _closeActive();

      if (action === 'edit') {
        EventBus.emit(EVENTS.CHAPTER_MODAL_OPEN, { id: chapter.id, name: chapter.name, description: chapter.description });
      } else if (action === 'archive') {
        try {
          await apiFetch(`/chapters/${chapter.id}/archive`, { method: 'PATCH', body: { is_archived: !chapter.is_archived } });
          showToast(chapter.is_archived ? 'Chapter restored' : 'Marked as settled', 'success');
          if (typeof window.haptic === 'function') window.haptic('success');
          ChaptersGrid.load();
        } catch (err) { showToast(err.message || 'Failed', 'error'); }
      } else if (action === 'delete') {
        if (!confirm(`Delete "${chapter.name}"? This cannot be undone.`)) return;
        try {
          await apiFetch(`/chapters/${chapter.id}`, { method: 'DELETE' });
          showToast('Chapter deleted', 'info');
          if (typeof window.haptic === 'function') window.haptic('medium');
          ChaptersGrid.load();
        } catch (err) { showToast(err.message || 'Failed', 'error'); }
      }
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', _closeActive, { once: true });
    }, 0);
  }

  return { open };
})();

window.ChapterCardMenu = ChapterCardMenu;