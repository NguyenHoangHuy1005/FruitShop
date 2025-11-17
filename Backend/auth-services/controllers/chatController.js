const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");

const toObjectId = (raw) => {
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const resolveConversationUserId = (req) => {
  if (req.user?.admin) {
    return req.query.userId || req.params?.userId || req.body?.userId || null;
  }
  return req.user?.id || null;
};

const canSeeMessage = (msg, isAdmin) =>
  !msg.fullyRemoved && (isAdmin ? !msg.deletedByAdmin : !msg.deletedByUser);

const formatMessage = (doc) => ({
  id: doc._id?.toString?.() || doc._id,
  userId: doc.userId?.toString?.() || doc.userId,
  senderType: doc.senderType,
  content: doc.content,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  deletedByUser: !!doc.deletedByUser,
  deletedByAdmin: !!doc.deletedByAdmin,
  isPlaceholder: !!doc.isPlaceholder,
  placeholderText: doc.placeholderText || "",
  reactions: {
    userHearted: !!doc.reactions?.userHearted,
    adminHearted: !!doc.reactions?.adminHearted,
  },
});

const getChatHistory = async (req, res) => {
  try {
    const rawUserId = resolveConversationUserId(req);
    const userObjectId = toObjectId(rawUserId);
    if (!userObjectId) {
      return res.status(400).json({ message: "Thiếu người dùng cuộc trò chuyện" });
    }

    const isAdmin = !!req.user?.admin;
    const records = await ChatMessage.find({ userId: userObjectId })
      .sort({ createdAt: 1 })
      .lean();

    const visible = records.filter((msg) => canSeeMessage(msg, isAdmin));
    return res.json({ messages: visible.map(formatMessage) });
  } catch (err) {
    console.error("[chat] loi getChatHistory:", err);
    return res.status(500).json({ message: "Lịch sử trò chuyện không khả dụng" });
  }
};

const postMessage = async (req, res) => {
  try {
    const rawUserId = resolveConversationUserId(req);
    const userObjectId = toObjectId(rawUserId);
    if (!userObjectId) {
      return res.status(400).json({ message: "Thiếu người dùng cuộc trò chuyện" });
    }

    const senderType = req.user?.admin ? "admin" : "user";
    const content =
      typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) {
      return res.status(400).json({ message: "Nội dung là bắt buộc" });
    }

    const payload = await ChatMessage.create({
      userId: userObjectId,
      senderType,
      content,
      deletedByUser: false,
      deletedByAdmin: false,
      reactions: { userHearted: false, adminHearted: false },
      fullyRemoved: false,
      removedAt: null,
      isPlaceholder: false,
      placeholderText: "",
    });

    return res.status(201).json({ message: formatMessage(payload) });
  } catch (err) {
    console.error("[chat] loi postMessage:", err);
    return res.status(500).json({ message: "Gửi tin nhắn thất bại" });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const rawUserId = resolveConversationUserId(req);
    const userObjectId = toObjectId(rawUserId);
    const rawMessageId = req.params?.id;
    if (!userObjectId || !rawMessageId || !mongoose.Types.ObjectId.isValid(rawMessageId)) {
      return res.status(400).json({ message: "Yêu cầu không hợp lệ" });
    }

    const isAdmin = !!req.user?.admin;
    const message = await ChatMessage.findOne({
      _id: rawMessageId,
      userId: userObjectId,
    });
    if (!message) {
      return res.status(404).json({ message: "Tin nhắn không tồn tại" });
    }

    const requesterId = req.user?.id;
    const ownsAsUser =
      !isAdmin &&
      message.senderType === "user" &&
      message.userId?.toString?.() === requesterId;
    const ownsAsAdmin = isAdmin && message.senderType === "admin";
    if (!ownsAsUser && !ownsAsAdmin) {
      return res.status(403).json({ message: "Không thể xóa tin nhắn này" });
    }

    if (message.fullyRemoved) {
      return res.json({ success: true, removed: true, targetId: rawMessageId });
    }

    const ageMs = Date.now() - new Date(message.createdAt).getTime();
    if (ageMs <= 60000) {
      message.fullyRemoved = true;
      message.removedAt = new Date();
      message.deletedByAdmin = true;
      message.deletedByUser = true;
      await message.save();
      return res.json({ success: true, removed: true, targetId: rawMessageId });
    }

    if (message.isPlaceholder) {
      return res.json({ success: true, message: formatMessage(message) });
    }

    message.isPlaceholder = true;
    message.placeholderText = "Tin nhắn đã bị xóa";
    message.content = message.placeholderText;
    message.reactions = { userHearted: false, adminHearted: false };
    await message.save();
    return res.json({ success: true, message: formatMessage(message) });
  } catch (err) {
    console.error("[chat] loi deleteMessage:", err);
    return res.status(500).json({ message: "Xóa tin nhắn thất bại" });
  }
};

