const express = require("express");
const router = express.Router();
const orderCtrl = require("../controllers/orderController");

// 🔑 dùng middleware admin ở auth-services (đúng path từ thư mục routes)
const { requireAdmin } = require("../../auth-services/middlewares/auth");

// User routes
router.post("/", orderCtrl.createOrder);
router.get("/me", orderCtrl.myOrders);

// Admin routes
router.get("/",    requireAdmin, orderCtrl.adminList);
router.get("/:id", requireAdmin, orderCtrl.adminGetOne);
router.patch("/:id", requireAdmin, orderCtrl.adminUpdate);

module.exports = router;
