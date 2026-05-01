const crypto = require("crypto");

function csrfProtection(req, res, next) {
  // Set cookie if missing
  if (!req.cookies.csrf_token) {
    const token = crypto.randomUUID();
    res.cookie("csrf_token", token, {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    });
    req.cookies.csrf_token = token;
  }

  req.csrf_token = req.cookies.csrf_token;

  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  const headerToken = req.headers["x-csrf-token"];
  const cookieToken = req.cookies.csrf_token;

  if (!headerToken || !cookieToken) {
    // Token genuinely missing — reject
    return res.status(403).json({
      ok: false,
      message: "Security check failed (CSRF token missing). Please refresh the page.",
    });
  }

  if (headerToken !== cookieToken) {
    return res.status(403).json({
      ok: false,
      message: "Security check failed (CSRF mismatch). Please refresh the page.",
    });
  }

  next();
}

module.exports = csrfProtection;