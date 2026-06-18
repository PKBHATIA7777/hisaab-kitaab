/* ================================================================
   HISAAB-KITAAB — js/core/theme-loader.js
   Synchronous theme loader. Prevents Flash of Unstyled Content (FOUC).
   ================================================================ */

(function () {
  try {
    const savedTheme = localStorage.getItem('hk_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  } catch (e) {
    // Avoid blocking if localStorage is restricted
  }
})();
