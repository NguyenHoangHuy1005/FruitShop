const router = require("express").Router();
const articleController = require("../controllers/articleController");
const {
  verifyToken,
  verifyTokenAndAdmin,
} = require("../../auth-services/controllers/middlewareController");
const { optionalAuth } = require("../../auth-services/middlewares/auth");

// Admin routes (must be before /:id)
router.get("/admin/all", verifyTokenAndAdmin, articleController.getAllArticles);
router.patch("/:id/approve", verifyTokenAndAdmin, articleController.approveArticle);
router.patch("/:id/reject", verifyTokenAndAdmin, articleController.rejectArticle);

// Public routes
router.get("/public", articleController.getPublicArticles);

// User routes (require login)
router.post("/", verifyToken, articleController.createArticle);
router.get("/user/my-articles", verifyToken, articleController.getMyArticles);
router.put("/:id", verifyToken, articleController.updateArticle);
router.delete("/:id", verifyToken, articleController.deleteArticle);

// Must be last (catch-all for specific ID)
router.get("/:id", optionalAuth, articleController.getArticleById);

module.exports = router;
