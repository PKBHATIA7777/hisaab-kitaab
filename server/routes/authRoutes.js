
const express = require("express");
const router = express.Router();
const {
  registerRequestOtp,
  registerVerifyOtp,
  registerComplete, // <--- IMPORT NEW FUNCTION
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
router.post("/register/complete", registerComplete); // <--- NEW ROUTE
// login
router.post("/login", login);
// google auth
router.post("/google", googleLogin);
// set password (used only for legacy or separate flows)
router.post("/set-password", setPassword);
// forgot password
router.post("/forgot/request-otp", forgotRequestOtp);
router.post("/forgot/reset", resetPassword);
// user
router.get("/me", me);
router.post("/logout", logout);
module.exports = router;



// const express = require("express");
// const router = express.Router();

// const {
//   registerRequestOtp,
//   registerVerifyOtp,
//   login,
//   forgotRequestOtp,
//   resetPassword,
//   me,
//   logout,
//   googleLogin,
//   setPassword, // ✅ ADD THIS
// } = require("../controllers/authController");

// // register
// router.post("/register/request-otp", registerRequestOtp);
// router.post("/register/verify-otp", registerVerifyOtp);

// // login
// router.post("/login", login);

// // google auth
// router.post("/google", googleLogin);

// // set password ✅ ADD THIS ROUTE
// router.post("/set-password", setPassword);

// // forgot password
// router.post("/forgot/request-otp", forgotRequestOtp);
// router.post("/forgot/reset", resetPassword);

// // user
// router.get("/me", me);
// router.post("/logout", logout);

// module.exports = router;
