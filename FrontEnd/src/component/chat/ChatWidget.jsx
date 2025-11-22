import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { FiMessageCircle } from "react-icons/fi";
import { io } from "socket.io-client";
import { API } from "../redux/apiRequest";
import ChatWindow from "./ChatWindow";
import "./chatWidget.scss";

const buildSeenKey = (isAdmin, targetId) =>
  `${isAdmin ? "CHAT_SEEN_ADMIN" : "CHAT_SEEN_USER"}:${targetId || "self"}`;

const getSocketBaseUrl = () => {
  const apiBase = import.meta?.env?.VITE_API_BASE || "http://localhost:3000/api";
  return apiBase.replace(/\/api\/?$/, "");
};

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
  const [socketConnected, setSocketConnected] = useState(false);

  const latestSeenRef = useRef({});
  const socketRef = useRef(null);
  const viewerIdRef = useRef(viewerId);
  const selectedUserRef = useRef(selectedUserId);
  const isAdminRef = useRef(isAdmin);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    viewerIdRef.current = viewerId;
  }, [viewerId]);

  useEffect(() => {
    selectedUserRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const markConversationSeen = useCallback((targetKey, timestampMs) => {
    if (!targetKey || !timestampMs) return;
    latestSeenRef.current[targetKey] = timestampMs;
    writeSeenTimestamp(buildSeenKey(isAdminRef.current, targetKey), timestampMs);
  }, []);

  const markConversationReadLocally = useCallback((userId) => {
    if (!userId || !isAdminRef.current) return;
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
        setUnreadCount(next.filter((item) => item.hasUnread).length);
      }
      return next;
    });
  }, []);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocketConnected(false);
  }, []);

  const resetChatState = useCallback(() => {
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
    disconnectSocket();
  }, [disconnectSocket]);

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
  }, [currentUser, isAdmin, viewerId, resetChatState]);

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
        const seenMs =
          latestSeenRef.current[item.userId] ||
          readSeenTimestamp(buildSeenKey(true, item.userId));
        const hasUnread =
          !!(msgTime && item.lastSenderType === "user" && msgTime > (seenMs || 0));
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
  }, [currentUser, isAdmin, socketConnected, fetchConversations]);

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

        if (newIncoming > 0 && !isAdmin) {
          setUnreadCount(newIncoming);
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
  }, [currentUser, isAdmin, selectedUserId, fetchMessages]);

  useEffect(() => {
    if (!currentUser) return;
    if (!isOpen) return;
    if (isAdmin && !selectedUserId) return;
    fetchMessages(false);
  }, [isOpen, currentUser, isAdmin, selectedUserId, fetchMessages]);

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
    markConversationReadLocally,
  ]);

  const handleSocketMessage = useCallback(
    (payload = {}) => {
      const { userId: rawUserId, message, event = "created", targetId } = payload;
      if (!rawUserId) return;
      const normalized = rawUserId.toString();
      const adminMode = isAdminRef.current;
      const selectedCurrent = selectedUserRef.current;
      const viewerCurrent = viewerIdRef.current;
      const panelOpen = isOpenRef.current;

      if (!adminMode && normalized !== viewerCurrent) return;

      const messageId = message?.id || message?._id;
      const matchesActiveConversation = !adminMode
        ? true
        : !!selectedCurrent && normalized === selectedCurrent;

      const appendMessage = (incoming) => {
        if (!incoming) return;
        const newId = incoming.id || incoming._id;
        setMessages((prev) => {
          if (newId && prev.some((msg) => (msg.id || msg._id) === newId)) {
            return prev;
          }
          return [...prev, incoming];
        });
      };

      const updateMessage = (incoming) => {
        if (!incoming) return;
        const newId = incoming.id || incoming._id;
        if (!newId) return;
        setMessages((prev) =>
          prev.map((msg) => ((msg.id || msg._id) === newId ? incoming : msg))
        );
      };

      const removeMessage = (id) => {
        if (!id) return;
        setMessages((prev) => prev.filter((msg) => (msg.id || msg._id) !== id));
      };

      if (event === "removed") {
        if (!matchesActiveConversation) return;
        const removalId = targetId || messageId;
        removeMessage(removalId);
        return;
      }

      if (event === "updated") {
        if (!matchesActiveConversation) return;
        updateMessage(message);
        return;
      }

      // Default: created/new message
      if (!matchesActiveConversation && adminMode) {
        return;
      }

      const isIncomingForUser = !adminMode && message?.senderType === "admin";
      appendMessage(message);

      if (panelOpen && matchesActiveConversation) {
        const ts = message?.createdAt ? new Date(message.createdAt).getTime() : Date.now();
        if (ts) {
          const seenKey = adminMode ? normalized : viewerCurrent || "self";
          markConversationSeen(seenKey, ts);
        }
        if (adminMode) {
          markConversationReadLocally(normalized);
        } else if (isIncomingForUser) {
          setUnreadCount(0);
        }
      } else if (!adminMode && isIncomingForUser) {
        setUnreadCount((prev) => prev + 1);
      }
    },
    [markConversationReadLocally, markConversationSeen]
  );

  const handleConversationEvent = useCallback((payload = {}) => {
    if (!isAdminRef.current) return;
    if (!payload.userId) return;
    const normalized = payload.userId.toString();
    const skipUnread =
      isOpenRef.current && selectedUserRef.current === normalized;
    const messageTs = payload.lastMessageAt
      ? new Date(payload.lastMessageAt).getTime()
      : 0;
    const baseline =
      latestSeenRef.current[normalized] ||
      readSeenTimestamp(buildSeenKey(true, normalized)) ||
      0;
    const hasUnread =
      payload.lastSenderType === "user" &&
      messageTs > baseline &&
      !skipUnread;

    setConversations((prev) => {
      let exists = false;
      const next = prev.map((item) => {
        if (item.userId === normalized) {
          exists = true;
          return { ...item, ...payload, hasUnread };
        }
        return item;
      });
      if (!exists) {
        next.unshift({ ...payload, hasUnread });
      }
      setUnreadCount(next.filter((item) => item.hasUnread).length);
      return next;
    });
  }, []);

  useEffect(() => {
    const token = currentUser?.accessToken;
    if (!currentUser || !token) {
      disconnectSocket();
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = socket;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    const handleError = (err) => {
      console.error("chat socket error:", err?.message || err);
      setErrorText("Không thể kết nối realtime");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message", handleSocketMessage);
    socket.on("chat:conversation", handleConversationEvent);
    socket.on("connect_error", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message", handleSocketMessage);
      socket.off("chat:conversation", handleConversationEvent);
      socket.off("connect_error", handleError);
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [currentUser, handleConversationEvent, handleSocketMessage, disconnectSocket]);

  const sendMessageViaSocket = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return Promise.reject(new Error("Socket chưa kết nối"));
    }
    return new Promise((resolve, reject) => {
      socket.emit("chat:send", payload, (response) => {
        if (response?.ok) {
          resolve(response.message);
        } else {
          reject(new Error(response?.message || "Gửi thất bại"));
        }
      });
    });
  }, []);

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
      let usedSocket = false;
      let newMessage = null;
      try {
        await sendMessageViaSocket({
          content: inputValue.trim(),
          userId: isAdmin ? targetUserId : undefined,
        });
        usedSocket = true;
      } catch {
        const response = await API.post("/chat", {
          content: inputValue.trim(),
          ...(isAdmin ? { userId: targetUserId } : {}),
        });
        newMessage = response.data?.message;
      }

      if (!usedSocket && newMessage) {
        setMessages((prev) => [...prev, newMessage]);
        const createdMs = newMessage.createdAt
          ? new Date(newMessage.createdAt).getTime()
          : Date.now();
        markConversationSeen(seenKey, createdMs);
      }
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
    if (userId) {
      markConversationReadLocally(userId);
    }
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
