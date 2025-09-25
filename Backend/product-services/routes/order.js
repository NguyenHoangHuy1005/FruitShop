const express = require("express");
const router = express.Router();
const orderCtrl = require("../controllers/orderController");
const { requireAdmin, verifyToken } = require("../../auth-services/middlewares/auth");


// User routes
router.post("/", verifyToken, orderCtrl.createOrder);
router.get("/me", verifyToken, orderCtrl.myOrders);
router.put("/:id/cancel", verifyToken, orderCtrl.cancelOrder);

// Admin routes
router.get("/stats", requireAdmin, orderCtrl.adminStats);
router.get("/",    requireAdmin, orderCtrl.adminList);
router.get("/:id", requireAdmin, orderCtrl.adminGetOne);
router.patch("/:id", requireAdmin, orderCtrl.adminUpdate);

// API update status
router.patch("/:id/status", orderCtrl.updateOrderStatus);

module.exports = router;
