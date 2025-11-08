const Review = require("../models/Review");
const Order = require("../../product-services/models/Order");
const Product = require("../../product-services/models/Product");

const reviewController = {
  createReview: async (req, res) => {
    try {
      const { productId, orderId, rating, comment, images } = req.body;
      const userId = req.user.id;

      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        status: "paid",
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
        status: "paid",
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
      const { status, page = 1, limit = 20 } = req.query;

      const query = {};
      if (status) query.status = status;

      const skip = (page - 1) * limit;

      const reviews = await Review.find(query)
        .populate("user", "username email")
        .populate("product", "name image")
        .sort({ createdAt: -1 })
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
