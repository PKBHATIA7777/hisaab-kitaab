/**
 * Shared navigation utility supporting the View Transitions API.
 */
window.navigateTo = function(url) {
  // Add fallback navigation class for CSS transition animation
  document.body.classList.add('is-navigating');

  if (document.startViewTransition) {
    document.startViewTransition(() => {
      window.location.href = url;
    });
  } else {
    // If View Transitions are not supported, wait for the fade-out CSS animation (140ms)
    setTimeout(() => {
      window.location.href = url;
    }, 140);
  }
};
