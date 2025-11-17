import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { FiMessageCircle } from "react-icons/fi";
import { API } from "../redux/apiRequest";
import ChatWindow from "./ChatWindow";
import "./chatWidget.scss";

const buildSeenKey = (isAdmin, targetId) =>
  `${isAdmin ? "CHAT_SEEN_ADMIN" : "CHAT_SEEN_USER"}:${targetId || "self"}`;

const readSeenTimestamp = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const num = parseInt(raw, 10);
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
};

const writeSeenTimestamp = (key, value) => {
  if (!value) return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
};

const clearSeenKey = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

// component nay quan ly trang thai chat va nut noi len
const ChatWidget = () => {
  const currentUser = useSelector((state) => state.auth?.login?.currentUser);
  const isAdmin = !!currentUser?.admin;
  const viewerId = currentUser?.id || currentUser?._id || null;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationError, setConversationError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const latestSeenRef = useRef({});

  const markConversationSeen = useCallback(
    (targetKey, timestampMs) => {
      if (!targetKey || !timestampMs) return;
      latestSeenRef.current[targetKey] = timestampMs;
      writeSeenTimestamp(buildSeenKey(isAdmin, targetKey), timestampMs);
    },
    [isAdmin]
  );

  const markConversationReadLocally = useCallback((userId) => {
    if (!userId) return;
    setConversations((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.userId === userId && item.hasUnread) {
          changed = true;
          return { ...item, hasUnread: false };
        }
        return item;
      });
      if (changed) {
        setUnreadCount((prevCount) => Math.max(0, prevCount - 1));
      }
      return next;
    });
  }, []);

  const resetChatState = () => {
    setMessages([]);
    setInputValue("");
    setIsOpen(false);
    setUnreadCount(0);
    setErrorText("");
    setConversations([]);
    setConversationError("");
    setSelectedUserId(null);
    setIsEmojiOpen(false);
    latestSeenRef.current = {};
  };

  useEffect(() => {
    if (!currentUser) {
      resetChatState();
      return;
    }
    if (isAdmin) {
      setSelectedUserId(null);
      return;
    }
    setSelectedUserId(viewerId || null);
  }, [currentUser, isAdmin, viewerId]);

  useEffect(() => {
    if (!isAdmin && viewerId) {
      const fallbackKey = buildSeenKey(false, "self");
      const userKey = buildSeenKey(false, viewerId);
      const fallbackValue = readSeenTimestamp(fallbackKey);
      const userValue = readSeenTimestamp(userKey);
      if (fallbackValue && (!userValue || fallbackValue > userValue)) {
        writeSeenTimestamp(userKey, fallbackValue);
        clearSeenKey(fallbackKey);
      }
      const finalValue = readSeenTimestamp(userKey);
      if (finalValue) {
        latestSeenRef.current[viewerId] = finalValue;
      }
      setUnreadCount(0);
    }
  }, [isAdmin, viewerId]);

  const fetchConversations = useCallback(async () => {
    if (!currentUser || !isAdmin) return;
    try {
      const response = await API.get("/chat/conversations");
      const list = response.data?.conversations || [];
      const enriched = list.map((item) => {
        const msgTime = item.lastMessageAt ? new Date(item.lastMessageAt).getTime() : 0;
        const seenMs = readSeenTimestamp(buildSeenKey(true, item.userId));
        const hasUnread = !!(msgTime && item.lastSenderType === "user" && msgTime > seenMs);
        return { ...item, hasUnread };
      });
      setConversations(enriched);
      setConversationError("");

      if (selectedUserId && !enriched.some((itm) => itm.userId === selectedUserId)) {
        setSelectedUserId(null);
        setMessages([]);
      }

      const totalUnread = enriched.reduce(
        (count, item) => (item.hasUnread ? count + 1 : count),
        0
      );
      setUnreadCount(totalUnread);
    } catch (err) {
      console.error("chat fetch conversation lỗi", err);
      setConversationError("Không tải được danh sách người dùng");
    }
  }, [currentUser, isAdmin, selectedUserId]);

  useEffect(() => {
    if (!currentUser || !isAdmin) return;
    fetchConversations();
    const interval = setInterval(fetchConversations, 8000);
    return () => clearInterval(interval);
  }, [currentUser, isAdmin, fetchConversations]);

  const fetchMessages = useCallback(
    async (withLoader = false) => {
      if (!currentUser) return;
      const targetUserId = isAdmin ? selectedUserId : viewerId;
      if (!targetUserId) return;
      const seenKey = isAdmin ? targetUserId : viewerId || "self";
      if (!seenKey) return;
      const storageKey = buildSeenKey(isAdmin, seenKey);
      const storedSeen = readSeenTimestamp(storageKey);
      if (!latestSeenRef.current[seenKey] && storedSeen) {
        latestSeenRef.current[seenKey] = storedSeen;
      }
      if (withLoader) setIsLoading(true);

      try {
        const response = await API.get("/chat", {
          params: isAdmin ? { userId: targetUserId } : undefined,
        });
        const fetched = response.data?.messages || [];
        setMessages(fetched);
        setErrorText("");

        if (!fetched.length) {
          latestSeenRef.current[seenKey] = storedSeen || 0;
          if (!isAdmin) setUnreadCount(0);
          return;
        }

        const newestTime = fetched[fetched.length - 1]?.createdAt;
        const newestMs = newestTime ? new Date(newestTime).getTime() : 0;

        if (isOpen && (!isAdmin || (isAdmin && selectedUserId === targetUserId))) {
          if (newestMs) {
            markConversationSeen(seenKey, newestMs);
          }
          if (!isAdmin) setUnreadCount(0);
          return;
        }

        const baseline = latestSeenRef.current[seenKey] || storedSeen || 0;
        const incomingType = isAdmin ? "user" : "admin";
        const newIncoming = fetched.filter((msg) => {
          if (msg.senderType !== incomingType) return false;
          const msgTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
          return msgTime > baseline;
        }).length;

        if (newIncoming > 0) {
          if (isAdmin) {
            setUnreadCount((prev) => prev + newIncoming);
          } else {
            setUnreadCount(newIncoming);
          }
        }
      } catch (err) {
        console.error("chat fetch lỗi", err);
        setErrorText("Chat hiện không khả dụng");
      } finally {
        if (withLoader) setIsLoading(false);
      }
    },
    [currentUser, isAdmin, selectedUserId, viewerId, isOpen, markConversationSeen]
  );

  useEffect(() => {
    if (!currentUser) return;
    if (isAdmin && !selectedUserId) return;
    fetchMessages(true);
    const interval = setInterval(() => {
      fetchMessages(false);
    }, isOpen ? 4000 : 8000);
    return () => clearInterval(interval);
  }, [currentUser, isAdmin, selectedUserId, isOpen, fetchMessages]);

  useEffect(() => {
    if (!isOpen || !messages.length) return;
    if (isAdmin && !selectedUserId) return;
    const seenKey = isAdmin ? selectedUserId : viewerId || "self";
    if (!seenKey) return;
    const newest = messages[messages.length - 1]?.createdAt;
    if (!newest) return;
    const newestMs = new Date(newest).getTime();
    if (!newestMs) return;
    markConversationSeen(seenKey, newestMs);
    if (isAdmin) {
      markConversationReadLocally(selectedUserId);
      fetchConversations();
    } else {
      setUnreadCount(0);
    }
  }, [
    isOpen,
    messages,
    isAdmin,
    selectedUserId,
    viewerId,
    markConversationSeen,
    fetchConversations,
    markConversationReadLocally,
  ]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next && messages.length) {
        const seenKey = isAdmin ? selectedUserId : viewerId || "self";
        const newest = messages[messages.length - 1]?.createdAt;
        const newestMs = newest ? new Date(newest).getTime() : 0;
        if (seenKey && newestMs) {
          markConversationSeen(seenKey, newestMs);
          if (isAdmin) {
            markConversationReadLocally(selectedUserId);
          }
          if (!isAdmin) setUnreadCount(0);
        }
      }
      if (next) {
        if (isAdmin) {
          setSelectedUserId(null);
          setMessages([]);
        }
      } else {
        setIsEmojiOpen(false);
        if (isAdmin) {
          setSelectedUserId(null);
          setMessages([]);
        }
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    const targetUserId = isAdmin ? selectedUserId : viewerId;
    if (!targetUserId) return;
    const seenKey = isAdmin ? targetUserId : viewerId || "self";
    setIsSending(true);
    try {
      const response = await API.post("/chat", {
        content: inputValue.trim(),
        ...(isAdmin ? { userId: targetUserId } : {}),
      });
      const newMessage = response.data?.message;
      if (newMessage) {
        setMessages((prev) => [...prev, newMessage]);
        const createdMs = newMessage.createdAt
          ? new Date(newMessage.createdAt).getTime()
          : Date.now();
        markConversationSeen(seenKey, createdMs);
      }
      if (isAdmin) fetchConversations();
      setInputValue("");
      setIsEmojiOpen(false);
      setErrorText("");
    } catch (err) {
      console.error("chat gửi lỗi", err);
      setErrorText("Không thể gửi tin nhắn");
    } finally {
      setIsSending(false);
    }
  };

  const handleReact = async (id) => {
    const targetUserId = isAdmin ? selectedUserId : viewerId;
    if (!targetUserId) return;
    try {
      const response = await API.post(`/chat/${id}/react`, {
        type: "heart",
        action: "toggle",
        ...(isAdmin ? { userId: targetUserId } : {}),
      });
      const updated = response.data?.message;
      if (updated) {
        const targetId = updated.id || updated._id;
        setMessages((prev) =>
          prev.map((msg) => {
            const currentId = msg.id || msg._id;
            return currentId === targetId ? updated : msg;
          })
        );
      }
    } catch (err) {
      console.error("chat reaction lỗi", err);
    }
  };

  const handleDelete = async (id) => {
    const targetUserId = isAdmin ? selectedUserId : viewerId;
    if (!targetUserId) return;
    try {
      const response = await API.delete(`/chat/${id}`, {
        params: isAdmin ? { userId: targetUserId } : undefined,
      });
      const removed = response.data?.removed;
      const updated = response.data?.message;
      if (removed) {
        setMessages((prev) =>
          prev.filter((msg) => {
            const currentId = msg.id || msg._id;
            return currentId !== (response.data?.targetId || id);
          })
        );
      } else if (updated) {
        setMessages((prev) =>
          prev.map((msg) => {
            const currentId = msg.id || msg._id;
            return currentId === updated.id ? updated : msg;
          })
        );
      }
      if (isAdmin) fetchConversations();
    } catch (err) {
      console.error("lỗi xóa đoạn chat", err);
    }
  };

  const handleClear = async () => {
    if (isAdmin) return;
    const seenKey = viewerId || "self";
    if (!seenKey) return;
    try {
      await API.delete("/chat");
      setMessages([]);
      const now = Date.now();
      markConversationSeen(seenKey, now);
      setUnreadCount(0);
    } catch (err) {
      console.error("chat clear lỗi", err);
    }
  };

  const handleClearConversation = async (userId) => {
    if (!isAdmin || !userId) return;
    try {
      await API.delete("/chat", {
        params: { userId },
      });
      if (selectedUserId === userId) {
        setMessages([]);
        markConversationSeen(userId, Date.now());
      }
      fetchConversations();
    } catch (err) {
      console.error("chat admin clear lỗi", err);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInputValue((prev) => `${prev}${emoji}`);
  };

  const handleSelectConversation = (userId) => {
    if (!isAdmin) return;
    setSelectedUserId(userId);
    setMessages([]);
    setUnreadCount(0);
    setErrorText("");
    setIsEmojiOpen(false);
  };

  if (!currentUser) {
    return null;
  }

  const unreadBadge = unreadCount > 0 ? (
    <span className="chat-widget-badge">{unreadCount}</span>
  ) : null;

  const activeConversation = isAdmin
    ? conversations.find((item) => item.userId === selectedUserId) || null
    : null;

  return (
    <div className="chat-widget-container">
      <button
        type="button"
        className={`chat-widget-button ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={handleToggle}
        aria-label="Support chat"
      >
        <FiMessageCircle size={22} />
        {unreadBadge}
      </button>

      {isOpen && (
        <ChatWindow
          messages={messages}
          loading={isLoading}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          onClose={() => setIsOpen(false)}
          onReact={handleReact}
          onDelete={handleDelete}
          onClear={handleClear}
          sending={isSending}
          errorText={errorText}
          isEmojiOpen={isEmojiOpen}
          toggleEmoji={() => setIsEmojiOpen((prev) => !prev)}
          onEmojiSelect={handleEmojiSelect}
          isAdmin={isAdmin}
          conversations={conversations}
          selectedUserId={selectedUserId}
          onSelectConversation={handleSelectConversation}
          conversationError={conversationError}
          viewerType={isAdmin ? "admin" : "user"}
          onClearConversation={handleClearConversation}
          canClearFromHeader={!isAdmin}
          activeConversation={activeConversation}
        />
      )}
    </div>
  );
};

export default ChatWidget;
