import { useEffect, useRef } from "react";
import MessageItem from "./MessageItem";

// component nay dung de hien thi danh sach tin nhan
const MessageList = ({ messages, onReact, onDelete, viewerType = "user" }) => {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-message-list" ref={listRef}>
      {messages.map((message) => (
        <MessageItem
          key={message.id || message._id}
          message={message}
          onReact={onReact}
          onDelete={onDelete}
          viewerType={viewerType}
        />
      ))}
    </div>
  );
};

export default MessageList;
