const formatChatMessage = (doc = {}) => ({
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

module.exports = { formatChatMessage };
