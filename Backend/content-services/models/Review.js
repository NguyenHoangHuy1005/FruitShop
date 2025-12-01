const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxLength: 1000,
    },
    images: [{
      type: String,
    }],
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
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      userName: {
        type: String,
        default: "",
        trim: true,
      },
      parentReply: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      mentionedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      mentionedUserName: {
        type: String,
        default: "",
        trim: true,
      },
      comment: {
        type: String,
        required: true,
        trim: true,
        maxLength: 500,
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

reviewSchema.index({ product: 1, user: 1, order: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1 });
reviewSchema.index({ user: 1 });

module.exports = mongoose.model("Review", reviewSchema);
