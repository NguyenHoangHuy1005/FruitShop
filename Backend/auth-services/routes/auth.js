const router = require("express").Router();
const authController = require("../controllers/authController");
const middlewareController = require("../controllers/middlewareController");

// Auth core
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/refresh", authController.requestRefreshToken);
router.post("/logout", middlewareController.verifyToken, authController.userLogout);

// Email verification
router.post("/verify", authController.verifyAccount);
router.post("/verify/resend", authController.resendVerifyCode);

module.exports = router;
