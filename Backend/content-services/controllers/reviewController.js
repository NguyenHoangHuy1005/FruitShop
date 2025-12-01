const Review = require("../models/Review");
const Order = require("../../product-services/models/Order");
const Product = require("../../product-services/models/Product");
const notificationController = require("../../auth-services/controllers/notificationController");

const reviewController = {
  createReview: async (req, res) => {
    try {
      const { productId, orderId, rating, comment, images } = req.body;
      const userId = req.user.id;

      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        status: { $in: ["delivered", "completed"] },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng hoặc đơn hàng chưa được thanh toán",
        });
      }

      // Kiểm tra sản phẩm có trong order.items không
      const productInOrder = order.items?.find(
        (item) => {
          const itemProductId = item.product?._id || item.product;
          return String(itemProductId) === String(productId);
        }
      );

      if (!productInOrder) {
        return res.status(400).json({
          success: false,
          message: "Sản phẩm không có trong đơn hàng này",
        });
      }

      const existingReview = await Review.findOne({
        product: productId,
        user: userId,
        order: orderId,
      });

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: "Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi",
        });
      }

      const newReview = new Review({
        product: productId,
        user: userId,
        order: orderId,
        rating,
        comment,
        images: images || [],
      });

      const savedReview = await newReview.save();
      await updateProductRating(productId);

      const populatedReview = await Review.findById(savedReview._id)
        .populate("user", "username email")
        .populate("product", "name");

      // ===== NOTIFICATION =====
      // Thông báo cho admin (có thể thêm logic tìm admin user)
      // Hoặc thông báo cho người bán sản phẩm nếu có
      const userName = req.user.username || req.user.email;
      const product = await Product.findById(productId);
      if (product && product.createdBy) {
        await notificationController.createNotification(
          product.createdBy,
          "new_review",
          "Đánh giá mới",
          `${userName} đã đánh giá sản phẩm "${product.name}" với ${rating} sao`,
          savedReview._id,
          `/product/detail/${productId}`
        );
      }

      res.status(201).json({
        success: true,
        message: "Đánh giá đã được gửi thành công",
        review: populatedReview,
      });
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tạo đánh giá",
        error: error.message,
      });
    }
  },

  getProductReviews: async (req, res) => {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = req.query;

      // Convert productId to ObjectId
      const mongoose = require('mongoose');
      const productObjectId = new mongoose.Types.ObjectId(productId);

      const query = { product: productObjectId, status: "active" };
      const skip = (page - 1) * limit;
      const sortOrder = order === "asc" ? 1 : -1;

      const reviews = await Review.find(query)
        .populate("user", "username email")
        .populate("reactions.user", "username email")
        .populate("replies.user", "username email")
        .populate("replies.mentionedUser", "username email")
        .populate("replies.reactions.user", "username email")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Review.countDocuments(query);

      const stats = await Review.aggregate([
        { $match: { product: productObjectId, status: "active" } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
            rating5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
            rating4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
            rating3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
            rating2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
            rating1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
          },
        },
      ]);

      console.log("📊 Product Reviews Stats:", {
        productId,
        reviewsCount: reviews.length,
        total,
        stats: stats[0]
      });

      res.status(200).json({
        success: true,
        reviews,
        statistics: stats[0] || {
          averageRating: 0,
          totalReviews: 0,
          rating5: 0,
          rating4: 0,
          rating3: 0,
          rating2: 0,
          rating1: 0,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách đánh giá",
        error: error.message,
      });
    }
  },

  updateReview: async (req, res) => {
    try {
      const { id } = req.params;
      const { rating, comment, images } = req.body;
      const userId = req.user.id;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      if (review.user.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền chỉnh sửa đánh giá này",
        });
      }

      if (rating) review.rating = rating;
      if (comment) review.comment = comment;
      if (images) review.images = images;

      const updatedReview = await review.save();
      await updateProductRating(review.product);

      res.status(200).json({
        success: true,
        message: "Cập nhật đánh giá thành công",
        review: updatedReview,
      });
    } catch (error) {
      console.error("Error updating review:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi cập nhật đánh giá",
        error: error.message,
      });
    }
  },

  deleteReview: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      if (review.user.toString() !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xóa đánh giá này",
        });
      }

      const productId = review.product;
      await Review.findByIdAndDelete(id);
      await updateProductRating(productId);

      res.status(200).json({
        success: true,
        message: "Xóa đánh giá thành công",
      });
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa đánh giá",
        error: error.message,
      });
    }
  },

  toggleLikeReview: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const likeIndex = review.likes.indexOf(userId);
      const dislikeIndex = review.dislikes.indexOf(userId);

      // Nếu đã dislike thì xóa dislike trước
      if (dislikeIndex > -1) {
        review.dislikes.splice(dislikeIndex, 1);
      }

      if (likeIndex > -1) {
        review.likes.splice(likeIndex, 1);
      } else {
        review.likes.push(userId);
      }

      await review.save();

      res.status(200).json({
        success: true,
        message: likeIndex > -1 ? "Đã bỏ thích" : "Đã thích",
        likes: review.likes.length,
        dislikes: review.dislikes.length,
      });
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi thích/bỏ thích đánh giá",
        error: error.message,
      });
    }
  },

  toggleDislikeReview: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const likeIndex = review.likes.indexOf(userId);
      const dislikeIndex = review.dislikes.indexOf(userId);

      // Nếu đã like thì xóa like trước
      if (likeIndex > -1) {
        review.likes.splice(likeIndex, 1);
      }

      if (dislikeIndex > -1) {
        review.dislikes.splice(dislikeIndex, 1);
      } else {
        review.dislikes.push(userId);
      }

      await review.save();

      res.status(200).json({
        success: true,
        message: dislikeIndex > -1 ? "Đã bỏ không thích" : "Đã không thích",
        likes: review.likes.length,
        dislikes: review.dislikes.length,
      });
    } catch (error) {
      console.error("Error toggling dislike:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi không thích/bỏ không thích đánh giá",
        error: error.message,
      });
    }
  },

  removeReaction: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      // Tìm reaction của user
      const reaction = review.reactions.find(r => r.user.toString() === userId);

      if (!reaction && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xóa reaction này",
        });
      }

      // Admin có thể xóa reaction của bất kỳ ai, user chỉ xóa của mình
      if (isAdmin) {
        // Admin xóa reaction được chỉ định qua query
        const targetUserId = req.query.targetUserId || userId;
        review.reactions = review.reactions.filter(
          r => r.user.toString() !== targetUserId
        );
      } else {
        // User xóa reaction của mình
        review.reactions = review.reactions.filter(
          r => r.user.toString() !== userId
        );
      }

      await review.save();

      const populatedReview = await Review.findById(id).populate('reactions.user', 'username email');

      res.status(200).json({
        success: true,
        message: "Đã xóa reaction",
        reactions: populatedReview.reactions,
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

  addReaction: async (req, res) => {
    try {
      const { id } = req.params;
      const { icon, comment } = req.body;
      const userId = req.user.id;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      // Xóa reaction cũ của user nếu có
      review.reactions = review.reactions.filter(
        r => r.user.toString() !== userId
      );

      // Thêm reaction mới với comment (optional)
      review.reactions.push({
        user: userId,
        icon: icon,
        comment: comment || "",
        createdAt: new Date(),
      });

      await review.save();

      // Populate user info + product info
      const populatedReview = await Review.findById(id)
        .populate('reactions.user', 'username email')
        .populate('user', 'username')
        .populate('product', 'name');

      // ===== NOTIFICATION =====
      const userName = req.user.username || req.user.email || 'Người dùng';
      console.log('🔔 Sending notification for review reaction:', {
        reviewOwner: populatedReview.user?._id,
        reactor: userId,
        icon,
        product: populatedReview.product?._id
      });
      
      if (populatedReview.user && populatedReview.user._id.toString() !== userId) {
        const reactionLabel = icon === 'like' ? 'thích' : icon === 'love' ? 'yêu thích' : icon;
        try {
          await notificationController.createNotification(
            populatedReview.user._id,
            "review_reaction",
            "Cảm xúc mới",
            `${userName} đã thả ${reactionLabel} vào đánh giá của bạn về sản phẩm "${populatedReview.product.name}"`,
            populatedReview._id,
            `/product/detail/${populatedReview.product._id}`
          );
          console.log('✅ Review notification sent successfully');
        } catch (notifError) {
          console.error('❌ Error sending review notification:', notifError);
        }
      } else {
        console.log('⏭️ Skipping review notification (same user or no owner)');
      }

      res.status(200).json({
        success: true,
        message: "Đã thêm reaction",
        reactions: populatedReview.reactions,
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi thêm reaction",
        error: error.message,
      });
    }
  },

  hideReview: async (req, res) => {
    try {
      const { id } = req.params;
      const { adminNote } = req.body;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      review.status = "hidden";
      review.adminNote = adminNote || "Vi phạm quy định đánh giá";

      await review.save();
      await updateProductRating(review.product);

      res.status(200).json({
        success: true,
        message: "Ẩn đánh giá thành công",
        review,
      });
    } catch (error) {
      console.error("Error hiding review:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi ẩn đánh giá",
        error: error.message,
      });
    }
  },

  showReview: async (req, res) => {
    try {
      const { id } = req.params;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      review.status = "active";
      review.adminNote = null;

      await review.save();
      await updateProductRating(review.product);

      res.status(200).json({
        success: true,
        message: "Hiển thị đánh giá thành công",
        review,
      });
    } catch (error) {
      console.error("Error showing review:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi hiển thị đánh giá",
        error: error.message,
      });
    }
  },

  canReview: async (req, res) => {
    try {
      const { productId, orderId } = req.params;
      const userId = req.user.id;

      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        status: "completed",
      });

      if (!order) {
        return res.status(200).json({
          success: true,
          canReview: false,
          reason: "Đơn hàng chưa được thanh toán",
        });
      }

      const productInOrder = order.items?.find(
        (item) => {
          const itemProductId = item.product?._id || item.product;
          return String(itemProductId) === String(productId);
        }
      );

      if (!productInOrder) {
        return res.status(200).json({
          success: true,
          canReview: false,
          reason: "Sản phẩm không có trong đơn hàng",
        });
      }

      const existingReview = await Review.findOne({
        product: productId,
        user: userId,
        order: orderId,
      });

      if (existingReview) {
        return res.status(200).json({
          success: true,
          canReview: false,
          reason: "Bạn đã đánh giá sản phẩm này rồi",
          review: existingReview,
        });
      }

      res.status(200).json({
        success: true,
        canReview: true,
      });
    } catch (error) {
      console.error("Error checking review eligibility:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi kiểm tra quyền đánh giá",
        error: error.message,
      });
    }
  },

  getAllReviews: async (req, res) => {
    try {
      const { status, page = 1, limit = 20, sortBy = "createdAt", order = "desc" } = req.query;

      const query = {};
      if (status) query.status = status;

      const skip = (page - 1) * limit;
      const sortOrder = order === "asc" ? 1 : -1;

      // Định nghĩa các trường sort hợp lệ
      let sortField = {};
      switch (sortBy) {
        case "rating":
          sortField = { rating: sortOrder };
          break;
        case "likes":
          // Sort theo số lượng likes (array length)
          sortField = { "likesCount": sortOrder };
          break;
        case "createdAt":
        default:
          sortField = { createdAt: sortOrder };
          break;
      }

      const reviews = await Review.find(query)
        .populate("user", "username email")
        .populate("product", "name image")
        .populate("reactions.user", "username email")
        .populate("replies.user", "username email")
        .populate("replies.mentionedUser", "username email")
        .populate("replies.reactions.user", "username email")
        .sort(sortField)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Review.countDocuments(query);

      res.status(200).json({
        success: true,
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching all reviews:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách đánh giá",
        error: error.message,
      });
    }
  },

  addReply: async (req, res) => {
    try {
      const { id } = req.params;
      const { comment, parentReplyId, mentionedUserId } = req.body;
      const userId = req.user.id;
      const currentUser = req.user || {};

      if (!comment || comment.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Nội dung trả lời không được để trống",
        });
      }

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      if (review.status === "hidden") {
        return res.status(400).json({
          success: false,
          message: "Không thể trả lời đánh giá đã bị ẩn",
        });
      }

      const userName = currentUser.username || currentUser.email || "User";

      review.replies.push({
        user: userId,
        userName,
        parentReply: parentReplyId || null,
        mentionedUser: mentionedUserId || null,
        mentionedUserName: "",
        comment: comment.trim(),
        likes: [],
        dislikes: [],
        reactions: [],
        status: "active",
        createdAt: new Date(),
      });

      await review.save();

      const updatedReview = await Review.findById(id)
        .populate("user", "username email")
        .populate("product", "name")
        .populate("reactions.user", "username email")
        .populate("replies.user", "username email")
        .populate("replies.mentionedUser", "username email")
        .populate("replies.reactions.user", "username email");

      // ===== NOTIFICATION =====
      
      // Thông báo cho chủ review
      if (updatedReview.user && updatedReview.user._id.toString() !== userId) {
        await notificationController.createNotification(
          updatedReview.user._id,
          "review_reply",
          "Phản hồi mới",
          `${userName} đã trả lời đánh giá của bạn về sản phẩm "${updatedReview.product.name}"`,
          review.replies[review.replies.length - 1]._id,
          `/product/detail/${updatedReview.product._id}`
        );
      }

      // Thông báo cho người được mention
      if (mentionedUserId && mentionedUserId.toString() !== userId && mentionedUserId.toString() !== updatedReview.user._id.toString()) {
        await notificationController.createNotification(
          mentionedUserId,
          "review_mention",
          "Được nhắc đến",
          `${userName} đã nhắc đến bạn trong một phản hồi đánh giá`,
          review.replies[review.replies.length - 1]._id,
          `/product/detail/${updatedReview.product._id}`
        );
      }

      res.status(200).json({
        success: true,
        message: "Đã trả lời đánh giá",
        review: updatedReview,
      });
    } catch (error) {
      console.error("Error adding reply:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi trả lời đánh giá",
        error: error.message,
      });
    }
  },

  deleteReply: async (req, res) => {
    try {
      const { id, replyId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const reply = review.replies.id(replyId);

      if (!reply) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy câu trả lời",
        });
      }

      // An toàn hơn với dữ liệu populate hoặc giá trị null
      const replyOwnerId = reply?.user?._id
        ? reply.user._id.toString()
        : reply?.user?.toString?.() || null;

      if (replyOwnerId && replyOwnerId !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xóa câu trả lời này",
        });
      }

      const targetId = replyId.toString();

      // 1) Xóa reply mục tiêu
      review.replies = review.replies.filter((r) => (r?._id?.toString?.() || "") !== targetId);

      // 2) Giữ lại reply con: đưa chúng thành reply gốc để vẫn hiển thị, giữ nguyên mention
      review.replies = review.replies.map((r) => {
        const parentId = r?.parentReply?.toString?.();
        if (parentId === targetId) {
          r.parentReply = null;
        }
        return r;
      });

      review.markModified("replies");
      const updatedReview = await review.save();

      res.status(200).json({
        success: true,
        message: "Đã xóa câu trả lời",
        review: updatedReview,
      });
    } catch (error) {
      console.error("Error deleting reply:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa câu trả lời",
        error: error.message,
      });
    }
  },

  updateReply: async (req, res) => {
    try {
      const { id, replyId } = req.params;
      const userId = req.user.id;
      const comment = (req.body?.comment || "").trim();
      if (!comment) {
        return res.status(400).json({ success: false, message: "Nội dung không được để trống" });
      }

      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
      }

      const reply = review.replies.id(replyId);
      if (!reply) {
        return res.status(404).json({ success: false, message: "Không tìm thấy trả lời" });
      }

      const isAdmin = req.user.admin === true;
      if (reply.user.toString() !== userId && !isAdmin) {
        return res.status(403).json({ success: false, message: "Không có quyền sửa trả lời này" });
      }

      reply.comment = comment;
      await review.save();

      const updatedReview = await Review.findById(id)
        .populate("user", "username email")
        .populate("product", "name")
        .populate("reactions.user", "username email")
        .populate("replies.user", "username email")
        .populate("replies.mentionedUser", "username email")
        .populate("replies.reactions.user", "username email");

      return res.status(200).json({
        success: true,
        review: updatedReview,
        reply: updatedReview.replies.id(replyId),
        message: "Đã cập nhật trả lời",
      });
    } catch (error) {
      console.error("Error updating reply:", error);
      return res.status(500).json({ success: false, message: "Lỗi khi cập nhật trả lời" });
    }
  },

  toggleLikeReply: async (req, res) => {
    try {
      const { id, replyId } = req.params;
      const userId = req.user.id;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const reply = review.replies.id(replyId);

      if (!reply) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy câu trả lời",
        });
      }

      const likeIndex = reply.likes.indexOf(userId);
      const dislikeIndex = reply.dislikes.indexOf(userId);

      // Xóa dislike nếu có
      if (dislikeIndex > -1) {
        reply.dislikes.splice(dislikeIndex, 1);
      }

      if (likeIndex > -1) {
        reply.likes.splice(likeIndex, 1);
      } else {
        reply.likes.push(userId);
      }

      await review.save();

      res.status(200).json({
        success: true,
        message: likeIndex > -1 ? "Đã bỏ thích" : "Đã thích",
        likes: reply.likes.length,
        dislikes: reply.dislikes.length,
      });
    } catch (error) {
      console.error("Error toggling like on reply:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi thích/bỏ thích câu trả lời",
        error: error.message,
      });
    }
  },

  toggleDislikeReply: async (req, res) => {
    try {
      const { id, replyId } = req.params;
      const userId = req.user.id;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const reply = review.replies.id(replyId);

      if (!reply) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy câu trả lời",
        });
      }

      const likeIndex = reply.likes.indexOf(userId);
      const dislikeIndex = reply.dislikes.indexOf(userId);

      // Xóa like nếu có
      if (likeIndex > -1) {
        reply.likes.splice(likeIndex, 1);
      }

      if (dislikeIndex > -1) {
        reply.dislikes.splice(dislikeIndex, 1);
      } else {
        reply.dislikes.push(userId);
      }

      await review.save();

      res.status(200).json({
        success: true,
        message: dislikeIndex > -1 ? "Đã bỏ không thích" : "Đã không thích",
        likes: reply.likes.length,
        dislikes: reply.dislikes.length,
      });
    } catch (error) {
      console.error("Error toggling dislike on reply:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi không thích/bỏ không thích câu trả lời",
        error: error.message,
      });
    }
  },

  removeReactionFromReply: async (req, res) => {
    try {
      const { id, replyId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const reply = review.replies.id(replyId);

      if (!reply) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy câu trả lời",
        });
      }

      // Tìm reaction của user
      const reaction = reply.reactions.find(r => r.user.toString() === userId);

      if (!reaction && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xóa reaction này",
        });
      }

      // Admin có thể xóa reaction của bất kỳ ai
      if (isAdmin) {
        const targetUserId = req.query.targetUserId || userId;
        reply.reactions = reply.reactions.filter(
          r => r.user.toString() !== targetUserId
        );
      } else {
        reply.reactions = reply.reactions.filter(
          r => r.user.toString() !== userId
        );
      }

      await review.save();

      const populatedReview = await Review.findById(id)
        .populate('replies.user', 'username email')
        .populate('replies.reactions.user', 'username email');

      const populatedReply = populatedReview.replies.id(replyId);

      res.status(200).json({
        success: true,
        message: "Đã xóa reaction",
        reactions: populatedReply.reactions,
      });
    } catch (error) {
      console.error("Error removing reaction from reply:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa reaction",
        error: error.message,
      });
    }
  },

  addReactionToReply: async (req, res) => {
    try {
      const { id, replyId } = req.params;
      const { icon, comment } = req.body;
      const userId = req.user.id;

      const review = await Review.findById(id).populate('replies.user', 'username email');

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const reply = review.replies.id(replyId);

      if (!reply) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy câu trả lời",
        });
      }

      // Xóa reaction cũ của user
      reply.reactions = reply.reactions.filter(
        r => r.user.toString() !== userId
      );

      // Thêm reaction mới với comment (optional)
      reply.reactions.push({
        user: userId,
        icon: icon,
        comment: comment || "",
        createdAt: new Date(),
      });

      await review.save();

      // Populate reactions + product
      const updatedReview = await Review.findById(id)
        .populate('product', 'name')
        .populate('replies.user', 'username email')
        .populate('replies.reactions.user', 'username email');

      const updatedReply = updatedReview.replies.id(replyId);

      // ===== NOTIFICATION =====
      const userName = req.user.username || req.user.email;
      if (reply.user && reply.user._id && reply.user._id.toString() !== userId) {
        const reactionLabel = icon === 'like' ? 'thích' : icon === 'love' ? 'yêu thích' : icon;
        await notificationController.createNotification(
          reply.user._id,
          "reply_reaction",
          "Cảm xúc mới",
          `${userName} đã thả ${reactionLabel} vào phản hồi của bạn`,
          replyId,
          `/product/detail/${updatedReview.product._id}`
        );
      }

      res.status(200).json({
        success: true,
        message: "Đã thêm reaction",
        reactions: updatedReply.reactions,
      });
    } catch (error) {
      console.error("Error adding reaction to reply:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi thêm reaction",
        error: error.message,
      });
    }
  },

  hideReply: async (req, res) => {
    try {
      const { id, replyId } = req.params;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const reply = review.replies.id(replyId);

      if (!reply) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy câu trả lời",
        });
      }

      reply.status = "hidden";
      await review.save();

      res.status(200).json({
        success: true,
        message: "Đã ẩn câu trả lời",
      });
    } catch (error) {
      console.error("Error hiding reply:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi ẩn câu trả lời",
        error: error.message,
      });
    }
  },

  showReply: async (req, res) => {
    try {
      const { id, replyId } = req.params;

      const review = await Review.findById(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đánh giá",
        });
      }

      const reply = review.replies.id(replyId);

      if (!reply) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy câu trả lời",
        });
      }

      reply.status = "active";
      await review.save();

      res.status(200).json({
        success: true,
        message: "Đã hiển thị câu trả lời",
      });
    } catch (error) {
      console.error("Error showing reply:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi hiển thị câu trả lời",
        error: error.message,
      });
    }
  },
};

async function updateProductRating(productId) {
  try {
    const mongoose = require('mongoose');
    const productObjectId = new mongoose.Types.ObjectId(productId);
    
    const stats = await Review.aggregate([
      { $match: { product: productObjectId, status: "active" } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const product = await Product.findById(productId);
    if (product) {
      product.rating = stats[0]?.averageRating || 0;
      product.reviewCount = stats[0]?.totalReviews || 0;
      await product.save();
    }
    
    console.log("📊 Updated product rating:", {
      productId,
      rating: product?.rating,
      reviewCount: product?.reviewCount
    });
  } catch (error) {
    console.error("Error updating product rating:", error);
  }
}

module.exports = reviewController;
