const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    userHearted: { type: Boolean, default: false },
    adminHearted: { type: Boolean, default: false },
  },
  { _id: false }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderType: { type: String, enum: ["user", "admin"], required: true },
    content: { type: String, required: true, trim: true },
    deletedByUser: { type: Boolean, default: false },
    deletedByAdmin: { type: Boolean, default: false },
    reactions: { type: reactionSchema, default: () => ({}) },
    fullyRemoved: { type: Boolean, default: false },
    removedAt: { type: Date, default: null },
    isPlaceholder: { type: Boolean, default: false },
    placeholderText: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
