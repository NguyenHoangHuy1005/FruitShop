const router = require("express").Router();
const stock = require("../controllers/stockController");
const { requireAdmin } = require("../../auth-services/middlewares/auth");

// Admin: xem/nhập kho
router.get("/", requireAdmin, stock.list);
router.get("/:productId", requireAdmin, stock.getOne);
router.post("/in", requireAdmin, stock.stockIn);
router.post("/set", requireAdmin, stock.setQuantity);

module.exports = router;
