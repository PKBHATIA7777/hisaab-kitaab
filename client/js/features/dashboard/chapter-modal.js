/**
 * Chapter create/edit modal — wired to EVENTS.CHAPTER_MODAL_OPEN.
 */
const ChapterModal = (() => {
  function _open(data = {}) {
    const isEdit = !!data.id;
    const overlay = ModalManager.createOverlay(`
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Chapter' : 'New Chapter'}</h2>
        <button class="modal-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style="padding:0 20px 24px;">
        <form id="chapter-form">
          <div class="form-group">
            <label class="form-label" for="ch-name">Chapter Name *</label>
            <input type="text" id="ch-name" class="form-input" maxlength="100" required
              placeholder="e.g. Goa Trip 2025" value="${data.name ? escapeHTML(data.name) : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="ch-desc">Description <span class="form-label__optional">(optional)</span></label>
            <input type="text" id="ch-desc" class="form-input" maxlength="50"
              placeholder="Short description" value="${data.description ? escapeHTML(data.description) : ''}">
          </div>
          ${!isEdit ? `
          <div class="form-group">
            <label class="form-label">Members <span class="form-label__optional">(you are added automatically)</span></label>
            <div id="ch-members-list" style="display:flex;flex-direction:column;gap:var(--s-2);margin-bottom:var(--s-2);"></div>
            <button type="button" class="btn-add-member" id="ch-add-member">+ Add Member</button>
          </div>` : ''}
          <button type="submit" class="btn btn--primary" id="ch-submit">${isEdit ? 'Save Changes' : 'Create Chapter'}</button>
        </form>
      </div>
    `, { type: 'center' });

    overlay.querySelector('.modal-close').addEventListener('click', () => ModalManager.close(overlay));

    if (!isEdit) {
      overlay.querySelector('#ch-add-member').addEventListener('click', () => {
        const list = overlay.querySelector('#ch-members-list');
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:var(--s-2);align-items:center;';
        row.innerHTML = `
          <input type="text" class="form-input ch-member-input" placeholder="Member name" style="flex:1;">
          <button type="button" style="color:var(--negative);background:none;border:none;font-size:1.2rem;cursor:pointer;padding:4px;">×</button>
        `;
        row.querySelector('button').addEventListener('click', () => row.remove());
        list.appendChild(row);
        row.querySelector('input').focus();
      });
    }

    overlay.querySelector('#chapter-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = overlay.querySelector('#ch-name').value.trim();
      if (!name) return;
      const description = overlay.querySelector('#ch-desc')?.value.trim() || '';
      const btn = overlay.querySelector('#ch-submit');
      btn.classList.add('btn--loading'); btn.disabled = true;
      try {
        if (isEdit) {
          await apiFetch(`/chapters/${data.id}`, { method: 'PUT', body: { name, description } });
          showToast('Chapter updated', 'success');
          if (typeof window.haptic === 'function') window.haptic('success');
        } else {
          const memberInputs = overlay.querySelectorAll('.ch-member-input');
          const members = [...memberInputs].map(i => ({ name: i.value.trim() })).filter(m => m.name);
          await apiFetch('/chapters', { method: 'POST', body: { name, description, members } });
          showToast('Chapter created!', 'success');
          if (typeof window.haptic === 'function') window.haptic('success');
        }
        ModalManager.close(overlay);
        await ChaptersGrid.load();
      } catch (err) {
        showToast(err.message || 'Failed', 'error');
        btn.classList.remove('btn--loading'); btn.disabled = false;
      }
    });

    setTimeout(() => overlay.querySelector('#ch-name')?.focus(), 350);
  }

  EventBus.on(EVENTS.CHAPTER_MODAL_OPEN, _open);
  return { open: _open };
})();

window.ChapterModal = ChapterModal;