const router = require("express").Router();
const notificationController = require("../controllers/notificationController");
const middlewareController = require("../controllers/middlewareController");

// Lấy danh sách thông báo của user hiện tại
router.get("/", middlewareController.verifyToken, notificationController.getMyNotifications);

// Đánh dấu tất cả thông báo đã đọc (PHẢI TRƯỚC /:id)
router.patch("/read-all", middlewareController.verifyToken, notificationController.markAllAsRead);

// Xóa tất cả thông báo đã đọc (PHẢI TRƯỚC /:id)
router.delete("/read-all", middlewareController.verifyToken, notificationController.deleteAllRead);

// Đánh dấu một thông báo đã đọc
router.patch("/:id/read", middlewareController.verifyToken, notificationController.markAsRead);

// Xóa một thông báo
router.delete("/:id", middlewareController.verifyToken, notificationController.deleteNotification);

module.exports = router;
