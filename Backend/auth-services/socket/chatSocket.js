const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const { setChatIO, CHAT_ADMIN_ROOM, ORDER_ADMIN_ROOM, ORDER_SHIPPER_ROOM, buildUserRoomName } = require("./chatEvents");
const { broadcastNewChatMessage } = require("./chatRealtime");
const { formatChatMessage } = require("../utils/chatFormatter");

const JWT_SECRET = process.env.JWT_ACCESS_KEY || process.env.JWT_SECRET;

const toObjectId = (raw) => {
  if (!raw) return null;
  if (raw instanceof mongoose.Types.ObjectId) return raw;
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return null;
};

const normalizeToken = (raw = "") => {
  if (!raw) return "";
  const trimmed = raw.trim();
  return trimmed.toLowerCase().startsWith("bearer ")
    ? trimmed.slice(7).trim()
    : trimmed;
};

const registerChatSockets = (io) => {
  if (!JWT_SECRET) {
    console.warn("[socket] JWT secret missing, chat socket disabled");
    return;
  }

  setChatIO(io);

  io.use((socket, next) => {
    try {
      const authToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.headers?.token;
      const token = normalizeToken(authToken);
      if (!token) {
        return next(new Error("unauthorized"));
      }
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = {
        id: payload?.id || payload?._id,
        admin: !!(payload?.admin || payload?.isAdmin),
        username: payload?.username,
        email: payload?.email,
      };
      return next();
    } catch (err) {
      console.error("[socket] auth error:", err.message);
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user?.id;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    try {
      const existing = await User.findById(userId).select("shipper roles admin isAdmin").lean();
      if (existing) {
        const hasShipper = !!(existing.shipper || (Array.isArray(existing.roles) && existing.roles.includes("shipper")));
        socket.user.shipper = socket.user.shipper || hasShipper;
        socket.user.admin =
          socket.user.admin || !!(existing.admin || existing.isAdmin);
      }
    } catch (err) {
      console.error("[socket] failed to lookup user role:", err?.message || err);
    }

    if (socket.user?.admin) {
      socket.join(CHAT_ADMIN_ROOM);
      socket.join(ORDER_ADMIN_ROOM);
    } else {
      socket.join(buildUserRoomName(userId));
      if (socket.user?.shipper) {
        socket.join(ORDER_SHIPPER_ROOM);
      }
    }

    socket.on("chat:send", async (payload = {}, callback = () => {}) => {
      try {
        const content = (payload.content || "").toString().trim();
        if (!content) {
          return callback({ ok: false, message: "Nội dung là bắt buộc" });
        }

        const targetId = socket.user?.admin ? payload.userId : userId;
        const targetObjectId = toObjectId(targetId);
        if (!targetObjectId) {
          return callback({ ok: false, message: "Thiếu người nhận tin nhắn" });
        }

        if (socket.user?.admin && !payload.userId) {
          return callback({ ok: false, message: "Cần chọn người dùng để gửi tin" });
        }

        const doc = await ChatMessage.create({
          userId: targetObjectId,
          senderType: socket.user?.admin ? "admin" : "user",
          content,
          deletedByAdmin: false,
          deletedByUser: false,
          reactions: { userHearted: false, adminHearted: false },
          fullyRemoved: false,
          removedAt: null,
          isPlaceholder: false,
          placeholderText: "",
        });

        await broadcastNewChatMessage(doc);
        callback({ ok: true, message: formatChatMessage(doc) });
      } catch (err) {
        console.error("[socket] send error:", err);
        callback({ ok: false, message: "Gửi tin nhắn thất bại" });
      }
    });

    socket.on("disconnect", () => {
      // no-op, but kept for future hooks
    });
  });
};

module.exports = { registerChatSockets };
