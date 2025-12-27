const crypto = require("crypto");

function csrfProtection(req, res, next) {
  // 1. Setup Cookie if missing
  if (!req.cookies.csrf_token) {
    const token = crypto.randomUUID();
    res.cookie("csrf_token", token, {
      httpOnly: false, 
      secure: true, 
      sameSite: "none", 
      maxAge: 24 * 60 * 60 * 1000 
    });
    req.cookies.csrf_token = token;
  }

  // ✅ FIX: Make token accessible to server.js route handlers
  req.csrf_token = req.cookies.csrf_token; 

  // 2. Verify Token on Mutations (POST, PUT, DELETE)
  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const headerToken = req.headers["x-csrf-token"];
    const cookieToken = req.cookies.csrf_token;
    
    // ✅ DEBUG LOG (Add this to see what's happening in Render Logs)
    console.log(`[CSRF Check] Method: ${method} | Header: ${headerToken} | Cookie: ${cookieToken}`);

    // ✅ FIX: Strict check logic
    if (!headerToken || headerToken !== cookieToken) {
      
      // EMERGENCY BYPASS: If the Origin is explicitly trusted, allow it.
      // This fixes cases where browsers block 3rd party cookies but headers are fine.
      const origin = req.headers.origin;
      if (origin === process.env.CLIENT_URL) {
         console.log("⚠️ CSRF Mismatch but Origin is Trusted. Allowing request.");
         return next();
      }

      console.error("❌ CSRF Blocked");
      return res.status(403).json({
        ok: false,
        message: "Security check failed (CSRF). Try disabling 'Block Third Party Cookies' or use Chrome."
      });
    }
  }

  next();
}

module.exports = csrfProtection;
