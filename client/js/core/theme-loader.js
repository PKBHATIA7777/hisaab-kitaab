/* ================================================================
   HISAAB-KITAAB — js/core/theme-loader.js
   Synchronous theme loader. Prevents Flash of Unstyled Content (FOUC).
   ================================================================ */

(function () {
  try {
    const savedTheme = localStorage.getItem('hk_theme') || 'light';
    let activeTheme = savedTheme;
    if (savedTheme === 'weekly') {
      const themes = ['light', 'dark', 'beige', 'matcha', 'lavender', 'midnight-neon'];
      const msInWeek = 7 * 24 * 60 * 60 * 1000;
      const weekIndex = Math.floor(Date.now() / msInWeek);
      activeTheme = themes[weekIndex % themes.length];
      document.documentElement.setAttribute('data-theme', activeTheme);
      document.documentElement.setAttribute('data-theme-mode', 'weekly');
    } else {
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.documentElement.removeAttribute('data-theme-mode');
    }

    // Dynamic font loading for themes
    const fontLinks = {
      'beige': 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
      'lavender': 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
      'matcha': 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap',
      'midnight-neon': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap'
    };
    const url = fontLinks[activeTheme];
    if (url) {
      const link = document.createElement('link');
      link.id = 'font-theme-' + activeTheme;
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    }
  } catch (e) {
    // Avoid blocking if localStorage is restricted
  }
})();
