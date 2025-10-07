const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../auth-services/middlewares/auth");
const paymentCtrl = require("../controllers/paymentController");

router.get("/:id", verifyToken, paymentCtrl.getPaymentSession);
router.post("/:id/confirm", verifyToken, paymentCtrl.confirmPayment);
router.post("/:id/cancel", verifyToken, paymentCtrl.cancelPayment);

module.exports = router;