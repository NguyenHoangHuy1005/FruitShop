const mongoose = require("mongoose");

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      required: true,
      maxLength: 300,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Mẹo chọn hàng",
        "Công thức",
        "Dinh dưỡng",
        "Cảm hứng",
        "Tin tức",
        "Khác",
      ],
    },
    image: {
      type: String,
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    // Draft fields - lưu nội dung chỉnh sửa chờ duyệt
    hasPendingEdit: {
      type: Boolean,
      default: false,
    },
    draftTitle: {
      type: String,
      default: null,
    },
    draftContent: {
      type: String,
      default: null,
    },
    draftExcerpt: {
      type: String,
      default: null,
    },
    draftCategory: {
      type: String,
      default: null,
    },
    draftImage: {
      type: String,
      default: null,
    },
    draftReadTime: {
      type: String,
      default: null,
    },
    readTime: {
      type: String,
      default: "5 phút đọc",
    },
    views: {
      type: Number,
      default: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

articleSchema.index({ status: 1, createdAt: -1 });
articleSchema.index({ author: 1 });
articleSchema.index({ category: 1 });

module.exports = mongoose.model("Article", articleSchema);
