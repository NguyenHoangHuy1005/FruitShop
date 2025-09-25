const router = require("express").Router();
const authController = require("../controllers/authController");
const middlewareController = require("../controllers/middlewareController");

// Auth core
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.userLogout);

// Email verification
router.post("/verify", authController.verifyAccount);
router.post("/verify/resend", authController.resendVerifyCode);

// Password reset
router.post("/password/forgot", authController.forgotPassword);
router.post("/password/reset", authController.resetPassword);

// Change email (OTP gửi về email hiện tại)
router.post("/email/change/request", middlewareController.verifyToken, authController.requestChangeEmail);
router.post("/email/change/confirm", middlewareController.verifyToken, authController.confirmChangeEmail);

module.exports = router;
