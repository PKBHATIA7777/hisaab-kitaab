/* client/js/pwa/install-manager.js */
/**
 * PWA Install Manager v2
 * 
 * KEY FIXES:
 * 1. Captures beforeinstallprompt on ANY page, triggers on the SAME page
 * 2. Falls back to manual guide with correct device/browser detection
 * 3. Proper Samsung Internet 14+ detection
 * 4. iPad vs iPhone arrow direction
 * 5. localStorage with sessionStorage fallback
 * 6. Engagement-based timing (not just arbitrary 5s)
 */
(function () {
  "use strict";

  // ── SAFE STORAGE ────────────────────────────────────────────
  const Store = {
    get(key) {
      try { return localStorage.getItem(key); } catch (_) {
        try { return sessionStorage.getItem(key); } catch (__) { return null; }
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); return true; } catch (_) {
        try { sessionStorage.setItem(key, value); return true; } catch (__) { return false; }
      }
    },
  };

  // ── DETECTION ───────────────────────────────────────────────
  const ua = navigator.userAgent;
  const platform = navigator.platform || "";

  const detect = {
    isIOS: /iPad|iPhone|iPod/.test(ua) ||
            (platform === "MacIntel" && navigator.maxTouchPoints > 1),
    isIPad: /iPad/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1),
    isAndroid: /Android/.test(ua),
    isSafari: /Safari/.test(ua) && !/Chrome|Chromium|Android|CriOS|FxiOS|EdgiOS/.test(ua),
    isChrome: /Chrome/.test(ua) && !/Chromium|Edg\/|OPR\/|SamsungBrowser/.test(ua),
    isEdge: /Edg\//.test(ua),
    isSamsung: /SamsungBrowser/.test(ua),
    isFirefox: /Firefox/.test(ua) && !/Seamonkey/.test(ua),
    isOpera: /OPR\/|Opera/.test(ua),
    isBrave: false, // Resolved async below
    isStandalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true,
    get isIOSSafari() { return this.isIOS && this.isSafari; },
    get isIOSChrome() { return this.isIOS && /CriOS/.test(ua); },
    get isIOSFirefox() { return this.isIOS && /FxiOS/.test(ua); },
    get isLandscape() {
      return window.matchMedia("(orientation: landscape)").matches;
    },
    // Samsung Internet 14+ supports beforeinstallprompt
    get samsungVersion() {
      const m = ua.match(/SamsungBrowser\/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    },
  };

  if (navigator.brave && navigator.brave.isBrave) {
    navigator.brave.isBrave().then((b) => { detect.isBrave = b; }).catch(() => {});
  }

  // ── STATE ────────────────────────────────────────────────────
  let deferredPrompt = null;
  const DISMISS_KEY = "pwa_dismissed_at";
  const INSTALL_KEY = "pwa_installed";
  const VISIT_KEY = "pwa_visit_count";
  const DISMISS_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

  const state = {
    get isDismissed() {
      const t = Store.get(DISMISS_KEY);
      return t ? Date.now() - parseInt(t) < DISMISS_COOLDOWN : false;
    },
    get isInstalled() {
      return detect.isStandalone || Store.get(INSTALL_KEY) === "true";
    },
    get visitCount() {
      return parseInt(Store.get(VISIT_KEY) || "0");
    },
    markDismissed() { Store.set(DISMISS_KEY, Date.now().toString()); },
    markInstalled() { Store.set(INSTALL_KEY, "true"); },
    incrementVisit() { Store.set(VISIT_KEY, (this.visitCount + 1).toString()); },
  };

  // ── CAPTURE beforeinstallprompt (as early as possible) ──────
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Set a session flag that the prompt is available
    // Other pages can check this flag
    try { sessionStorage.setItem("pwa_prompt_available", "1"); } catch (_) {}
    updateInstallUI();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    state.markInstalled();
    hidePopup();
    updateInstallUI();
    try { sessionStorage.removeItem("pwa_prompt_available"); } catch (_) {}
    if (window.showToast) window.showToast("App installed! 🎉", "success");
  });

  // ── INSTALL CONFIG ───────────────────────────────────────────
  function getConfig() {
    if (detect.isStandalone) return { type: "installed" };

    // Check if native prompt is available (current page OR flagged from previous page)
    const promptAvailable = !!deferredPrompt ||
      (try { sessionStorage.getItem("pwa_prompt_available") === "1" } catch { false });

    if (detect.isIOS) {
      return getIOSConfig();
    }

    // Samsung Internet 14+ supports native prompt
    if (detect.isSamsung && detect.samsungVersion >= 14 && promptAvailable) {
      return { type: "prompt", canInstallDirectly: true, buttonText: "Install" };
    }
    if (detect.isSamsung) {
      return {
        type: "manual",
        title: "Add to Home Screen",
        steps: [
          { icon: "1️⃣", text: "Tap the <strong>⋮ menu</strong>", sub: "Top right corner" },
          { icon: "2️⃣", text: "Tap <strong>Add page to</strong>", sub: "" },
          { icon: "3️⃣", text: "Select <strong>Home screen</strong>", sub: "" },
        ],
      };
    }

    // Chrome, Edge, Brave on Android/Desktop
    if ((detect.isChrome || detect.isEdge || detect.isBrave) && promptAvailable) {
      return { type: "prompt", canInstallDirectly: true, buttonText: "Install" };
    }

    if (detect.isFirefox && detect.isAndroid) {
      return {
        type: "manual",
        title: "Add to Home Screen",
        steps: [
          { icon: "1️⃣", text: "Tap the <strong>⋮ menu</strong>", sub: "" },
          { icon: "2️⃣", text: "Tap <strong>Install</strong>", sub: "" },
        ],
      };
    }

    // No prompt available but might be installable — show guide
    if (detect.isChrome || detect.isEdge || detect.isBrave) {
      return {
        type: "manual",
        title: "Install App",
        note: "Visit this site again to trigger the install option, or use your browser's menu.",
        steps: [
          { icon: "💡", text: "Open browser menu (⋮ or ⋯)", sub: "" },
          { icon: "📲", text: "Look for <strong>Install App</strong> or <strong>Add to Home Screen</strong>", sub: "" },
        ],
      };
    }

    return { type: "unsupported" };
  }

  function getIOSConfig() {
    const isIPad = detect.isIPad;
    const isLandscape = detect.isLandscape;

    // Share button location varies by device/orientation
    let shareLocation = "";
    if (isIPad) {
      shareLocation = isLandscape
        ? "the top right area of Safari"
        : "the top right area of Safari";
    } else {
      // iPhone — always bottom
      shareLocation = "the bottom of Safari";
    }

    const arrowDir = isIPad ? "↑ (top right)" : "↓";

    if (detect.isIOSSafari) {
      return {
        type: "manual",
        title: "Add to Home Screen",
        canInstallDirectly: false,
        isIOS: true,
        isIPad,
        arrowDir,
        steps: [
          {
            icon: "1️⃣",
            text: `Tap the <strong>Share</strong> button`,
            sub: `The box with an arrow — located at ${shareLocation}`,
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

    // iOS Chrome, Firefox, etc.
    return {
      type: "manual",
      title: "Add to Home Screen",
      isIOS: true,
      steps: [
        { icon: "💡", text: "Open this page in <strong>Safari</strong>", sub: "Copy the URL, paste in Safari" },
        { icon: "1️⃣", text: "Tap the <strong>Share ↑</strong> button", sub: "" },
        { icon: "2️⃣", text: "Tap <strong>Add to Home Screen</strong>", sub: "" },
      ],
    };
  }

  // ── NATIVE INSTALL ───────────────────────────────────────────
  async function triggerInstall() {
    if (!deferredPrompt) {
      // Show guide if no deferred prompt
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

  // ── POPUP UI ─────────────────────────────────────────────────
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
    const instructEl = popup.querySelector("#pwa-instructions");
    const installBtn = popup.querySelector("#pwa-install-btn");

    if (titleEl) titleEl.textContent = config.title || "Install App";

    if (config.canInstallDirectly && deferredPrompt) {
      if (instructEl) instructEl.textContent = "Install for a faster experience!";
      if (installBtn) { installBtn.textContent = "Install"; installBtn.onclick = triggerInstall; }
    } else if (config.type === "manual") {
      if (instructEl) instructEl.innerHTML = buildSnippet(config);
      if (installBtn) { installBtn.textContent = "How to Install"; installBtn.onclick = () => showFullGuide(config); }
    }
  }

  function buildSnippet(config) {
    if (detect.isIOSSafari) return 'Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>';
    if (detect.isIOSChrome) return 'Tap <strong>⋯</strong> → <strong>Add to Home Screen</strong>';
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
      .map(
        (s) => `
        <div style="display:flex;align-items:flex-start;gap:14px;
                    padding:14px 0;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:1.3rem;flex-shrink:0">${s.icon}</span>
          <div>
            <div style="font-size:0.95rem;color:#222;">${s.text}</div>
            ${s.sub ? `<div style="font-size:0.78rem;color:#888;margin-top:3px;">${s.sub}</div>` : ""}
          </div>
        </div>`
      )
      .join("");

    // Dynamic arrow — points correctly based on device/orientation
    const showArrow = detect.isIOSSafari;
    const arrowText = config.isIPad
      ? "Share button is at the top right ↗"
      : "Share button is at the bottom ↓";

    modal.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;width:100%;
                  max-width:480px;padding:24px 20px 32px;max-height:85vh;
                  overflow-y:auto;position:relative;">
        <div style="display:flex;justify-content:space-between;
                    align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;font-size:1.1rem;">${config.title || "Install"}</h3>
          <button id="pwa-guide-close" style="background:#f5f5f5;border:none;
            border-radius:50%;width:32px;height:32px;font-size:1rem;
            cursor:pointer;display:flex;align-items:center;justify-content:center;">
            ✕
          </button>
        </div>
        ${stepsHTML}
        ${config.note ? `
          <div style="margin-top:16px;background:#f0f7ff;border-radius:12px;
                      padding:12px 14px;display:flex;gap:10px;">
            <span>💡</span>
            <p style="margin:0;font-size:0.82rem;color:#555;line-height:1.5;">
              ${config.note}
            </p>
          </div>` : ""}
        ${showArrow ? `
          <div style="text-align:center;margin-top:16px;color:#007AFF;
                      font-size:0.85rem;font-weight:600;">
            ${arrowText}
          </div>` : ""}
      </div>
      <style>
        @keyframes slideUpGuide {
          from { transform: translateY(100%); } to { transform: translateY(0); }
        }
        #pwa-guide-modal > div { animation: slideUpGuide 0.3s ease-out; }
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
    section.onclick = () => {
      const config = getConfig();
      if (config.canInstallDirectly && deferredPrompt) {
        triggerInstall();
      } else {
        showFullGuide(config);
      }
    };
  }

  // ── ENGAGEMENT-BASED AUTO POPUP ──────────────────────────────
  function initAutoPopup() {
    if (!shouldShowPopup()) return;

    // Only show after user engagement (3+ visits OR on dashboard after action)
    state.incrementVisit();

    const isDashboard = window.location.pathname.includes("dashboard.html");
    const hasEngagement = state.visitCount >= 3;

    if (!isDashboard || !hasEngagement) return;

    const config = getConfig();
    if (config.type === "installed" || config.type === "unsupported") return;

    // Delay 8s to let user settle in
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
    markDismissed: state.markDismissed.bind(state),
  };

  // ── INIT ──────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    // Wire up popup buttons
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