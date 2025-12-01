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
router.patch("/:id/reply/:replyId/hide", verifyTokenAndAdmin, reviewController.hideReply);
router.patch("/:id/reply/:replyId/show", verifyTokenAndAdmin, reviewController.showReply);

// Public routes
router.get("/product/:productId", reviewController.getProductReviews);

// User routes (require login)
router.post("/", verifyToken, reviewController.createReview);
router.put("/:id", verifyToken, reviewController.updateReview);
router.delete("/:id", verifyToken, reviewController.deleteReview);
router.post("/:id/like", verifyToken, reviewController.toggleLikeReview);
router.post("/:id/dislike", verifyToken, reviewController.toggleDislikeReview);
router.post("/:id/reaction", verifyToken, reviewController.addReaction);
router.delete("/:id/reaction", verifyToken, reviewController.removeReaction);
router.post("/:id/reply", verifyToken, reviewController.addReply);
router.delete("/:id/reply/:replyId", verifyToken, reviewController.deleteReply);
router.patch("/:id/reply/:replyId", verifyToken, reviewController.updateReply);
router.post("/:id/reply/:replyId/like", verifyToken, reviewController.toggleLikeReply);
router.post("/:id/reply/:replyId/dislike", verifyToken, reviewController.toggleDislikeReply);
router.post("/:id/reply/:replyId/reaction", verifyToken, reviewController.addReactionToReply);
router.delete("/:id/reply/:replyId/reaction", verifyToken, reviewController.removeReactionFromReply);
router.get("/can-review/:productId", verifyToken, reviewController.canReview);

module.exports = router;
