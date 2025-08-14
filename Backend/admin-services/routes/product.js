// routes/product.js
const router = require("express").Router();
const productController = require("../controllers/productController");

router.post("/create", productController.creatProduct);
router.get("/", productController.getAllProducts);
router.delete("/:id", productController.deleteProduct);
router.put("/:id", productController.updateProduct);
router.get("/category", productController.getProductByCategory);
router.get("/search", productController.searchProductByName);

module.exports = router;
