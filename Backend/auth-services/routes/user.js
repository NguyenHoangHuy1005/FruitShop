const router = require("express").Router();
const userController = require("../controllers/userController");
const { requireAdmin, verifyToken } = require("../middlewares/auth");
// User
router.get("/me", verifyToken, userController.getMe);
router.put("/me", verifyToken, userController.updateMe);
router.post("/me/avatar", verifyToken, userController.uploadAvatar);

// Admin
router.get("/", requireAdmin, userController.getAllUsers);
router.delete("/:id", requireAdmin, userController.deleteUser);
router.put("/:id", requireAdmin, userController.updateUser);

module.exports = router;
