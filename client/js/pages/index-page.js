  
    (async function () {
      try {
        await apiFetch("/auth/me", { _silent: true });
        if (typeof window.navigateTo === 'function') window.navigateTo("dashboard.html");
        else window.location.href = "dashboard.html";
      } catch (e) {
        // Not logged in — stay on landing page, no redirect
        hideAppLoader();
      }
    })();
  