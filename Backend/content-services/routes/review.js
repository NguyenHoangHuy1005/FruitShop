const router = require("express").Router();
const reviewController = require("../controllers/reviewController");
const {
  verifyToken,
  verifyTokenAndAdmin,
} = require("../../auth-services/controllers/middlewareController");

// Admin routes (must be first)
router.get("/admin/all", verifyTokenAndAdmin, reviewController.getAllReviews);
router.patch("/:id/hide", verifyTokenAndAdmin, reviewController.hideReview);
router.patch("/:id/show", verifyTokenAndAdmin, reviewController.showReview);

// Public routes
router.get("/product/:productId", reviewController.getProductReviews);

// User routes (require login)
router.post("/", verifyToken, reviewController.createReview);
router.put("/:id", verifyToken, reviewController.updateReview);
router.delete("/:id", verifyToken, reviewController.deleteReview);
router.post("/:id/like", verifyToken, reviewController.toggleLikeReview);
router.get("/can-review/:productId", verifyToken, reviewController.canReview);

module.exports = router;
