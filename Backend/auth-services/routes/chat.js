const router = require("express").Router();
const { verifyToken } = require("../middlewares/auth");
const chatController = require("../controllers/chatController");

router.use(verifyToken);

router.get("/", chatController.getChatHistory);
router.get("/conversations", chatController.getConversations);
router.post("/", chatController.postMessage);
router.delete("/", chatController.clearConversation);
router.delete("/:id", chatController.deleteMessage);
router.post("/:id/react", chatController.reactToMessage);

module.exports = router;
