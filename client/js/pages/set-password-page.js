
    const form = document.getElementById("set-password-form");

    // Redirect away if user is not logged in (no verified email / cookie)
    (async function () {
      try {
        await apiFetch("/auth/me");
      } catch (e) {
        if (typeof window.navigateTo === 'function') window.navigateTo("signup.html");
        else window.location.href = "signup.html";
      }
    })();

    if (form) {
      const pass1 = form.querySelector('input[name="newPassword"]');
      const pass2 = form.querySelector('input[name="confirmPassword"]');

      // Real-time Match Validation
      function checkMatch() {
        const val1 = pass1.value;
        const val2 = pass2.value;
        
        // Only check if confirm field has text
        if (val2.length > 0) {
          if (val1 !== val2) {
            pass2.style.borderColor = "#ff1744"; // Red
          } else {
            pass2.style.borderColor = "#00e676"; // Green
          }
        } else {
          pass2.style.borderColor = "#eee"; // Reset
        }
      }

      pass1.addEventListener("input", checkMatch);
      pass2.addEventListener("input", checkMatch);

      // Form submission handler
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const newPassword = fd.get("newPassword");
        const confirmPassword = fd.get("confirmPassword");

        if (newPassword !== confirmPassword) {
          alert("Passwords do not match");
          return;
        }

        try {
          await apiFetch("/auth/set-password", {
            method: "POST",
            body: { newPassword },
          });

          alert("Password set successfully. You can now log in with email / username.");
          if (typeof window.navigateTo === 'function') window.navigateTo("dashboard.html");
          else window.location.href = "dashboard.html";
        } catch (err) {
          alert(err.message || "Failed to set password");
        }
      });
    }
