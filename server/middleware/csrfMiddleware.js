const crypto = require("crypto");

function csrfProtection(req, res, next) {
  // 1. If user has no CSRF cookie, generate one and set it
  if (!req.cookies.csrf_token) {
    const token = crypto.randomUUID();
    
    res.cookie("csrf_token", token, {
      httpOnly: false, // CRITICAL: Client JS must be able to read this
      secure: process.env.NODE_ENV === "production", // Secure in prod
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    // Attach to req object so logic below sees it immediately
    req.cookies.csrf_token = token;
  }

  // 2. If this is a POST/PUT/DELETE, verify the token
  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const headerToken = req.headers["x-csrf-token"];
    const cookieToken = req.cookies.csrf_token;

    if (!headerToken || headerToken !== cookieToken) {
      console.error("CSRF Blocked:", { headerToken, cookieToken });
      return res.status(403).json({
        ok: false,
        message: "Security check failed (CSRF). Please refresh the page."
      });
    }
  }

  next();
}

module.exports = csrfProtection;