// product-services/routes/coupon.js
const express = require("express");
const router = express.Router();
const couponCtrl = require("../controllers/couponController");
const { requireAdmin } = require("../../auth-services/middlewares/auth");

// Admin quản lý coupon
router.post("/", requireAdmin, couponCtrl.createCoupon);
router.get("/", requireAdmin, couponCtrl.listCoupons);
router.delete("/:id", requireAdmin, couponCtrl.deleteCoupon);
router.patch("/:id/toggle", requireAdmin, couponCtrl.toggleCoupon);

// User: kiểm tra mã giảm giá
router.post("/validate", couponCtrl.validateCoupon);

module.exports = router;
