/* client/js/core/event-bus.js */

/**
 * EVENTS — typed constants for all EventBus event names.
 * Use these instead of raw strings everywhere.
 * A typo here is a compile-time catch rather than a silent runtime failure.
 */
const EVENTS = Object.freeze({
  // Chapter lifecycle
  CHAPTER_LOADED:              'chapter:loaded',
  CHAPTER_UPDATED:             'chapter:updated',

  // Expense operations
  EXPENSE_MODAL_OPEN:          'expense:modal:open',
  EXPENSE_MODAL_CLOSE:         'expense:modal:close',
  EXPENSE_SAVED:               'expense:saved',
  EXPENSE_DELETED:             'expense:deleted',
  EXPENSES_RENDERED:           'expenses:rendered',

  // Settlement operations
  SETTLEMENT_REFRESH:          'settlement:refresh',
  SETTLEMENT_MARKED:           'settlement:marked',

  // Event (sub-chapter) operations
  EVENT_CREATED:               'event:created',
  EVENT_SWITCHED:              'event:switched',

  // Selection mode
  SELECTION_MODE_ENTER:        'selection:mode:enter',
  SELECTION_MODE_EXIT:         'selection:mode:exit',

  // Dashboard
  DASHBOARD_CHAPTERS_RENDERED: 'dashboard:chapters:rendered',

  // Profile / modal
  PROFILE_MODAL_OPEN:          'profile:modal:open',
  PROFILE_MODAL_CLOSE:         'profile:modal:close',

  // Summary
  SUMMARY_RENDERED:            'summary:rendered',
  SUMMARY_MODAL_OPEN:          'summary:modal:open',

  // Members
  MEMBERS_RENDERED:            'members:rendered',

  // Chapter modal (dashboard)
  CHAPTER_MODAL_OPEN:          'chapter:modal:open',
  CHAPTER_MODAL_CLOSE:         'chapter:modal:close',
});

window.EVENTS = EVENTS;

/**
 * Minimal typed event bus.
 * Feature scripts subscribe; host scripts emit.
 * Zero polling. Zero monkey-patching.
 *
 * Usage:
 *   EventBus.on(EVENTS.EXPENSE_MODAL_OPEN, handler)
 *   EventBus.emit(EVENTS.EXPENSE_MODAL_OPEN, { expense, mode: 'add' })
 *   EventBus.off(EVENTS.EXPENSE_MODAL_OPEN, handler)
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
    const wrapper = (data) => {
      handler(data);
      off(event, wrapper);
    };
    return on(event, wrapper);
  }

  function off(event, handler) {
    _listeners.get(event)?.delete(handler);
  }

  function emit(event, data) {
    _listeners.get(event)?.forEach(h => {
      try {
        h(data);
      } catch (err) {
        console.error(`[EventBus] Handler error for "${event}":`, err);
      }
    });
  }

  return { on, once, off, emit };
})();

window.EventBus = EventBus;

/*
  DEFINED EVENTS (document contract between host and feature scripts):

  Chapter page:
    EVENTS.CHAPTER_LOADED              — { chapter, members, currentUser }
    EVENTS.CHAPTER_UPDATED             — { chapter }

    EVENTS.EXPENSE_MODAL_OPEN          — { mode: 'add' | 'edit', expense?: {} }
    EVENTS.EXPENSE_MODAL_CLOSE         — {}
    EVENTS.EXPENSE_SAVED               — { expense }
    EVENTS.EXPENSE_DELETED             — { expenseId }
    EVENTS.EXPENSES_RENDERED           — { expenses[] }

    EVENTS.SETTLEMENT_REFRESH          — {}
    EVENTS.SETTLEMENT_MARKED           — {}

    EVENTS.EVENT_CREATED               — { event }
    EVENTS.EVENT_SWITCHED              — { eventId }

    EVENTS.SELECTION_MODE_ENTER        — {}
    EVENTS.SELECTION_MODE_EXIT         — {}

    EVENTS.SUMMARY_RENDERED            — {}
    EVENTS.SUMMARY_MODAL_OPEN          — {}

    EVENTS.MEMBERS_RENDERED            — {}

  Dashboard:
    EVENTS.DASHBOARD_CHAPTERS_RENDERED — { chapters[] }

    EVENTS.PROFILE_MODAL_OPEN          — {}
    EVENTS.PROFILE_MODAL_CLOSE         — {}

    EVENTS.CHAPTER_MODAL_OPEN          — {}
    EVENTS.CHAPTER_MODAL_CLOSE         — {}
*/