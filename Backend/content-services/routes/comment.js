const router = require("express").Router();
const commentController = require("../controllers/commentController");
const {
  verifyToken,
  verifyTokenAndAdmin,
} = require("../../auth-services/controllers/middlewareController");

// Admin routes (must be first)
router.get("/admin/all", verifyTokenAndAdmin, commentController.getAllComments);
router.patch("/:id/hide", verifyTokenAndAdmin, commentController.hideComment);
router.patch("/:id/show", verifyTokenAndAdmin, commentController.showComment);

// Public routes
router.get("/article/:articleId", commentController.getArticleComments);

// User routes (require login)
router.post("/", verifyToken, commentController.createComment);
router.put("/:id", verifyToken, commentController.updateComment);
router.delete("/:id", verifyToken, commentController.deleteComment);
router.post("/:id/like", verifyToken, commentController.toggleLikeComment);
router.post("/:id/dislike", verifyToken, commentController.toggleDislikeComment);
router.post("/:id/reaction", verifyToken, commentController.addReactionToComment);
router.delete("/:id/reaction", verifyToken, commentController.removeReactionFromComment);

module.exports = router;
