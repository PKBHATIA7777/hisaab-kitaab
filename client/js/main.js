const API_BASE = "https://hisaab-kitaab-service-app.onrender.com/api";


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

/* ======================================
   SIGNUP – REQUEST OTP
====================================== */
async function requestSignupOTP() {
  try {
    const realName = document.getElementById("realName").value.trim();
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();

    if (!realName || !username || !email) {
      alert("All fields are required");
      return;
    }

    // store for verify step
    localStorage.setItem("signupRealName", realName);
    localStorage.setItem("signupUsername", username);
    localStorage.setItem("signupEmail", email);

    // ✅ FIX: send all required fields
    await apiFetch("/auth/register/request-otp", {
      method: "POST",
      body: {
        email,
        realName,
        username,
      },
    });

    alert("OTP sent to your email");
  } catch (err) {
    alert(err.message || "Failed to send OTP");
  }
}

/* ======================================
   SIGNUP – VERIFY OTP
====================================== */
async function verifySignupOTP() {
  try {
    const otp = document.getElementById("otp").value.trim();

    const realName = localStorage.getItem("signupRealName");
    const username = localStorage.getItem("signupUsername");
    const email = localStorage.getItem("signupEmail");

    if (!otp || !realName || !username || !email) {
      alert("Missing signup data or OTP");
      return;
    }

    await apiFetch("/auth/register/verify-otp", {
      method: "POST",
      body: { email, otp, realName, username },
    });

    // cleanup
    localStorage.removeItem("signupRealName");
    localStorage.removeItem("signupUsername");
    localStorage.removeItem("signupEmail");

    alert("Signup successful");
    window.location.href = "dashboard.html";
  } catch (err) {
    alert(err.message || "OTP verification failed");
  }
}

/* ======================================
   GOOGLE SIGN-IN
====================================== */
async function handleGoogleCredential(response) {
  try {
    const idToken = response.credential;

    const data = await apiFetch("/auth/google", {
      method: "POST",
      body: { idToken },
    });

    alert("Logged in with Google as " + data.user.username);
    window.location.href = "dashboard.html";
  } catch (err) {
    alert(err.message || "Google sign-in failed");
  }
}

// expose globally
window.handleGoogleCredential = handleGoogleCredential;
window.requestSignupOTP = requestSignupOTP;
window.verifySignupOTP = verifySignupOTP;
