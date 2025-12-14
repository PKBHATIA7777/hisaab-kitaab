const API_BASE = "http://127.0.0.1:5001/api";

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw data;
  }
  return data;
}

// -------------------------------
// Google sign-in helper
// -------------------------------
async function handleGoogleCredential(response) {
  try {
    const idToken = response.credential;

    const data = await apiFetch("/auth/google", {
      method: "POST",
      body: { idToken },
    });

    // You can remove this alert if you want a smoother experience
    alert("Logged in with Google as " + data.user.username);

    if (data.isNewUser) {
      window.location.href = "dasboard.html";
    } else {
      window.location.href = "dashboard.html";
    }
  } catch (err) {
    alert(err.message || "Google sign-in failed");
  }
}

// expose globally for Google script
window.handleGoogleCredential = handleGoogleCredential;