const router = require("express").Router();
const authController = require("../controllers/authController");
const middlewareController = require("../controllers/middlewareController");

// Auth core
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/refresh", authController.requestRefreshToken);
router.post("/logout", authController.userLogout);

// Email verification
router.post("/verify", authController.verifyAccount);
router.post("/verify/resend", authController.resendVerifyCode);

// Password reset
router.post("/password/forgot", authController.forgotPassword);
router.post("/password/reset", authController.resetPassword);


module.exports = router;
