const router = require("express").Router();
const userController = require("../controllers/userController");
const { requireAdmin, verifyToken } = require("../middlewares/auth");

// User routes
router.get("/me", verifyToken, userController.getMe);
router.put("/me", verifyToken, userController.updateMe);
// Xóa endpoint /me/avatar vì giờ dùng Cloudinary qua /me

// Admin
router.get("/", requireAdmin, userController.getAllUsers);
router.delete("/:id", requireAdmin, userController.deleteUser);
router.put("/:id", requireAdmin, userController.updateUser);
router.put("/:id/role", requireAdmin, userController.updateUserRole);

module.exports = router;
