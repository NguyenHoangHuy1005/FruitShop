const router = require("express").Router();
const productController = require("../controllers/productController");
const { requireAdmin } = require("../../auth-services/middlewares/auth");

// Public (ai cũng xem được)
router.get("/", productController.getAllProducts);
router.get("/category", productController.getProductByCategory);
router.get("/search", productController.searchProductByName);

// Admin
router.post("/create", requireAdmin, productController.creatProduct);
router.delete("/:id", requireAdmin, productController.deleteProduct);
router.put("/:id", requireAdmin, productController.updateProduct);

module.exports = router;
