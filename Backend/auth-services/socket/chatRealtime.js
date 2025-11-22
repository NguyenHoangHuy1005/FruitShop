const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const { formatChatMessage } = require("../utils/chatFormatter");
const {
  emitChatMessageCreated,
  emitChatMessageUpdated,
  emitChatMessageRemoved,
  emitConversationUpdate,
} = require("./chatEvents");

const toObjectId = (raw) => {
  if (!raw) return null;
  if (raw instanceof mongoose.Types.ObjectId) return raw;
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return null;
};

const buildConversationSnapshot = async (userId) => {
  const objectId = toObjectId(userId);
  if (!objectId) return null;

  const latest = await ChatMessage.findOne({ userId: objectId })
    .sort({ createdAt: -1 })
    .lean();
  if (!latest) return null;

  const profile = await User.findById(objectId)
    .select("fullname username email")
    .lean();

  return {
    userId: objectId.toString(),
    fullname: profile?.fullname || "",
    username: profile?.username || "",
    email: profile?.email || "",
    lastMessageAt: latest.createdAt,
    lastSenderType: latest.senderType,
    lastContent: latest.content,
  };
};

const emitConversationSnapshotForUser = async (userId) => {
  const snapshot = await buildConversationSnapshot(userId);
  if (snapshot) {
    emitConversationUpdate(snapshot);
  }
};

const broadcastNewChatMessage = async (doc) => {
  if (!doc) return;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const formatted = formatChatMessage(plain);
  const userId = plain.userId;
  emitChatMessageCreated(userId, formatted);
  await emitConversationSnapshotForUser(userId);
};

const broadcastMessageUpdated = async (doc) => {
  if (!doc) return;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const formatted = formatChatMessage(plain);
  emitChatMessageUpdated(plain.userId, formatted);
  await emitConversationSnapshotForUser(plain.userId);
};

const broadcastMessageRemoved = async (userId, targetId) => {
  if (!userId || !targetId) return;
  emitChatMessageRemoved(userId, targetId);
  await emitConversationSnapshotForUser(userId);
};

module.exports = {
  broadcastNewChatMessage,
  emitConversationSnapshotForUser,
  buildConversationSnapshot,
  broadcastMessageUpdated,
  broadcastMessageRemoved,
};
