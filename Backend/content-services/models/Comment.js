const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxLength: 500,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    mentionedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    dislikes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      default: "",
      maxLength: 200,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
    status: {
      type: String,
      enum: ["active", "hidden"],
      default: "active",
    },
    adminNote: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ article: 1, status: 1, createdAt: -1 });
commentSchema.index({ user: 1 });
commentSchema.index({ parentComment: 1 });

module.exports = mongoose.model("Comment", commentSchema);
