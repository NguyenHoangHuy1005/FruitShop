const express = require("express");
const router = express.Router();
const orderCtrl = require("../controllers/orderController");

// FE gọi POST /api/order
router.post("/", orderCtrl.createOrder);

// Xem đơn của người dùng (nếu cần)
router.get("/me", orderCtrl.myOrders);

module.exports = router;
