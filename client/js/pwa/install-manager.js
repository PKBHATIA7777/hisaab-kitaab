/* client/js/pwa/install-manager.js */
/**
 * PWA Install Manager — Definitive Version
 *
 * Merged best-of-both from pwa-install.js and the previous install-manager.js:
 * - Full browser/device detection matrix (Chrome, Edge, Brave, Samsung, Firefox,
 *   Opera, Safari macOS, all iOS variants)
 * - iOS version detection + macOS Safari 17+ "Add to Dock" support
 * - Correct iOS Safari arrow direction (iPhone bottom ↓, iPad top-right ↗)
 * - Engagement-based auto-popup (3+ visits AND on dashboard only)
 * - beforeinstallprompt captured early, UI updated after DOM ready
 * - SafeStorage with localStorage → sessionStorage → memory fallback
 * - 7-day dismiss cooldown
 * - Profile section install button wired correctly
 */
(function () {
  "use strict";

  // ── SAFE STORAGE ────────────────────────────────────────────
  // Uses window.SafeStorage if available (loaded from core/storage.js),
  // otherwise falls back to a local implementation
  const Store = window.SafeStorage || (() => {
    const _mem = new Map();
    function tryLS(op, key, val) {
      try {
        if (op === "get") return { ok: true, value: localStorage.getItem(key) };
        if (op === "set") { localStorage.setItem(key, val); return { ok: true }; }
        if (op === "remove") { localStorage.removeItem(key); return { ok: true }; }
      } catch (_) { return { ok: false }; }
    }
    function trySS(op, key, val) {
      try {
        if (op === "get") return { ok: true, value: sessionStorage.getItem(key) };
        if (op === "set") { sessionStorage.setItem(key, val); return { ok: true }; }
        if (op === "remove") { sessionStorage.removeItem(key); return { ok: true }; }
      } catch (_) { return { ok: false }; }
    }
    return {
      get(key) {
        const r = tryLS("get", key); if (r.ok) return r.value;
        const s = trySS("get", key); if (s.ok) return s.value;
        return _mem.get(key) ?? null;
      },
      set(key, value) {
        const r = tryLS("set", key, value);
        if (!r.ok) { const s = trySS("set", key, value); if (!s.ok) _mem.set(key, value); }
      },
      remove(key) { tryLS("remove", key); trySS("remove", key); _mem.delete(key); },
    };
  })();

  // ── DETECTION ───────────────────────────────────────────────
  const ua = navigator.userAgent;
  const platform = navigator.platform || "";

  const detect = {
    isIOS: /iPad|iPhone|iPod/.test(ua) ||
            (platform === "MacIntel" && navigator.maxTouchPoints > 1),
    isIPad: /iPad/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1),
    isAndroid: /Android/.test(ua),
    isWindows: /Windows/.test(ua) || /Win/.test(platform),
    isMac: /Macintosh|MacIntel/.test(ua) && navigator.maxTouchPoints === 0,

    // Browser detection — order matters (most specific first)
    isSamsung: /SamsungBrowser/.test(ua),
    isEdge: /Edg\/|EdgA?\//.test(ua),
    isOpera: /OPR\/|Opera/.test(ua),
    isFirefox: /Firefox/.test(ua) && !/Seamonkey/.test(ua),
    isChrome: /Chrome/.test(ua) && !/Chromium|Edg\/|EdgA?\/|OPR\/|SamsungBrowser/.test(ua),
    isSafari: /Safari/.test(ua) && !/Chrome|Chromium|Android|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua),
    isBrave: false, // Resolved async below

    // iOS browser variants
    get isIOSSafari() { return this.isIOS && this.isSafari; },
    get isIOSChrome() { return this.isIOS && /CriOS/.test(ua); },
    get isIOSFirefox() { return this.isIOS && /FxiOS/.test(ua); },
    get isIOSEdge() { return this.isIOS && /EdgiOS/.test(ua); },

    // Already installed as PWA
    isStandalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true,

    get isLandscape() {
      return window.matchMedia("(orientation: landscape)").matches;
    },

    // iOS version number
    get iOSVersion() {
      const m = ua.match(/OS (\d+)_(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    },

    // macOS Safari version
    get safariVersion() {
      const m = ua.match(/Version\/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    },

    // Samsung Internet version (14+ supports beforeinstallprompt)
    get samsungVersion() {
      const m = ua.match(/SamsungBrowser\/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    },
  };

  // Async Brave detection
  if (navigator.brave && navigator.brave.isBrave) {
    navigator.brave.isBrave().then((b) => { detect.isBrave = b; }).catch(() => {});
  }

  // ── STATE ────────────────────────────────────────────────────
  let deferredPrompt = null;

  const DISMISS_KEY   = "pwa_dismissed_at";
  const INSTALL_KEY   = "pwa_installed";
  const VISIT_KEY     = "pwa_visit_count";
  const DISMISS_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days

  const state = {
    get isDismissed() {
      const t = Store.get(DISMISS_KEY);
      return t ? Date.now() - parseInt(t, 10) < DISMISS_COOLDOWN : false;
    },
    get isInstalled() {
      // iOS never fires 'appinstalled', so detect standalone and persist it
      if (detect.isStandalone) {
        Store.set(INSTALL_KEY, "true");
        return true;
      }
      return Store.get(INSTALL_KEY) === "true";
    },
    get visitCount() {
      return parseInt(Store.get(VISIT_KEY) || "0", 10);
    },
    markDismissed() { Store.set(DISMISS_KEY, Date.now().toString()); },
    markInstalled() { Store.set(INSTALL_KEY, "true"); },
    incrementVisit() { Store.set(VISIT_KEY, (this.visitCount + 1).toString()); },
  };

  // ── CAPTURE beforeinstallprompt EARLY ───────────────────────
  // Capture as early as possible (before DOM ready) but only update UI after DOM
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Flag for cross-page awareness (e.g., captured on index, used on dashboard)
    Store.set("pwa_prompt_available", "1");
    // Update UI only if DOM is ready
    if (document.readyState !== "loading") {
      updateInstallUI();
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    state.markInstalled();
    Store.remove("pwa_prompt_available");
    hidePopup();
    updateInstallUI();
    if (window.showToast) window.showToast("App installed! 🎉", "success");
  });

  // ── INSTALL CONFIG ───────────────────────────────────────────
  function getConfig() {
    if (detect.isStandalone) return { type: "installed" };

    const promptAvailable = !!deferredPrompt || Store.get("pwa_prompt_available") === "1";

    // ── iOS ──────────────────────────────────────────────────
    if (detect.isIOS) {
      const isIPad = detect.isIPad;
      const isLandscape = detect.isLandscape;

      // Share button location description
      const shareLocation = isIPad
        ? "the top right area of Safari"
        : "the bottom of Safari";

      if (detect.isIOSSafari) {
        return {
          type: "manual",
          browser: "safari-ios",
          title: "Add to Home Screen",
          icon: "📲",
          canInstallDirectly: false,
          isIOS: true,
          isIPad,
          steps: [
            {
              icon: "1️⃣",
              text: `Tap the <strong>Share</strong> button`,
              sub: `The box with an arrow — at ${shareLocation}`,
            },
            {
              icon: "2️⃣",
              text: "Scroll and tap <strong>Add to Home Screen</strong>",
              sub: "It has a + icon in a square",
            },
            {
              icon: "3️⃣",
              text: "Tap <strong>Add</strong> to confirm",
              sub: "The app icon will appear on your home screen",
            },
          ],
          note: "This only works in Safari. If you are in another browser, open this page in Safari first.",
        };
      }

      if (detect.isIOSChrome) {
        return {
          type: "manual",
          browser: "chrome-ios",
          title: "Add to Home Screen",
          icon: "📲",
          canInstallDirectly: false,
          isIOS: true,
          steps: [
            { icon: "1️⃣", text: "Tap the <strong>⋯</strong> menu button", sub: "Three dots in the bottom right" },
            { icon: "2️⃣", text: "Tap <strong>Add to Home Screen</strong>", sub: "" },
            { icon: "3️⃣", text: "Tap <strong>Add</strong> to confirm", sub: "" },
          ],
          note: "For the best experience, open this page in Safari and add from there.",
        };
      }

      if (detect.isIOSFirefox) {
        return {
          type: "manual",
          browser: "firefox-ios",
          title: "Add to Home Screen",
          icon: "📲",
          canInstallDirectly: false,
          isIOS: true,
          steps: [
            { icon: "1️⃣", text: "Tap the <strong>⋯</strong> menu at the bottom", sub: "" },
            { icon: "2️⃣", text: "Tap <strong>Share</strong>", sub: "" },
            { icon: "3️⃣", text: "Tap <strong>Add to Home Screen</strong>", sub: "" },
          ],
          note: "For full PWA features, use Safari to add to home screen.",
        };
      }

      // All other iOS browsers
      return {
        type: "manual",
        browser: "other-ios",
        title: "Install App",
        icon: "📲",
        canInstallDirectly: false,
        isIOS: true,
        steps: [
          { icon: "💡", text: "Open this page in <strong>Safari</strong>", sub: "Copy the URL and paste in Safari" },
          { icon: "1️⃣", text: "Tap the <strong>Share ↑</strong> button", sub: "At the bottom of Safari" },
          { icon: "2️⃣", text: "Tap <strong>Add to Home Screen</strong>", sub: "" },
        ],
        note: "PWA installation on iOS works best through Safari.",
      };
    }

    // ── Android ──────────────────────────────────────────────
    if (detect.isAndroid) {
      // Samsung Internet 14+ supports native prompt
      if (detect.isSamsung && detect.samsungVersion >= 14 && promptAvailable) {
        return { type: "prompt", browser: "samsung", canInstallDirectly: true, title: "Install App", icon: "📱", buttonText: "Install" };
      }
      if (detect.isSamsung) {
        return {
          type: "manual",
          browser: "samsung",
          title: "Add to Home Screen",
          icon: "📱",
          canInstallDirectly: false,
          steps: [
            { icon: "1️⃣", text: "Tap the <strong>⋮ menu</strong>", sub: "Top right of Samsung Internet" },
            { icon: "2️⃣", text: "Tap <strong>Add page to</strong>", sub: "" },
            { icon: "3️⃣", text: "Select <strong>Home screen</strong>", sub: "" },
          ],
        };
      }
      if (detect.isFirefox) {
        return {
          type: "manual",
          browser: "firefox-android",
          title: "Add to Home Screen",
          icon: "📱",
          canInstallDirectly: false,
          steps: [
            { icon: "1️⃣", text: "Tap the <strong>⋮ menu</strong>", sub: "Three dots at the bottom right" },
            { icon: "2️⃣", text: "Tap <strong>Install</strong>", sub: 'Or "Add to Home Screen"' },
          ],
        };
      }
      if (detect.isOpera) {
        return {
          type: "manual",
          browser: "opera-android",
          title: "Add to Home Screen",
          icon: "📱",
          canInstallDirectly: false,
          steps: [
            { icon: "1️⃣", text: "Tap the <strong>Opera logo</strong> or <strong>⋮</strong>", sub: "" },
            { icon: "2️⃣", text: "Tap <strong>Home Screen</strong>", sub: "" },
          ],
        };
      }
      // Chrome, Edge, Brave on Android — support native prompt
      if (detect.isChrome || detect.isEdge || detect.isBrave) {
        return {
          type: "prompt",
          browser: detect.isEdge ? "edge-android" : detect.isBrave ? "brave-android" : "chrome-android",
          canInstallDirectly: true,
          title: "Install App",
          icon: "📱",
          buttonText: "Install",
        };
      }
      // Generic Android fallback
      return { type: "prompt", browser: "android-generic", canInstallDirectly: promptAvailable, title: "Install App", icon: "📱", buttonText: "Install" };
    }

    // ── Desktop ──────────────────────────────────────────────
    if (!detect.isIOS && !detect.isAndroid) {
      if (detect.isChrome || detect.isEdge || detect.isBrave) {
        return {
          type: "prompt",
          browser: detect.isEdge ? "edge-desktop" : detect.isBrave ? "brave-desktop" : "chrome-desktop",
          canInstallDirectly: promptAvailable,
          title: "Install App",
          icon: "💻",
          buttonText: "Install",
        };
      }
      if (detect.isFirefox) {
        return {
          type: "unsupported",
          browser: "firefox-desktop",
          title: "Not Supported",
          message: "Firefox doesn't support PWA installation. Try Chrome or Edge for the best experience.",
        };
      }
      if (detect.isSafari) {
        // macOS Safari 17+ supports "Add to Dock"
        if (detect.safariVersion >= 17) {
          return {
            type: "manual",
            browser: "safari-mac",
            title: "Add to Dock",
            icon: "💻",
            canInstallDirectly: false,
            steps: [
              { icon: "1️⃣", text: "Click <strong>File</strong> in the menu bar", sub: "" },
              { icon: "2️⃣", text: "Click <strong>Add to Dock...</strong>", sub: "macOS Sonoma+ feature" },
              { icon: "3️⃣", text: "Click <strong>Add</strong>", sub: "" },
            ],
          };
        }
        return {
          type: "unsupported",
          browser: "safari-mac-old",
          message: "Use Chrome or Edge on Mac for the install feature, or update to macOS Sonoma.",
        };
      }
    }

    // Fallback
    return {
      type: "prompt",
      canInstallDirectly: promptAvailable,
      title: "Install App",
      icon: "📱",
      buttonText: "Install",
    };
  }

  // ── NATIVE INSTALL ───────────────────────────────────────────
  async function triggerInstall() {
    if (!deferredPrompt) {
      showFullGuide(getConfig());
      return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        state.markInstalled();
        hidePopup();
      } else {
        state.markDismissed();
        hidePopup();
      }
    } catch (err) {
      console.warn("Install prompt error:", err);
      showFullGuide(getConfig());
    } finally {
      deferredPrompt = null;
    }
  }

  // ── POPUP VISIBILITY ─────────────────────────────────────────
  function shouldShowPopup() {
    if (detect.isStandalone || state.isInstalled) return false;
    if (state.isDismissed) return false;
    return true;
  }

  function showPopup() {
    if (!shouldShowPopup()) return;
    const popup = document.getElementById("pwa-install-prompt");
    if (!popup) return;
    const config = getConfig();
    if (config.type === "installed" || config.type === "unsupported") return;
    updatePopupContent(popup, config);
    popup.classList.remove("hidden");
  }

  function hidePopup() {
    const popup = document.getElementById("pwa-install-prompt");
    if (popup) popup.classList.add("hidden");
  }

  function updatePopupContent(popup, config) {
    const titleEl = popup.querySelector("h4");
    const instructEl = popup.querySelector("#pwa-instructions") || popup.querySelector("p");
    const installBtn = popup.querySelector("#pwa-install-btn");
    const iconEl = popup.querySelector(".pwa-icon");

    if (titleEl) titleEl.textContent = config.title || "Install App";
    if (iconEl) iconEl.textContent = config.icon || "📱";

    if (config.canInstallDirectly && deferredPrompt) {
      if (instructEl) instructEl.textContent = "Install for a faster experience!";
      if (installBtn) { installBtn.textContent = config.buttonText || "Install"; installBtn.onclick = triggerInstall; }
    } else if (config.type === "manual") {
      if (instructEl) instructEl.innerHTML = buildSnippet(config);
      if (installBtn) { installBtn.textContent = "How to Install"; installBtn.onclick = () => showFullGuide(config); }
    }
  }

  function buildSnippet(config) {
    if (detect.isIOSSafari) return 'Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>';
    if (detect.isIOSChrome) return 'Tap <strong>⋯</strong> → <strong>Add to Home Screen</strong>';
    if (detect.isIOSFirefox) return 'Tap <strong>⋯</strong> → <strong>Share</strong> → <strong>Add to Home Screen</strong>';
    if (detect.isSamsung) return 'Tap <strong>⋮</strong> → <strong>Add page to</strong> → <strong>Home screen</strong>';
    return "Use your browser menu to install";
  }

  // ── FULL GUIDE MODAL ─────────────────────────────────────────
  function showFullGuide(config) {
    document.getElementById("pwa-guide-modal")?.remove();

    const modal = document.createElement("div");
    modal.id = "pwa-guide-modal";
    modal.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      display:flex; align-items:flex-end; justify-content:center;
      background:rgba(0,0,0,0.55); backdrop-filter:blur(4px);
    `;

    const stepsHTML = (config.steps || [])
      .map((s) => `
        <div style="display:flex;align-items:flex-start;gap:14px;
                    padding:14px 0;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:1.3rem;flex-shrink:0;line-height:1.4;">${s.icon}</span>
          <div>
            <div style="font-size:0.95rem;color:#222;">${s.text}</div>
            ${s.sub ? `<div style="font-size:0.78rem;color:#888;margin-top:3px;">${s.sub}</div>` : ""}
          </div>
        </div>`)
      .join("");

    // iOS Safari arrow — points to the correct Share button location
    // iPhone: Share is at the BOTTOM → arrow points DOWN, anchored at bottom of screen
    // iPad: Share is at the TOP RIGHT → arrow points UP-RIGHT, anchored at top
    const showArrow = detect.isIOSSafari;
    const isIPad = detect.isIPad;

    let arrowHTML = "";
    if (showArrow) {
      if (isIPad) {
        // iPad: Share button is top-right — show arrow at top of modal pointing up-right
        arrowHTML = `
          <div style="text-align:right; margin-top:16px; color:#007AFF;
                      font-size:0.85rem; font-weight:700; padding-right:8px;">
            Share button is at the top right ↗
          </div>`;
      } else {
        // iPhone: Share button is at the bottom toolbar — show arrow at bottom of screen
        arrowHTML = `
          <div style="position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
                      text-align:center; pointer-events:none; z-index:100000;">
            <div style="color:#007AFF; font-size:0.85rem; font-weight:700; margin-bottom:2px;
                        background:rgba(255,255,255,0.95); padding:4px 12px; border-radius:12px;
                        box-shadow:0 2px 8px rgba(0,0,0,0.15);">
              Share button is at the bottom ↓
            </div>
          </div>`;
      }
    }

    modal.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;width:100%;
                  max-width:480px;padding:24px 20px ${showArrow && !isIPad ? '72px' : '32px'};
                  max-height:85vh;overflow-y:auto;position:relative;">
        <div style="display:flex;justify-content:space-between;
                    align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;font-size:1.1rem;color:#000;">${config.title || "Install"}</h3>
          <button id="pwa-guide-close" style="background:#f5f5f5;border:none;
            border-radius:50%;width:32px;height:32px;font-size:1rem;
            cursor:pointer;display:flex;align-items:center;justify-content:center;">
            ✕
          </button>
        </div>
        ${stepsHTML}
        ${config.note ? `
          <div style="margin-top:16px;background:#f0f7ff;border-radius:12px;
                      padding:12px 14px;display:flex;gap:10px;align-items:flex-start;">
            <span style="font-size:1.1rem;flex-shrink:0;">💡</span>
            <p style="margin:0;font-size:0.82rem;color:#555;line-height:1.5;">
              ${config.note}
            </p>
          </div>` : ""}
        ${arrowHTML}
      </div>
      <style>
        @keyframes slideUpGuide {
          from { transform: translateY(100%); } to { transform: translateY(0); }
        }
        @keyframes fadeInGuide {
          from { opacity: 0; } to { opacity: 1; }
        }
        #pwa-guide-modal > div { animation: slideUpGuide 0.3s cubic-bezier(0.25,0.8,0.25,1); }
        #pwa-guide-modal { animation: fadeInGuide 0.2s ease; }
      </style>
    `;

    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("#pwa-guide-close").addEventListener("click", () => modal.remove());
    document.body.appendChild(modal);
  }

  // ── PROFILE BUTTON UPDATE ────────────────────────────────────
  function updateInstallUI() {
    const section = document.getElementById("profile-install-section");
    if (!section) return;

    if (detect.isStandalone || state.isInstalled) {
      section.style.display = "none";
      return;
    }

    section.style.display = "";
    // Remove old listener by replacing the element's onclick
    section.onclick = () => {
      const config = getConfig();
      if (config.canInstallDirectly && deferredPrompt) {
        triggerInstall();
      } else {
        showFullGuide(config);
      }
      // Close profile dropdown if open
      const dropdown = document.querySelector(".nav-dropdown.active");
      if (dropdown) dropdown.classList.remove("active");
    };
  }

  // ── ENGAGEMENT-BASED AUTO POPUP ──────────────────────────────
  function initAutoPopup() {
    if (!shouldShowPopup()) return;

    state.incrementVisit();

    // Only auto-show on dashboard after 3+ visits
    const isDashboard = window.location.pathname.includes("dashboard.html") ||
                        window.location.pathname === "/";
    const hasEngagement = state.visitCount >= 3;

    if (!isDashboard || !hasEngagement) return;

    const config = getConfig();
    if (config.type === "installed" || config.type === "unsupported") return;

    // 8s delay — let the user settle in before showing the prompt
    setTimeout(showPopup, 8000);
  }

  // ── PUBLIC API ────────────────────────────────────────────────
  window.PWAInstall = {
    detect,
    getConfig,
    showPopup,
    hidePopup,
    showGuide: () => showFullGuide(getConfig()),
    triggerInstall,
    shouldShow: shouldShowPopup,
    markDismissed: () => state.markDismissed(),
    markInstalled: () => state.markInstalled(),
  };

  // Also expose as handleProfileInstallClick for dashboard.html inline onclick
  window.handleProfileInstallClick = function () {
    const config = getConfig();
    if (config.canInstallDirectly && deferredPrompt) {
      triggerInstall();
    } else {
      showFullGuide(config);
    }
  };

  // ── INIT ──────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    // Wire popup buttons
    document.getElementById("pwa-close-btn")?.addEventListener("click", () => {
      hidePopup();
      state.markDismissed();
    });

    document.getElementById("pwa-install-btn")?.addEventListener("click", () => {
      const config = getConfig();
      if (config.canInstallDirectly && deferredPrompt) {
        triggerInstall();
      } else {
        showFullGuide(config);
      }
    });

    updateInstallUI();
    initAutoPopup();
  });
})();