const clearConversation = async (req, res) => {
  try {
    const rawUserId = resolveConversationUserId(req);
    const userObjectId = toObjectId(rawUserId);
    if (!userObjectId) {
      return res.status(400).json({ message: "Thiếu người dùng cuộc trò chuyện" });
    }

    const isAdmin = !!req.user?.admin;
    const update = isAdmin
      ? { deletedByAdmin: true }
      : { deletedByUser: true };

    const status = await ChatMessage.updateMany(
      { userId: userObjectId, ...(isAdmin ? { deletedByAdmin: false } : { deletedByUser: false }) },
      update
    );

    return res.json({ success: true, modified: status.modifiedCount });
  } catch (err) {
    console.error("[chat] loi clearConversation:", err);
    return res.status(500).json({ message: "Xóa cuộc trò chuyện thất bại" });
  }
};

const reactToMessage = async (req, res) => {
  try {
    const rawUserId = resolveConversationUserId(req);
    const userObjectId = toObjectId(rawUserId);
    const rawMessageId = req.params?.id;
    if (!userObjectId || !rawMessageId || !mongoose.Types.ObjectId.isValid(rawMessageId)) {
      return res.status(400).json({ message: "Yêu cầu không hợp lệ" });
    }

    const { type = "heart", action = "toggle" } = req.body || {};
    if (type !== "heart") {
      return res.status(400).json({ message: "Loại phản ứng không được hỗ trợ" });
    }

    const isAdmin = !!req.user?.admin;
    const message = await ChatMessage.findOne({
      _id: rawMessageId,
      userId: userObjectId,
    });
    if (!message) {
      return res.status(404).json({ message: "Tin nhắn không tồn tại" });
    }

    if (
      message.fullyRemoved ||
      message.isPlaceholder ||
      (isAdmin && message.deletedByAdmin) ||
      (!isAdmin && message.deletedByUser)
    ) {
      return res.status(404).json({ message: "Tin nhắn không hiển thị" });
    }

    if (!message.reactions) {
      message.reactions = { userHearted: false, adminHearted: false };
    }

    if (action === "toggle") {
      if (isAdmin) {
        message.reactions.adminHearted = !message.reactions.adminHearted;
      } else {
        message.reactions.userHearted = !message.reactions.userHearted;
      }
    } else if (action === "set") {
      const flag = !!req.body?.value;
      if (isAdmin) {
        message.reactions.adminHearted = flag;
      } else {
        message.reactions.userHearted = flag;
      }
    }

    await message.save();
    return res.json({ message: formatMessage(message) });
  } catch (err) {
    console.error("[chat] loi reactToMessage:", err);
    return res.status(500).json({ message: "Phản ứng với tin nhắn thất bại" });
  }
};

const getConversations = async (req, res) => {
  try {
    if (!req.user?.admin) {
      return res.status(403).json({ message: "Chỉ dành cho quản trị viên" });
    }

    const rows = await ChatMessage.aggregate([
      { $match: { deletedByAdmin: false, fullyRemoved: { $ne: true } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$userId",
          lastMessageAt: { $first: "$createdAt" },
          lastSenderType: { $first: "$senderType" },
          lastContent: { $first: "$content" },
        },
      },
      { $sort: { lastMessageAt: -1 } },
    ]);

    const ids = rows.map((row) => row._id).filter(Boolean);
    const users = ids.length
      ? await User.find({ _id: { $in: ids } })
          .select("fullname username email")
          .lean()
      : [];
    const userMap = {};
    users.forEach((itm) => {
      userMap[itm._id.toString()] = itm;
    });

    const conversations = rows.map((row) => {
      const key = row._id?.toString();
      const profile = userMap[key] || {};
      return {
        userId: key,
        fullname: profile.fullname || "",
        username: profile.username || "",
        email: profile.email || "",
        lastMessageAt: row.lastMessageAt,
        lastSenderType: row.lastSenderType,
        lastContent: row.lastContent,
      };
    });

    return res.json({ conversations });
  } catch (err) {
    console.error("[chat] loi getConversations:", err);
    return res.status(500).json({ message: "Lấy danh sách cuộc trò chuyện thất bại" });
  }
};

module.exports = {
  getChatHistory,
  postMessage,
  deleteMessage,
  clearConversation,
  reactToMessage,
  getConversations,
};
