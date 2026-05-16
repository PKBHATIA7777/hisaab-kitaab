  
    (async function () {
      try {
        await apiFetch("/auth/me", { _silent: true });
        window.location.href = "dashboard.html";
      } catch (e) {
        // Not logged in — stay on landing page, no redirect
        hideAppLoader();
      }
    })();
  