const router = require("express").Router();
const stock = require("../controllers/stockController");

// ❗️Đổi từ { requireAdmin } sang object để tránh destructuring nhầm
const auth = require("../../auth-services/middlewares/auth");

// DEBUG (xóa sau khi OK)
console.log("auth keys =", Object.keys(auth || {}));
console.log("typeof auth.requireAdmin =", typeof auth?.requireAdmin);
console.log("typeof stock.list =", typeof stock?.list);
console.log("resolve auth =", require.resolve("../../auth-services/middlewares/auth"));

// Ép fail sớm nếu thiếu
if (!auth || typeof auth.requireAdmin !== "function") {
    throw new Error("requireAdmin is missing or not a function. Check ../../auth-services/middlewares/auth");
}

// routes/stock.js

// xem tồn
router.get("/", auth.requireAdmin, stock.list);

// ✅ đặt /receipts trước /:productId
router.get("/receipts", auth.requireAdmin, stock.listReceipts);
router.get("/receipt/:id", auth.requireAdmin, stock.getReceiptOne);
router.get("/invoice/:id", auth.requireAdmin, stock.downloadInvoice);

// route theo productId để cuối cùng
router.get("/:productId", auth.requireAdmin, stock.getOne);

// nhập đơn giản / set số lượng
router.post("/in", auth.requireAdmin, stock.stockIn);
router.post("/set", auth.requireAdmin, stock.setQuantity);
router.post("/in-with-invoice", auth.requireAdmin, stock.stockInWithInvoice);



module.exports = router;
