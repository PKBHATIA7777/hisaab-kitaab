// client/js/pwa-install.js
// Complete PWA Install Manager - handles ALL devices and browsers

(function() {
  'use strict';

  // ─── DETECTION ───────────────────────────────────────────────
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  const detect = {
    // iOS detection (all iOS devices)
    isIOS: /iPad|iPhone|iPod/.test(ua) || 
           (platform === 'MacIntel' && navigator.maxTouchPoints > 1), // iPad Pro
    
    // Android detection
    isAndroid: /Android/.test(ua),
    
    // Windows detection
    isWindows: /Windows/.test(ua) || /Win/.test(platform),
    
    // Mac detection
    isMac: /Macintosh|MacIntel/.test(ua) && navigator.maxTouchPoints === 0,
    
    // Browser detections
    isChrome: /Chrome/.test(ua) && !/Chromium|EdgA?\/|OPR\/|SamsungBrowser/.test(ua),
    isEdge: /Edg\/|EdgA?\//.test(ua),
    isSafari: /Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua),
    isFirefox: /Firefox/.test(ua) && !/Seamonkey/.test(ua),
    isSamsung: /SamsungBrowser/.test(ua),
    isOpera: /OPR\/|Opera/.test(ua),
    isBrave: false, // Detected async below
    
    // Chromium-based (supports beforeinstallprompt in theory)
    isChromiumBased: /Chrome/.test(ua) && !/OPR\//.test(ua),
    
    // iOS browser variants
    get isIOSSafari() { return this.isIOS && this.isSafari; },
    get isIOSChrome() { return this.isIOS && /CriOS/.test(ua); },
    get isIOSFirefox() { return this.isIOS && /FxiOS/.test(ua); },
    get isIOSEdge() { return this.isIOS && /EdgiOS/.test(ua); },
    get isIOSOtherBrowser() { 
      return this.isIOS && !this.isIOSSafari && !this.isIOSChrome && 
             !this.isIOSFirefox && !this.isIOSEdge; 
    },
    
    // Standalone (already installed)
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true,
    
    // iOS version
    get iOSVersion() {
      const match = ua.match(/OS (\d+)_(\d+)/);
      return match ? parseInt(match[1]) : 0;
    },
    
    // Chrome version
    get chromeVersion() {
      const match = ua.match(/Chrome\/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
  };

  // Async Brave detection
  if (navigator.brave && navigator.brave.isBrave) {
    navigator.brave.isBrave().then(b => { detect.isBrave = b; }).catch(() => {});
  }

  // ─── STATE ──────────────────────────────────────────────────
  let deferredPrompt = null; // beforeinstallprompt event
  let installState = {
    canUseNativePrompt: false,
    hasBeenDismissed: false,
    dismissedAt: null,
    hasInstalled: false,
  };

  const DISMISS_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days

  function loadState() {
    try {
      const dismissed = localStorage.getItem('pwa_dismissed_at');
      const installed = localStorage.getItem('pwa_installed');
      installState.hasInstalled = installed === 'true';
      if (dismissed) {
        installState.dismissedAt = parseInt(dismissed);
        installState.hasBeenDismissed = 
          Date.now() - installState.dismissedAt < DISMISS_COOLDOWN;
      }
    } catch(e) {}
  }

  function markDismissed() {
    try {
      localStorage.setItem('pwa_dismissed_at', Date.now().toString());
    } catch(e) {}
    installState.hasBeenDismissed = true;
  }

  function markInstalled() {
    try {
      localStorage.setItem('pwa_installed', 'true');
    } catch(e) {}
    installState.hasInstalled = true;
  }

  // ─── SHOULD SHOW ────────────────────────────────────────────
  function shouldShowInstallOption() {
    if (detect.isStandalone) return false;
    if (installState.hasInstalled) return false;
    // Always show in profile even if dismissed
    return true;
  }

  function shouldShowAutoPopup() {
    if (!shouldShowInstallOption()) return false;
    if (installState.hasBeenDismissed) return false;
    return true;
  }

  // ─── GET INSTALL INSTRUCTIONS ───────────────────────────────
  function getInstallConfig() {
    // Already installed
    if (detect.isStandalone) {
      return { type: 'installed' };
    }

    // iOS browsers - none support beforeinstallprompt
    if (detect.isIOS) {
      if (detect.isIOSSafari) {
        return {
          type: 'manual',
          browser: 'safari-ios',
          title: 'Add to Home Screen',
          icon: '📲',
          canInstallDirectly: false,
          steps: [
            { icon: '1️⃣', text: 'Tap the <strong>Share</strong> button', sub: 'The box with arrow ↑ at the bottom of Safari' },
            { icon: '2️⃣', text: 'Scroll down, tap <strong>Add to Home Screen</strong>', sub: 'It has a + icon in a square' },
            { icon: '3️⃣', text: 'Tap <strong>Add</strong> in the top right', sub: 'The app icon appears on your home screen!' }
          ],
          note: 'This only works in Safari. If you\'re in another browser, open this page in Safari first.'
        };
      }
      if (detect.isIOSChrome) {
        return {
          type: 'manual',
          browser: 'chrome-ios',
          title: 'Add to Home Screen',
          icon: '📲',
          canInstallDirectly: false,
          steps: [
            { icon: '1️⃣', text: 'Tap the <strong>⋯</strong> menu button', sub: 'Three dots in the bottom right' },
            { icon: '2️⃣', text: 'Tap <strong>Add to Home Screen</strong>', sub: 'In the menu that appears' },
            { icon: '3️⃣', text: 'Tap <strong>Add</strong> to confirm', sub: '' }
          ],
          note: 'For the best experience, open this page in Safari and add from there.'
        };
      }
      if (detect.isIOSFirefox) {
        return {
          type: 'manual',
          browser: 'firefox-ios',
          title: 'Add to Home Screen',
          icon: '📲',
          canInstallDirectly: false,
          steps: [
            { icon: '1️⃣', text: 'Tap the <strong>⋯</strong> menu at the bottom', sub: '' },
            { icon: '2️⃣', text: 'Tap <strong>Share</strong>', sub: '' },
            { icon: '3️⃣', text: 'Tap <strong>Add to Home Screen</strong>', sub: '' }
          ],
          note: 'For full PWA features, use Safari to add to home screen.'
        };
      }
      // All other iOS browsers
      return {
        type: 'manual',
        browser: 'other-ios',
        title: 'Install App',
        icon: '📲',
        canInstallDirectly: false,
        steps: [
          { icon: '💡', text: 'Open this page in <strong>Safari</strong>', sub: 'Copy the URL and paste in Safari' },
          { icon: '1️⃣', text: 'Tap the <strong>Share ↑</strong> button', sub: 'At the bottom of Safari' },
          { icon: '2️⃣', text: 'Tap <strong>Add to Home Screen</strong>', sub: '' }
        ],
        note: 'PWA installation on iOS works best through Safari.'
      };
    }

    // Android browsers
    if (detect.isAndroid) {
      if (detect.isChrome || detect.isEdge || detect.isBrave) {
        return {
          type: 'prompt', // Can use beforeinstallprompt
          browser: detect.isChrome ? 'chrome-android' : detect.isEdge ? 'edge-android' : 'brave-android',
          title: 'Install App',
          icon: '📱',
          canInstallDirectly: true,
          buttonText: 'Install'
        };
      }
      if (detect.isSamsung) {
        return {
          type: 'manual',
          browser: 'samsung',
          title: 'Add to Home Screen',
          icon: '📱',
          canInstallDirectly: false,
          steps: [
            { icon: '1️⃣', text: 'Tap the <strong>⋮ menu</strong> (3 dots)', sub: 'Top right of Samsung Internet' },
            { icon: '2️⃣', text: 'Tap <strong>Add page to</strong>', sub: '' },
            { icon: '3️⃣', text: 'Select <strong>Home screen</strong>', sub: '' }
          ]
        };
      }
      if (detect.isFirefox) {
        return {
          type: 'manual',
          browser: 'firefox-android',
          title: 'Add to Home Screen',
          icon: '📱',
          canInstallDirectly: false,
          steps: [
            { icon: '1️⃣', text: 'Tap the <strong>⋮ menu</strong>', sub: 'Three dots at the bottom right' },
            { icon: '2️⃣', text: 'Tap <strong>Install</strong>', sub: 'Or "Add to Home Screen"' }
          ]
        };
      }
      if (detect.isOpera) {
        return {
          type: 'manual',
          browser: 'opera-android',
          title: 'Add to Home Screen',
          icon: '📱',
          canInstallDirectly: false,
          steps: [
            { icon: '1️⃣', text: 'Tap the <strong>Opera logo</strong> or <strong>⋮</strong>', sub: '' },
            { icon: '2️⃣', text: 'Tap <strong>Home Screen</strong>', sub: '' }
          ]
        };
      }
      // Generic Android
      return {
        type: 'prompt',
        browser: 'android-generic',
        canInstallDirectly: true,
        title: 'Install App',
        icon: '📱',
        buttonText: 'Install'
      };
    }

    // Desktop - Chrome/Edge/Brave support native install
    if (!detect.isIOS && !detect.isAndroid) {
      if (detect.isChrome || detect.isEdge || detect.isBrave) {
        return {
          type: 'prompt',
          browser: detect.isEdge ? 'edge-desktop' : detect.isBrave ? 'brave-desktop' : 'chrome-desktop',
          title: 'Install App',
          icon: '💻',
          canInstallDirectly: true,
          buttonText: 'Install'
        };
      }
      if (detect.isFirefox) {
        return {
          type: 'unsupported',
          browser: 'firefox-desktop',
          title: 'Not Supported',
          message: 'Firefox doesn\'t support PWA installation. Try Chrome or Edge for the best experience.'
        };
      }
      if (detect.isSafari) {
        // macOS Safari 17+ supports Add to Dock
        const safariVersion = parseInt((ua.match(/Version\/(\d+)/) || [])[1] || '0');
        if (safariVersion >= 17) {
          return {
            type: 'manual',
            browser: 'safari-mac',
            title: 'Add to Dock',
            icon: '💻',
            canInstallDirectly: false,
            steps: [
              { icon: '1️⃣', text: 'Click <strong>File</strong> in the menu bar', sub: '' },
              { icon: '2️⃣', text: 'Click <strong>Add to Dock...</strong>', sub: 'macOS Sonoma+ feature' },
              { icon: '3️⃣', text: 'Click <strong>Add</strong>', sub: '' }
            ]
          };
        }
        return {
          type: 'unsupported',
          browser: 'safari-mac-old',
          message: 'Use Chrome or Edge on Mac for the install feature, or update to macOS Sonoma.'
        };
      }
    }

    // Fallback
    return {
      type: 'prompt',
      canInstallDirectly: !!deferredPrompt,
      title: 'Install App',
      icon: '📱',
      buttonText: 'Install'
    };
  }

  // ─── NATIVE PROMPT HANDLER ──────────────────────────────────
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installState.canUseNativePrompt = true;
    
    // Update any existing UI
    updateInstallUI();
    
    // Show popup after a delay if user hasn't dismissed
    if (shouldShowAutoPopup()) {
      setTimeout(showInstallPopup, 4000);
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markInstalled();
    hideInstallPopup();
    updateInstallUI(); // Update profile button
    if (window.showToast) showToast('App installed successfully! 🎉', 'success');
  });

  // ─── POPUP UI ───────────────────────────────────────────────
  function showInstallPopup() {
    if (!shouldShowAutoPopup()) return;
    const popup = document.getElementById('pwa-install-prompt');
    if (!popup) return;
    
    const config = getInstallConfig();
    if (config.type === 'installed' || config.type === 'unsupported') return;
    
    updatePopupContent(popup, config);
    popup.classList.remove('hidden');
  }

  function hideInstallPopup() {
    const popup = document.getElementById('pwa-install-prompt');
    if (popup) popup.classList.add('hidden');
  }

  function updatePopupContent(popup, config) {
    const titleEl = popup.querySelector('h4');
    const instructionsEl = popup.querySelector('p');
    const installBtn = popup.querySelector('#pwa-install-btn');
    const iconEl = popup.querySelector('.pwa-icon');

    if (titleEl) titleEl.textContent = config.title || 'Install App';
    if (iconEl) iconEl.textContent = config.icon || '📱';

    if (config.canInstallDirectly && deferredPrompt) {
      if (instructionsEl) instructionsEl.textContent = 'Add to your home screen for a faster experience!';
      if (installBtn) {
        installBtn.textContent = config.buttonText || 'Install';
        installBtn.onclick = triggerNativeInstall;
      }
    } else if (config.type === 'manual') {
      if (instructionsEl) instructionsEl.innerHTML = buildInstructionSnippet(config);
      if (installBtn) {
        installBtn.textContent = 'How to Install';
        installBtn.onclick = () => showFullGuide(config);
      }
    }
  }

  function buildInstructionSnippet(config) {
    if (detect.isIOSSafari) return 'Tap <strong>Share ↑</strong> → <strong>Add to Home Screen</strong>';
    if (detect.isIOSChrome) return 'Tap <strong>⋯</strong> → <strong>Add to Home Screen</strong>';
    if (detect.isIOSFirefox) return 'Tap <strong>⋯</strong> → <strong>Share</strong> → <strong>Add to Home Screen</strong>';
    if (detect.isSamsung) return 'Tap <strong>⋮</strong> → <strong>Add page to</strong> → <strong>Home screen</strong>';
    return 'Follow steps to install';
  }

  async function triggerNativeInstall() {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        markInstalled();
        hideInstallPopup();
      } else {
        markDismissed();
        hideInstallPopup();
      }
      deferredPrompt = null;
    } catch(e) {
      console.warn('Install prompt failed:', e);
    }
  }

  // ─── FULL GUIDE MODAL ────────────────────────────────────────
  function showFullGuide(config) {
    const existing = document.getElementById('pwa-guide-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'pwa-guide-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: flex-end; justify-content: center;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    `;

    const steps = (config.steps || []).map(s => `
      <div style="display:flex; align-items:flex-start; gap:14px; padding:14px 0; border-bottom:1px solid #f0f0f0;">
        <span style="font-size:1.4rem; flex-shrink:0; line-height:1;">${s.icon}</span>
        <div>
          <div style="font-size:0.95rem; color:#222;">${s.text}</div>
          ${s.sub ? `<div style="font-size:0.78rem; color:#888; margin-top:2px;">${s.sub}</div>` : ''}
        </div>
      </div>
    `).join('');

    // Show animated arrow for iOS Safari pointing to share button position
    const showArrow = detect.isIOSSafari;

    modal.innerHTML = `
      <div style="
        background: #fff;
        border-radius: 24px 24px 0 0;
        width: 100%;
        max-width: 480px;
        padding: 24px 20px ${showArrow ? '80px' : '32px'};
        max-height: 85vh;
        overflow-y: auto;
        position: relative;
        animation: slideUp 0.3s cubic-bezier(0.25,0.8,0.25,1);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 style="margin:0; font-size:1.15rem; color:#000;">${config.title}</h3>
          <button onclick="this.closest('#pwa-guide-modal').remove()"
            style="background:#f5f5f5; border:none; border-radius:50%; width:32px; height:32px; 
                   font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">
            ✕
          </button>
        </div>
        
        ${steps}
        
        ${config.note ? `
          <div style="margin-top:16px; background:#f9f0ff; border-radius:12px; padding:12px 14px; 
                      display:flex; gap:10px; align-items:flex-start;">
            <span style="font-size:1.1rem; flex-shrink:0;">💡</span>
            <p style="margin:0; font-size:0.82rem; color:#555; line-height:1.5;">${config.note}</p>
          </div>
        ` : ''}
        
        ${showArrow ? `
          <div style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
                      text-align:center; pointer-events:none;">
            <div style="color:#007AFF; font-size:0.85rem; font-weight:700; margin-bottom:4px;">
              Share button is here ↓
            </div>
            <div style="font-size:2rem; animation:bounce 1s ease-in-out infinite;">↓</div>
          </div>
        ` : ''}
      </div>
      <style>
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
      </style>
    `;

    // Close on backdrop tap
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  }

  // ─── PROFILE MENU INSTALL BUTTON ────────────────────────────
 // ─── PROFILE MENU INSTALL BUTTON ────────────────────────────
  function updateInstallUI() {
    const profileInstallSection = document.getElementById('profile-install-section');
    if (!profileInstallSection) return;
    
    if (detect.isStandalone || installState.hasInstalled) {
      profileInstallSection.style.display = 'none';
    } else {
      profileInstallSection.style.display = ''; // Make visible
      
      // FIX: Actually make the profile button trigger the install logic
      profileInstallSection.onclick = () => {
        const config = getInstallConfig();
        if (config.canInstallDirectly && deferredPrompt) {
          triggerNativeInstall();
        } else {
          showFullGuide(config);
        }
        // Close the profile dropdown if it's open
        const dropdown = document.querySelector('.nav-dropdown.active');
        if (dropdown) dropdown.classList.remove('active');
      };
    }
  }

  // ─── PUBLIC API ──────────────────────────────────────────────
  window.PWAInstall = {
    detect,
    getConfig: getInstallConfig,
    showPopup: showInstallPopup,
    hidePopup: hideInstallPopup,
    showGuide: () => showFullGuide(getInstallConfig()),
    triggerInstall: triggerNativeInstall,
    shouldShow: shouldShowInstallOption,
    markDismissed,
    markInstalled,
  };

  // ─── INIT ───────────────────────────────────────────────────
  loadState();

  document.addEventListener('DOMContentLoaded', () => {
    // Handle close button
    const closeBtn = document.getElementById('pwa-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        hideInstallPopup();
        markDismissed();
      };
    }

    // Handle install button (default setup — may be overridden by updatePopupContent)
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.onclick = () => {
        const config = getInstallConfig();
        if (config.canInstallDirectly && deferredPrompt) {
          triggerNativeInstall();
        } else {
          showFullGuide(config);
        }
      };
    }

    // If no beforeinstallprompt fires within 2.5s, check if manual instructions needed
    if (!detect.isStandalone && !installState.hasInstalled) {
      setTimeout(() => {
        const config = getInstallConfig();
        if (config.type === 'manual' && shouldShowAutoPopup()) {
          const popup = document.getElementById('pwa-install-prompt');
          if (popup) {
            updatePopupContent(popup, config);
            popup.classList.remove('hidden');
          }
        }
      }, 4000);
    }

    updateInstallUI();
  });

})();