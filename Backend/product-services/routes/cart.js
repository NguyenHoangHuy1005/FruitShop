const express = require("express");
const router = express.Router();
const cartCtrl = require("../controllers/cartController");

// Lấy / tạo giỏ hiện tại
router.get("/", cartCtrl.getCart);

// Thêm sản phẩm vào giỏ
router.post("/add", cartCtrl.addItem);

// Cập nhật số lượng 1 item trong giỏ
router.put("/item/:productId", cartCtrl.updateItem);

// Xóa 1 item khỏi giỏ
router.delete("/item/:productId", cartCtrl.removeItem);

// Xóa toàn bộ giỏ
router.delete("/", cartCtrl.clearCart);

module.exports = router;
