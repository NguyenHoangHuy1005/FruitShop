import { FiHeart, FiTrash2 } from "react-icons/fi";

// component nay to mau tung tin nhan va action
const MessageItem = ({ message, onReact, onDelete, viewerType = "user" }) => {
  const isSelf = message.senderType === viewerType;
  const messageId = message.id || message._id;
  const isPlaceholder = !!message.isPlaceholder;
  const displayText = isPlaceholder
    ? message.placeholderText || "Tin nhan da bi xoa"
    : message.content;
  const heartCount =
    (message.reactions?.userHearted ? 1 : 0) +
    (message.reactions?.adminHearted ? 1 : 0);
  const heartActive =
    viewerType === "admin"
      ? message.reactions?.adminHearted
      : message.reactions?.userHearted;
  const canReact = !isPlaceholder;
  const canDelete = isSelf && !isPlaceholder;
  const timestamp = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const senderLabel = message.senderType === "user" ? "User" : "Admin";

  return (
    <div className={`chat-message-row ${isSelf ? "is-user" : "is-admin"}`}>
      <div className="chat-message-bubble">
        <div className="chat-message-meta">
          <span className="chat-message-sender">{senderLabel}</span>
          <span className="chat-message-time">{timestamp}</span>
        </div>
        <p className={`chat-message-text ${isPlaceholder ? "is-placeholder" : ""}`}>
          {displayText}
        </p>
        <div className="chat-message-actions">
          <button
            type="button"
            className={`chat-icon-button ${heartActive ? "is-active" : ""}`}
            onClick={() => onReact(messageId)}
            title="Heart"
            disabled={!canReact}
          >
            <FiHeart size={14} />
            {heartCount > 0 && <span className="chat-heart-count">{heartCount}</span>}
          </button>
          {canDelete && (
            <button
              type="button"
              className="chat-icon-button"
              onClick={() => onDelete(messageId)}
              title="Delete"
            >
              <FiTrash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
