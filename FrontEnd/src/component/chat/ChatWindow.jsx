import { FiArrowLeft, FiSend, FiSmile, FiTrash2, FiX } from "react-icons/fi";
import MessageList from "./MessageList";
import EmojiPicker from "./EmojiPicker";

// component nay hien thi cua so chat chinh
const ChatWindow = ({
  messages,
  loading,
  inputValue,
  onInputChange,
  onSend,
  onClose,
  onReact,
  onDelete,
  onClear,
  sending,
  errorText,
  isEmojiOpen,
  toggleEmoji,
  onEmojiSelect,
  isAdmin,
  conversations = [],
  selectedUserId,
  onSelectConversation,
  conversationError,
  viewerType,
  onClearConversation,
  canClearFromHeader = true,
  activeConversation,
}) => {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const disableSend = sending || !inputValue.trim();
  const missingSelection = isAdmin && !selectedUserId;

  const renderConversationList = () => (
    <div className="chat-admin-list-view">
      <p className="chat-admin-label">Chọn người dùng</p>
      <div className="chat-admin-convo-list">
        {conversations.length ? (
          conversations.map((item) => {
            const name =
              item.fullname || item.username || item.email || `User ${item.userId?.slice(-6)}`;
            const timeText = item.lastMessageAt
              ? new Date(item.lastMessageAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const isActive = item.userId === selectedUserId;
            return (
              <div
                key={item.userId}
                role="button"
                tabIndex={0}
                className={`chat-admin-convo ${isActive ? "is-active" : ""}`}
                onClick={() => onSelectConversation?.(item.userId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSelectConversation?.(item.userId);
                  }
                }}
              >
                <div className="chat-admin-convo-header">
                  <div className="chat-admin-convo-title">
                    <span className="chat-admin-convo-name">{name}</span>
                    {item.hasUnread && <span className="chat-admin-convo-unread-dot" />}
                  </div>
                  <button
                    type="button"
                    className="chat-admin-convo-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onClearConversation?.(item.userId);
                    }}
                    title="Xóa toàn bộ đoạn chat"
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
                <span className="chat-admin-convo-meta">
                  {item.lastSenderType === "user" ? "User" : "Admin"} - {timeText}
                </span>
                <span className="chat-admin-convo-snippet">
                  {item.lastContent || "Chưa có tin nhắn"}
                </span>
              </div>
            );
          })
        ) : (
          <div className="chat-empty">Chưa có tin từ người dùng</div>
        )}
      </div>
      {conversationError && <div className="chat-error">{conversationError}</div>}
    </div>
  );

  const conversationDisplayName =
    activeConversation?.fullname ||
    activeConversation?.username ||
    activeConversation?.email ||
    (selectedUserId ? `User ${selectedUserId.slice(-6)}` : "");

  const renderChatArea = () => (
    <>
      <div className="chat-window-body">
        {isAdmin && selectedUserId && (
          <div className="chat-active-user-banner">
            {conversationDisplayName}
          </div>
        )}
        {loading ? (
          <div className="chat-empty">Đang tải...</div>
        ) : messages.length ? (
          <MessageList
            messages={messages}
            onReact={onReact}
            onDelete={onDelete}
            viewerType={viewerType}
          />
        ) : (
          <div className="chat-empty">Chưa có tin nhắn</div>
        )}
        {errorText && <div className="chat-error">{errorText}</div>}
      </div>

      <div className="chat-window-footer">
        <div className="chat-input-wrapper">
          <button
            type="button"
            className={`chat-icon-button ${isEmojiOpen ? "is-active" : ""}`}
            onClick={toggleEmoji}
            title="Emoji"
          >
            <FiSmile size={18} />
          </button>
          {isEmojiOpen && <EmojiPicker onSelect={onEmojiSelect} />}
          <textarea
            rows={2}
            value={inputValue}
            placeholder="Nhập tin nhắn..."
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          type="button"
          className="chat-send-button"
          onClick={onSend}
          disabled={disableSend}
        >
          {sending ? (
            "Đang gửi..."
          ) : (
            <>
              Gửi <FiSend size={16} />
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-window-title">
          {isAdmin && selectedUserId && (
            <button
              type="button"
              className="chat-back-button"
              onClick={() => onSelectConversation?.(null)}
              title="Quay lại danh sách"
            >
              <FiArrowLeft size={16} />
            </button>
          )}
          <div>
            <p>Hỗ trợ | Chat với Admin</p>
            <span>Hỗ trợ trực tuyến</span>
          </div>
        </div>
        <div className="chat-window-header-actions">
          {canClearFromHeader && (
            <button
              type="button"
              className="chat-icon-button chat-icon-danger"
              onClick={onClear}
              title="Clear"
              disabled={!messages.length}
            >
              <FiTrash2 size={16} />
            </button>
          )}
          <button
            type="button"
            className="chat-icon-button"
            onClick={onClose}
            title="Close"
          >
            <FiX size={18} />
          </button>
        </div>
      </div>

      <div className="chat-window-content">
        {isAdmin && !selectedUserId ? renderConversationList() : renderChatArea()}
      </div>
    </div>
  );
};

export default ChatWindow;
