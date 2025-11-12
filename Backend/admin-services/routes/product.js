const router = require("express").Router();
const productController = require("../controllers/productController");
const { requireAdmin } = require("../../auth-services/middlewares/auth");

// Debug: confirm this admin product router is loaded
console.log("Admin product routes loaded");

// Public (ai cũng xem được)
router.get("/", productController.getAllProducts);
router.get("/category", productController.getProductByCategory);
router.get("/search", productController.searchProductByName);

// Admin
router.post("/create", requireAdmin, productController.creatProduct);
router.delete("/:id", requireAdmin, productController.deleteProduct);
router.put("/:id", requireAdmin, productController.updateProduct);
router.patch("/:id/toggle-publish", requireAdmin, productController.togglePublish);
router.post("/bulk-discount", requireAdmin, productController.bulkDiscount);

module.exports = router;
