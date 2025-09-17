const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// API tăng lượt xem
router.put("/:id/views", productController.increaseView);

module.exports = router;
