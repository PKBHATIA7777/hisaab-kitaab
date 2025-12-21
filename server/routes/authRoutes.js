
/* server/routes/authRoutes.js */
const express = require("express");
const router = express.Router();
const cache = require("../middleware/cacheMiddleware"); // <--- IMPORT

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
} = require("../controllers/authController");

// register
router.post("/register/request-otp", registerRequestOtp);
router.post("/register/verify-otp", registerVerifyOtp);
router.post("/register/complete", registerComplete);
// login
router.post("/login", login);
// google auth
router.post("/google", googleLogin);
// set password 
router.post("/set-password", setPassword);
// forgot password
router.post("/forgot/request-otp", forgotRequestOtp);
router.post("/forgot/reset", resetPassword);

// user
// ✅ CACHE APPLIED: Cache the 'me' profile for 5 minutes
router.get("/me", cache(300), me);

router.post("/logout", logout);
module.exports = router;


// const express = require("express");
// const router = express.Router();
// const {
//   registerRequestOtp,
//   registerVerifyOtp,
//   registerComplete, // <--- IMPORT NEW FUNCTION
//   login,
//   forgotRequestOtp,
//   resetPassword,
//   me,
//   logout,
//   googleLogin,
//   setPassword,
// } = require("../controllers/authController");
// // register
// router.post("/register/request-otp", registerRequestOtp);
// router.post("/register/verify-otp", registerVerifyOtp);
// router.post("/register/complete", registerComplete); // <--- NEW ROUTE
// // login
// router.post("/login", login);
// // google auth
// router.post("/google", googleLogin);
// // set password (used only for legacy or separate flows)
// router.post("/set-password", setPassword);
// // forgot password
// router.post("/forgot/request-otp", forgotRequestOtp);
// router.post("/forgot/reset", resetPassword);
// // user
// router.get("/me", me);
// router.post("/logout", logout);
// module.exports = router;




