/* client/js/core/modal-manager.js */
/**
 * Modal Manager — Single controller for all overlays.
 *
 * ARCHITECTURE:
 * - All modals are direct children of <body>. No modal lives inside
 *   .chapter-page or any wrapper with isolation:isolate.
 * - This permanently fixes the stacking context freeze bugs.
 * - One modal open at a time by default (configurable).
 * - Handles: scroll lock, focus trap, Escape key, back-click.
 */
const ModalManager = (() => {
  const _stack = [];     // Stack of open modal elements
  const _cleanups = new WeakMap();

  /* ── SCROLL LOCK ──────────────────────────────────────── */
  let _scrollY = 0;

  function _lockScroll() {
    _scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_scrollY}px`;
    document.body.style.width = '100%';
    document.body.classList.add('modal-open');
  }

  function _unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.classList.remove('modal-open');
    window.scrollTo(0, _scrollY);
  }

  /* ── FOCUS TRAP ───────────────────────────────────────── */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function _trapFocus(el) {
    const getFocusable = () => [...el.querySelectorAll(FOCUSABLE)]
      .filter(node => node.offsetParent !== null && window.getComputedStyle(node).visibility !== 'hidden');
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    };
    el.addEventListener('keydown', handler);
    // Focus first element
    setTimeout(() => getFocusable()[0]?.focus(), 60);
    return () => el.removeEventListener('keydown', handler);
  }

  /* ── ESCAPE KEY ───────────────────────────────────────── */
  function _onEscape(e) {
    if (e.key === 'Escape' && _stack.length > 0) {
      const top = _stack[_stack.length - 1];
      if (top.dataset.closeOnEscape !== 'false') close(top);
    }
  }

  /* ── PUBLIC API ───────────────────────────────────────── */

  /**
   * open(overlayEl, options?)
   * overlayEl: an .modal-overlay element.
   * The element MUST be appended to document.body before calling open().
   */
  function open(overlayEl, options = {}) {
    const { closeOnBackdrop = true, closeOnEscape = true } = options;

    // Save the element that triggered the modal
    const triggerElement = document.activeElement;

    // Append to body if not already there (guarantees correct stacking context)
    if (overlayEl.parentElement !== document.body) {
      document.body.appendChild(overlayEl);
    }

    // Lock scroll on first modal
    if (_stack.length === 0) _lockScroll();
    _stack.push(overlayEl);

    if (!closeOnEscape) overlayEl.dataset.closeOnEscape = 'false';

    // Show
    requestAnimationFrame(() => overlayEl.classList.add('is-open'));

    // Backdrop click
    const backdropHandler = (e) => {
      if (closeOnBackdrop && e.target === overlayEl) close(overlayEl);
    };
    overlayEl.addEventListener('click', backdropHandler);

    // Focus trap
    const innerEl = overlayEl.querySelector('.modal-box, .modal-sheet');
    const cleanupFocus = innerEl ? _trapFocus(innerEl) : null;

    // Escape listener (only add once)
    if (_stack.length === 1) document.addEventListener('keydown', _onEscape);

    _cleanups.set(overlayEl, { backdropHandler, cleanupFocus, triggerElement });
  }

  function close(overlayEl) {
    const idx = _stack.indexOf(overlayEl);
    if (idx === -1) return;

    _stack.splice(idx, 1);

    const { backdropHandler, cleanupFocus, triggerElement } = _cleanups.get(overlayEl) || {};
    if (backdropHandler) overlayEl.removeEventListener('click', backdropHandler);
    if (cleanupFocus) cleanupFocus();
    _cleanups.delete(overlayEl);

    overlayEl.classList.remove('is-open');

    // Unlock scroll when stack is empty
    if (_stack.length === 0) {
      _unlockScroll();
      document.removeEventListener('keydown', _onEscape);
    }

    // Restore focus if possible
    if (triggerElement && typeof triggerElement.focus === 'function') {
      setTimeout(() => triggerElement.focus(), 10);
    }

    // Remove from DOM after transition
    setTimeout(() => {
      if (!overlayEl.classList.contains('is-open') && overlayEl.parentElement === document.body) {
        // Only remove if it was dynamically created (has data-dynamic attribute)
        if (overlayEl.dataset.dynamic) document.body.removeChild(overlayEl);
      }
    }, 350);
  }

  function closeAll() {
    [..._stack].reverse().forEach(close);
  }

  /**
   * createOverlay(content, options?)
   * Convenience: creates, appends, and opens a modal in one call.
   * Returns the overlay element.
   *
   * options.type: 'center' (default) | 'bottom'
   */
  function createOverlay(contentHTML, options = {}) {
    const { type = 'center', maxWidth = '480px', closeOnBackdrop = true } = options;
    const isBottom = type === 'bottom';

    const overlay = document.createElement('div');
    overlay.className = `modal-overlay${isBottom ? ' modal-overlay--bottom' : ''}`;
    overlay.dataset.dynamic = 'true';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const inner = document.createElement('div');
    inner.className = isBottom ? 'modal-sheet' : 'modal-box';
    if (!isBottom && maxWidth) inner.style.maxWidth = maxWidth;

    inner.innerHTML = contentHTML;
    overlay.appendChild(inner);

    document.body.appendChild(overlay);
    open(overlay, { closeOnBackdrop });
    return overlay;
  }

  return { open, close, closeAll, createOverlay };
})();

window.ModalManager = ModalManager;