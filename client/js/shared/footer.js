/**
 * js/shared/footer.js
 * ─────────────────────────────────────────────────────────────────
 * Shared footer component — defined ONCE here, injected everywhere.
 *
 * Usage in any HTML page:
 *   1. Place <footer id="app-footer"></footer> where footer should go.
 *   2. Include this script: <script src="js/shared/footer.js" defer></script>
 *
 * The script finds #app-footer and fills it with the footer markup.
 * Zero duplication — update the footer in this one file only.
 * ─────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const FOOTER_HTML = `
    <div class="footer-inner">
      <div class="footer-grid">

        <div class="footer-col footer-col--brand">
          <div class="footer-brand-name">Hisaab-Kitaab</div>
          <p class="footer-tagline">
            The smartest way to track shared expenses and settle debts with friends and family.
          </p>
        </div>

        <div class="footer-col">
          <h5 class="footer-heading">Quick Links</h5>
          <nav class="footer-links" aria-label="Footer navigation">
            <a href="/index.html">Home</a>
            <a href="/about.html">About Us</a>
            <a href="/privacy.html">Privacy Policy</a>
          </nav>
        </div>

        <div class="footer-col">
          <h5 class="footer-heading">Developer</h5>
          <p class="footer-dev-text">
            Developed &amp; managed by<br>
            <a
              href="https://wa.me/919868097145"
              target="_blank"
              rel="noopener noreferrer"
              class="footer-dev-link"
              aria-label="Contact A Plus Technologies on WhatsApp"
            >A PLUS TECHNOLOGIES</a>
          </p>
        </div>

      </div>

      <div class="footer-bottom">
        <span>&copy; <span class="footer-year"></span> Hisaab-Kitaab. All rights reserved.</span>
      </div>
    </div>
  `;

  function inject() {
    const el = document.getElementById('app-footer');
    if (!el) return;
    el.innerHTML = FOOTER_HTML;

    // Set the current year dynamically — no hardcoding
    const yearEl = el.querySelector('.footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Mark current active link in navigation with aria-current="page"
    const pathname = window.location.pathname;
    const links = el.querySelectorAll('.footer-links a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (pathname === href || pathname.endsWith(href) || (pathname === '/' && href.includes('index.html')))) {
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
