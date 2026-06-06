/* client/js/core/event-bus.js */
/**
 * Minimal typed event bus.
 * Feature scripts subscribe; host scripts emit.
 * Zero polling. Zero monkey-patching.
 *
 * Usage:
 *   EventBus.on('expense:modal:open', handler)
 *   EventBus.emit('expense:modal:open', { expense, mode: 'add' })
 *   EventBus.off('expense:modal:open', handler)
 */
const EventBus = (() => {
  const _listeners = new Map();

  function on(event, handler) {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event).add(handler);
    // Return cleanup function for convenience
    return () => off(event, handler);
  }

  function once(event, handler) {
    const wrapper = (data) => { handler(data); off(event, wrapper); };
    return on(event, wrapper);
  }

  function off(event, handler) {
    _listeners.get(event)?.delete(handler);
  }

  function emit(event, data) {
    _listeners.get(event)?.forEach(h => {
      try { h(data); }
      catch (err) { console.error(`[EventBus] Handler error for "${event}":`, err); }
    });
  }

  return { on, once, off, emit };
})();

window.EventBus = EventBus;

/*
  DEFINED EVENTS (document contract between host and feature scripts):

  Chapter page:
    'chapter:loaded'              — { chapter, members, currentUser }
    'expense:modal:open'          — { mode: 'add' | 'edit', expense?: {} }
    'expense:modal:close'         — {}
    'expense:saved'               — { expense }
    'expense:deleted'             — { expenseId }
    'expenses:rendered'           — { expenses[] }
    'settlement:refresh'          — {}
    'event:switched'              — { eventId }
    'selection:mode:enter'        — {}
    'selection:mode:exit'         — {}

  Dashboard:
    'dashboard:chapters:rendered' — { chapters[] }
    'profile:modal:open'          — {}
    'profile:modal:close'         — {}
*/