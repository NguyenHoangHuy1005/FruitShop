const Comment = require("../models/Comment");
const Article = require("../models/Article");
const notificationController = require("../../auth-services/controllers/notificationController");

const commentController = {
  createComment: async (req, res) => {
    try {
      const { articleId, content, parentCommentId, mentionedUserId } = req.body;
      const userId = req.user.id;
      const userName = req.user.username || req.user.email;

      const newComment = new Comment({
        article: articleId,
        user: userId,
        userName,
        content,
        parentComment: parentCommentId || null,
        mentionedUser: mentionedUserId || null,
      });

      const savedComment = await newComment.save();

      const populatedComment = await Comment.findById(savedComment._id)
        .populate("user", "username email")
        .populate("mentionedUser", "username email")
        .populate("parentComment");

      // ===== NOTIFICATIONS =====
      // 1. Nếu là reply (có parentComment)
      if (parentCommentId) {
        const parentComment = await Comment.findById(parentCommentId).populate("user");
        
        // Thông báo cho chủ comment gốc
        if (parentComment && parentComment.user && parentComment.user._id.toString() !== userId) {
          await notificationController.createNotification(
            parentComment.user._id,
            "comment_reply",
            "Phản hồi mới",
            `${userName} đã trả lời bình luận của bạn: "${content.substring(0, 50)}..."`,
            savedComment._id,
            `/articles/${articleId}`
          );
        }

        // Thông báo cho người được mention (nếu có)
        if (mentionedUserId && mentionedUserId.toString() !== userId && mentionedUserId.toString() !== parentComment?.user?._id.toString()) {
          await notificationController.createNotification(
            mentionedUserId,
            "comment_mention",
            "Được nhắc đến",
            `${userName} đã nhắc đến bạn trong một phản hồi`,
            savedComment._id,
            `/articles/${articleId}`
          );
        }
      } else {
        // 2. Nếu là comment mới (không có parent) - thông báo cho chủ bài viết
        const article = await Article.findById(articleId).populate("author");
        if (article && article.author && article.author._id.toString() !== userId) {
          await notificationController.createNotification(
            article.author._id,
            "new_comment",
            "Bình luận mới",
            `${userName} đã bình luận vào bài viết "${article.title}": "${content.substring(0, 50)}..."`,
            savedComment._id,
            `/articles/${articleId}`
          );
        }
      }

      res.status(201).json({
        success: true,
        message: "Bình luận đã được gửi",
        comment: populatedComment,
      });
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tạo bình luận",
        error: error.message,
      });
    }
  },

  getArticleComments: async (req, res) => {
    try {
      const { articleId } = req.params;
      const { page = 1, limit = 20, sortBy = "createdAt", order = "desc" } = req.query;

      const query = { article: articleId, status: "active", parentComment: null };
      const skip = (page - 1) * limit;
      const sortOrder = order === "asc" ? 1 : -1;

      // Định nghĩa các field sort hợp lệ
      const sortField = sortBy === "likes" ? "likes" : "createdAt";

      const comments = await Comment.find(query)
        .populate("user", "username email")
        .populate("mentionedUser", "username email")
        .populate("reactions.user", "username email")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit));

      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await Comment.find({
            parentComment: comment._id,
            status: "active",
          })
            .populate("user", "username email")
            .populate("mentionedUser", "username email")
            .populate("reactions.user", "username email")
            .sort({ createdAt: 1 });

          return {
            ...comment.toObject(),
            replies,
          };
        })
      );

      const total = await Comment.countDocuments(query);

      res.status(200).json({
        success: true,
        comments: commentsWithReplies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách bình luận",
        error: error.message,
      });
    }
  },

  updateComment: async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bình luận",
        });
      }

      if (comment.user.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền chỉnh sửa bình luận này",
        });
      }

      comment.content = content;
      const updatedComment = await comment.save();

      res.status(200).json({
        success: true,
        message: "Cập nhật bình luận thành công",
        comment: updatedComment,
      });
    } catch (error) {
      console.error("Error updating comment:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi cập nhật bình luận",
        error: error.message,
      });
    }
  },

  deleteComment: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bình luận",
        });
      }

      if (comment.user.toString() !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xóa bình luận này",
        });
      }

      await Comment.deleteMany({ parentComment: id });
      await Comment.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Xóa bình luận thành công",
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa bình luận",
        error: error.message,
      });
    }
  },

  hideComment: async (req, res) => {
    try {
      const { id } = req.params;
      const { adminNote } = req.body;

      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bình luận",
        });
      }

      comment.status = "hidden";
      comment.adminNote = adminNote || "Vi phạm chuẩn mực bình luận";

      await comment.save();

      res.status(200).json({
        success: true,
        message: "Ẩn bình luận thành công",
        comment,
      });
    } catch (error) {
      console.error("Error hiding comment:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi ẩn bình luận",
        error: error.message,
      });
    }
  },

  showComment: async (req, res) => {
    try {
      const { id } = req.params;

      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bình luận",
        });
      }

      comment.status = "active";
      comment.adminNote = null;

      await comment.save();

      res.status(200).json({
        success: true,
        message: "Hiển thị bình luận thành công",
        comment,
      });
    } catch (error) {
      console.error("Error showing comment:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi hiển thị bình luận",
        error: error.message,
      });
    }
  },

  getAllComments: async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      // Chỉ lấy comments gốc (không phải replies)
      const query = { parentComment: null };
      if (status) query.status = status;

      const skip = (page - 1) * limit;

      const comments = await Comment.find(query)
        .populate("user", "username email")
        .populate("article", "title")
        .populate("reactions.user", "username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Lấy replies cho mỗi comment
      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await Comment.find({
            parentComment: comment._id,
          })
            .populate("user", "username email")
            .populate("mentionedUser", "username email")
            .populate("reactions.user", "username email")
            .sort({ createdAt: 1 });

          return {
            ...comment.toObject(),
            replies,
          };
        })
      );

      const total = await Comment.countDocuments(query);

      res.status(200).json({
        success: true,
        comments: commentsWithReplies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching all comments:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách bình luận",
        error: error.message,
      });
    }
  },

  toggleLikeComment: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bình luận",
        });
      }

      const likeIndex = comment.likes.indexOf(userId);
      const dislikeIndex = comment.dislikes.indexOf(userId);

      if (likeIndex > -1) {
        comment.likes.splice(likeIndex, 1);
      } else {
        comment.likes.push(userId);
        // Remove dislike if exists (mutual exclusive)
        if (dislikeIndex > -1) {
          comment.dislikes.splice(dislikeIndex, 1);
        }
      }

      await comment.save();

      res.status(200).json({
        success: true,
        message: likeIndex > -1 ? "Đã bỏ thích" : "Đã thích",
        likes: comment.likes.length,
        dislikes: comment.dislikes.length,
      });
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi thích/bỏ thích bình luận",
        error: error.message,
      });
    }
  },

  toggleDislikeComment: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bình luận",
        });
      }

      const dislikeIndex = comment.dislikes.indexOf(userId);
      const likeIndex = comment.likes.indexOf(userId);

      if (dislikeIndex > -1) {
        comment.dislikes.splice(dislikeIndex, 1);
      } else {
        comment.dislikes.push(userId);
        // Remove like if exists (mutual exclusive)
        if (likeIndex > -1) {
          comment.likes.splice(likeIndex, 1);
        }
      }

      await comment.save();

      res.status(200).json({
        success: true,
        message: dislikeIndex > -1 ? "Đã bỏ không thích" : "Đã không thích",
        likes: comment.likes.length,
        dislikes: comment.dislikes.length,
      });
    } catch (error) {
      console.error("Error toggling dislike:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi không thích/bỏ không thích bình luận",
        error: error.message,
      });
    }
  },

  removeReactionFromComment: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bình luận",
        });
      }

      // Tìm reaction của user
      const reaction = comment.reactions.find(r => r.user.toString() === userId);

      if (!reaction && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xóa reaction này",
        });
      }

      // Admin có thể xóa reaction của bất kỳ ai
      if (isAdmin) {
        const targetUserId = req.query.targetUserId || userId;
        comment.reactions = comment.reactions.filter(
          r => r.user.toString() !== targetUserId
        );
      } else {
        comment.reactions = comment.reactions.filter(
          r => r.user.toString() !== userId
        );
      }

      await comment.save();

      const populatedComment = await Comment.findById(id).populate('reactions.user', 'username email');

      res.status(200).json({
        success: true,
        message: "Đã xóa reaction",
        reactions: populatedComment.reactions,
      });
    } catch (error) {
      console.error("Error removing reaction:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa reaction",
        error: error.message,
      });
    }
  },

  addReactionToComment: async (req, res) => {
    try {
      const { id } = req.params;
      const { icon, comment: reactionComment } = req.body;
      const userId = req.user.id;

      if (!icon) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn biểu tượng cảm xúc",
        });
      }

      const comment = await Comment.findById(id);

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bình luận",
        });
      }

      // Remove previous reaction from this user
      comment.reactions = comment.reactions.filter(
        (r) => r.user.toString() !== userId
      );

      // Add new reaction with optional comment
      comment.reactions.push({
        user: userId,
        icon,
        comment: reactionComment || "",
        createdAt: new Date(),
      });

      await comment.save();

      // Populate user info
      const populatedComment = await Comment.findById(id)
        .populate('reactions.user', 'username email')
        .populate('user', 'username')
        .populate('article', 'title');

      // ===== NOTIFICATION =====
      // Thông báo cho chủ comment
      const userName = req.user.username || req.user.email || 'Người dùng';
      console.log('🔔 Sending notification for comment reaction:', {
        commentOwner: populatedComment.user?._id,
        reactor: userId,
        icon,
        isReply: !!populatedComment.parentComment
      });
      
      if (populatedComment.user && populatedComment.user._id.toString() !== userId) {
        const reactionLabel = icon === 'like' ? 'thích' : icon === 'love' ? 'yêu thích' : icon;
        try {
          await notificationController.createNotification(
            populatedComment.user._id,
            populatedComment.parentComment ? "reply_reaction" : "comment_reaction",
            "Cảm xúc mới",
            `${userName} đã thả ${reactionLabel} vào ${populatedComment.parentComment ? 'phản hồi' : 'bình luận'} của bạn`,
            populatedComment._id,
            `/articles/${populatedComment.article._id}`
          );
          console.log('✅ Notification sent successfully');
        } catch (notifError) {
          console.error('❌ Error sending notification:', notifError);
        }
      } else {
        console.log('⏭️ Skipping notification (same user or no owner)');
      }

      res.status(200).json({
        success: true,
        message: "Đã thêm biểu tượng cảm xúc",
        reactions: populatedComment.reactions,
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi thêm biểu tượng cảm xúc",
        error: error.message,
      });
    }
  },
};

module.exports = commentController;
