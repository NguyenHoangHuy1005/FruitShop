const CHAT_ADMIN_ROOM = "chat-admins";
const ORDER_ADMIN_ROOM = "order-admins";
const ORDER_SHIPPER_ROOM = "order-shippers";

const buildUserRoomName = (userId) => {
  const id = typeof userId === "string" ? userId : userId?.toString?.() || "";
  return `chat-user:${id}`;
};

let ioRef = null;

const setChatIO = (io) => {
  ioRef = io;
};

const emitChatPayload = (payload = {}) => {
  if (!ioRef || !payload?.userId) return;
  const roomId =
    typeof payload.userId === "string"
      ? payload.userId
      : payload.userId?.toString?.();
  if (!roomId) return;
  ioRef.to(buildUserRoomName(roomId)).emit("chat:message", payload);
  ioRef.to(CHAT_ADMIN_ROOM).emit("chat:message", payload);
};

const emitChatMessageCreated = (userId, message) => {
  if (!message) return;
  emitChatPayload({
    userId: typeof userId === "string" ? userId : userId?.toString?.(),
    event: "created",
    message,
  });
};

const emitChatMessageUpdated = (userId, message) => {
  if (!message) return;
  emitChatPayload({
    userId: typeof userId === "string" ? userId : userId?.toString?.(),
    event: "updated",
    message,
  });
};

const emitChatMessageRemoved = (userId, targetId) => {
  if (!targetId) return;
  emitChatPayload({
    userId: typeof userId === "string" ? userId : userId?.toString?.(),
    event: "removed",
    targetId: typeof targetId === "string" ? targetId : targetId?.toString?.(),
  });
};

const emitConversationUpdate = (summary) => {
  if (!ioRef || !summary?.userId) return;
  ioRef.to(CHAT_ADMIN_ROOM).emit("chat:conversation", summary);
};

const emitOrderUpdate = ({ order, userId, shipperId, event = "updated" }) => {
  if (!ioRef || !order) return;
  const payload = { event, order };
  const targetRooms = new Set();

  if (userId) {
    targetRooms.add(buildUserRoomName(userId));
  }
  if (shipperId) {
    targetRooms.add(buildUserRoomName(shipperId));
  }

  targetRooms.forEach((room) => {
    ioRef.to(room).emit("order:update", payload);
  });
  ioRef.to(ORDER_ADMIN_ROOM).emit("order:update", payload);
  ioRef.to(ORDER_SHIPPER_ROOM).emit("order:update", payload);
};

module.exports = {
  CHAT_ADMIN_ROOM,
  ORDER_ADMIN_ROOM,
  ORDER_SHIPPER_ROOM,
  buildUserRoomName,
  setChatIO,
  emitChatMessageCreated,
  emitChatMessageUpdated,
  emitChatMessageRemoved,
  emitConversationUpdate,
  emitOrderUpdate,
};
