/* ================================================================
   HISAAB-KITAAB — js/core/theme-loader.js
   Synchronous theme loader. Prevents Flash of Unstyled Content (FOUC).
   ================================================================ */

(function () {
  try {
    const savedTheme = localStorage.getItem('hk_theme') || 'dark';
    if (savedTheme === 'weekly') {
      const themes = ['light', 'dark', 'beige', 'matcha', 'lavender', 'midnight-neon'];
      const msInWeek = 7 * 24 * 60 * 60 * 1000;
      const weekIndex = Math.floor(Date.now() / msInWeek);
      const activeTheme = themes[weekIndex % themes.length];
      document.documentElement.setAttribute('data-theme', activeTheme);
      document.documentElement.setAttribute('data-theme-mode', 'weekly');
    } else {
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.documentElement.removeAttribute('data-theme-mode');
    }
  } catch (e) {
    // Avoid blocking if localStorage is restricted
  }
})();
