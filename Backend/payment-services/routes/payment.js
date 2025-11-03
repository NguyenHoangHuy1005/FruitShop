const express = require("express");
const router = express.Router();
const { verifyToken, requireAdmin } = require("../../auth-services/middlewares/auth");
const paymentCtrl = require("../controllers/paymentController");

// Webhook endpoint (public - no auth required)
router.post("/webhook/sepay", paymentCtrl.handleSePayWebhook);

// User endpoints (require authentication)
router.get("/:id", verifyToken, paymentCtrl.getPaymentSession);
router.post("/:id/create-qr", verifyToken, paymentCtrl.createPaymentQr);
router.post("/:id/cancel", verifyToken, paymentCtrl.cancelPayment);

module.exports = router;
