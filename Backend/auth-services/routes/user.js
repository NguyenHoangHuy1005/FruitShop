const router = require("express").Router();
const userController = require("../controllers/userController");
const { requireAdmin } = require("../middlewares/auth");
// User
router.get("/me", requireAdmin, userController.getMe);
router.put("/me", requireAdmin, userController.updateMe);
router.post("/me/avatar", requireAdmin, userController.uploadAvatar);

// Admin
router.get("/", requireAdmin, userController.getAllUsers);
router.delete("/:id", requireAdmin, userController.deleteUser);
router.put("/:id", requireAdmin, userController.updateUser);

module.exports = router;
