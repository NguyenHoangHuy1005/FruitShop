const express = require("express");
const router = express.Router();
const orderCtrl = require("../controllers/orderController");
const { requireAdmin, verifyToken } = require("../../auth-services/middlewares/auth");


// User routes
router.post("/", verifyToken, orderCtrl.createOrder);
router.get("/me", verifyToken, orderCtrl.myOrders);
router.put("/:id/cancel", verifyToken, orderCtrl.cancelOrder);
router.get("/shipper/orders", verifyToken, orderCtrl.shipperListOrders);
router.patch("/shipper/orders/:id/accept", verifyToken, orderCtrl.shipperAcceptOrder);
router.patch("/shipper/orders/:id/deliver", verifyToken, orderCtrl.shipperDeliveredOrder);
router.patch("/shipper/orders/:id/cancel", verifyToken, orderCtrl.shipperCancelOrder);
router.patch("/:id/shipper/accept", verifyToken, orderCtrl.shipperAcceptOrder);
router.patch("/:id/shipper/delivered", verifyToken, orderCtrl.shipperDeliveredOrder);
router.patch("/:id/shipper/cancel", verifyToken, orderCtrl.shipperCancelOrder);
router.patch("/:id/confirm-delivered", verifyToken, orderCtrl.userConfirmDelivered);

// Admin routes
router.get("/stats", requireAdmin, orderCtrl.adminStats);
router.get("/",    requireAdmin, orderCtrl.adminList);
router.get("/:id", requireAdmin, orderCtrl.adminGetOne);
router.patch("/:id", requireAdmin, orderCtrl.adminUpdate);
router.post("/:id/prepare", requireAdmin, orderCtrl.adminPrepareOrder);
router.post("/maintenance/auto-expire", requireAdmin, orderCtrl.runAutoExpireOrders);
router.post("/maintenance/auto-complete", requireAdmin, orderCtrl.runAutoCompleteOrders);

module.exports = router;
