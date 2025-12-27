/* server/routes/authRoutes.js */
const express = require("express");
const router = express.Router();
const cache = require("../middleware/cacheMiddleware");

const {
  registerRequestOtp,
  registerVerifyOtp,
  registerComplete,
  login,
  forgotRequestOtp,
  resetPassword,
  me,
  logout,
  googleLogin,
  setPassword,
  
  // ✅ NEW IMPORTS (Ensure these are here)
  checkIdentifier,
  loginRequestOtp,
  loginVerifyOtp
} = require("../controllers/authController");

// --- ROUTES ---

// ✅ Phase 1: Intelligent Login Flow
router.post("/check-identifier", checkIdentifier);
router.post("/login/otp-request", loginRequestOtp);
router.post("/login/otp-verify", loginVerifyOtp);

// register
router.post("/register/request-otp", registerRequestOtp);
router.post("/register/verify-otp", registerVerifyOtp);
router.post("/register/complete", registerComplete);

// login (Standard Password)
router.post("/login", login);

// google auth
router.post("/google", googleLogin);

// set password 
router.post("/set-password", setPassword);

// forgot password
router.post("/forgot/request-otp", forgotRequestOtp);
router.post("/forgot/reset", resetPassword);

// user
router.get("/me", me); // Cache removed in Phase 2

router.post("/logout", logout);

module.exports = router;