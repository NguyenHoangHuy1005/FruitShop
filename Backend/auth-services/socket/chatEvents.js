const CHAT_ADMIN_ROOM = "chat-admins";

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

module.exports = {
  CHAT_ADMIN_ROOM,
  buildUserRoomName,
  setChatIO,
  emitChatMessageCreated,
  emitChatMessageUpdated,
  emitChatMessageRemoved,
  emitConversationUpdate,
};
