const Comment = require("../models/Comment");

const commentController = {
  createComment: async (req, res) => {
    try {
      const { articleId, content, parentCommentId } = req.body;
      const userId = req.user.id;
      const userName = req.user.username || req.user.email;

      const newComment = new Comment({
        article: articleId,
        user: userId,
        userName,
        content,
        parentComment: parentCommentId || null,
      });

      const savedComment = await newComment.save();

      const populatedComment = await Comment.findById(savedComment._id)
        .populate("user", "username email")
        .populate("parentComment");

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
      const { page = 1, limit = 20 } = req.query;

      const query = { article: articleId, status: "active", parentComment: null };
      const skip = (page - 1) * limit;

      const comments = await Comment.find(query)
        .populate("user", "username email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await Comment.find({
            parentComment: comment._id,
            status: "active",
          })
            .populate("user", "username email")
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

      const query = {};
      if (status) query.status = status;

      const skip = (page - 1) * limit;

      const comments = await Comment.find(query)
        .populate("user", "username email")
        .populate("article", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Comment.countDocuments(query);

      res.status(200).json({
        success: true,
        comments,
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
};

module.exports = commentController;
