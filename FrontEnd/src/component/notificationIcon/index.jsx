import React, { memo, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { API } from "../redux/apiRequest";
import { AiFillBell } from "react-icons/ai";
import "./style.scss";

const NotificationIcon = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth?.login?.currentUser);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    const fetchNotifications = useCallback(async () => {
        if (!user?.accessToken) return;

        try {
            const res = await API.get("/notification", {
                headers: { Authorization: `Bearer ${user.accessToken}` },
                params: { limit: 30 },
            });

            if (res.status === 200 && res.data) {
                const list = res.data.notifications || [];
                setNotifications(list);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    }, [user?.accessToken]);

    useEffect(() => {
        if (user?.accessToken) {
            fetchNotifications();
            // Poll mỗi 30 giây để cập nhật thông báo mới
            const interval = setInterval(fetchNotifications, 70000);
            return () => clearInterval(interval);
        }
    }, [user?.accessToken, fetchNotifications]);

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    const handleMarkAsRead = async (notificationId) => {
        try {
            await API.patch(`/notification/${notificationId}/read`, null, {
                headers: { Authorization: `Bearer ${user.accessToken}` },
            });
            await fetchNotifications();
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const navigateToOrderDetail = (notification) => {
        if (!notification?.type?.startsWith("order_")) return false;

        if (notification.relatedId) {
            navigate("/orders", { state: { selectedOrderId: String(notification.relatedId) } });
        } else {
            navigate("/orders");
        }

        return true;
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.isRead) {
            await handleMarkAsRead(notification._id);
        }

        setIsOpen(false);

        if (navigateToOrderDetail(notification)) {
            return;
        }

        // Chuyển hướng dựa trên loại thông báo
        if (notification.link) {
            // Try to derive a highlight target (reply/review/comment) when possible
            try {
                const url = new URL(notification.link, window.location.origin);
                const params = new URLSearchParams(url.search);
                const relatedId = notification.relatedId;
                let highlightTarget = null;

                if (relatedId) {
                    const isArticleLink = url.pathname.startsWith('/articles');
                    const isProductLink = url.pathname.startsWith('/product/detail');

                    if (isArticleLink) {
                        // comment on article
                        highlightTarget = { type: 'comment', id: relatedId };
                    } else if (isProductLink) {
                        const replyTypes = ['review_reply', 'review_mention', 'reply_reaction', 'reply_reaction'];
                        if (replyTypes.includes(notification.type)) {
                            highlightTarget = { type: 'reply', id: relatedId };
                        } else {
                            highlightTarget = { type: 'review', id: relatedId };
                        }
                    }
                }

                const to = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}${url.hash || ''}`;
                if (highlightTarget) {
                    navigate(to, { state: { highlightTarget } });
                } else {
                    navigate(to);
                }
                return;
            } catch (err) {
                // fallback to simple navigate
                console.error('Invalid notification link:', err);
                navigate(notification.link);
                return;
            }
        } else if (notification.type?.startsWith("article_")) {
            navigate("/articles");
        }
    };

    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;

        setLoading(true);
        try {
            await API.patch("/notification/read-all", null, {
                headers: { Authorization: `Bearer ${user.accessToken}` },
            });
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
            window.dispatchEvent(new CustomEvent("notifications:markAllRead"));
        } catch (error) {
            console.error("Error marking all as read:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const syncListener = () => {
            fetchNotifications();
        };
        window.addEventListener("notifications:markAllRead", syncListener);
        return () => window.removeEventListener("notifications:markAllRead", syncListener);
    }, [fetchNotifications]);

    useEffect(() => {
        const appendListener = (event) => {
            const payload = event?.detail;
            if (!payload) return;
            setNotifications((prev) => [payload, ...prev].slice(0, 30));
            setUnreadCount((c) => c + 1);
        };
        window.addEventListener("notifications:append", appendListener);
        return () => window.removeEventListener("notifications:append", appendListener);
    }, []);

    const handleDeleteRead = async () => {
        setLoading(true);
        try {
            await API.delete("/notification/read-all", {
                headers: { Authorization: `Bearer ${user.accessToken}` },
            });
            await fetchNotifications();
        } catch (error) {
            console.error("Error deleting read notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    // Loại bỏ thông báo trùng (giữ order_delivery_success, bỏ order_delivered nếu cùng relatedId)
    const dedupeNotifications = (items = []) => {
        const map = new Map();
        items.forEach((n) => {
            const key = n.relatedId ? String(n.relatedId) : n._id;
            const existing = map.get(key);
            const isSuccess = n.type === "order_delivery_success";
            const isDelivered = n.type === "order_delivered";

            if (!existing) {
                map.set(key, n);
                return;
            }

            if (isSuccess) {
                map.set(key, n);
                return;
            }

            if (existing.type === "order_delivery_success" && isDelivered) {
                // keep success, skip delivered
                return;
            }

            // otherwise keep first
        });
        return Array.from(map.values());
    };

    const getNotificationIcon = (type) => {
        const icons = {
            order_created: "🧾",
            order_processing: "🛠️",
            order_shipping: "🚚",
            order_shipped: "🚚",
            order_delivered: "📦",
            order_completed: "✅",
            order_complete: "✅",
            order_delivery_success: "✅",
            order_cancelled: "❌",
            order_expired: "⏰",
            article_pending: "⏳",
            article_approved: "✅",
            article_rejected: "⚠️",
            new_comment: "💬",
            new_review: "⭐",
            comment_reply: "↩️",
            review_reply: "↩️",
            comment_mention: "@",
            review_mention: "@",
            comment_reaction: "❤️",
            review_reaction: "❤️",
            reply_reaction: "👍",
        };
        return icons[type] || "🔔";
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "Vừa xong";
        if (diffMins < 60) return `${diffMins} phút trước`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} giờ trước`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays} ngày trước`;

        return date.toLocaleDateString("vi-VN");
    };

    const handleViewAllClick = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log('Button clicked - closing dropdown');
        setIsOpen(false);
        
        console.log('Navigating to /notifications');
        // Navigate ngay lập tức
        navigate("/notifications");
    };

    if (!user) return null;

    return (
        <li className="notification-icon-wrapper" ref={dropdownRef}>
            <button
                type="button"
                className="notification-trigger"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Thông báo"
            >
                <AiFillBell />
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>Thông báo</h3>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                className="mark-all-read"
                                onClick={handleMarkAllAsRead}
                                disabled={loading}
                            >
                                Đánh dấu đã đọc
                            </button>
                        )}
                    </div>

                    <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div className="notification-empty">
                                <p>Không có thông báo nào</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif._id}
                                    className={`notification-item ${notif.isRead ? "read" : "unread"}`}
                                    onClick={() => handleNotificationClick(notif)}
                                >
                                    <div className="notification-icon">
                                        {getNotificationIcon(notif.type)}
                                    </div>
                                    <div className="notification-content">
                                        <div className="notification-title">{notif.title}</div>
                                        <div className="notification-message">{notif.message}</div>
                                        <div className="notification-time">{formatTime(notif.createdAt)}</div>
                                    </div>
                                    {!notif.isRead && <div className="notification-dot" />}
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="notification-footer">
                            <button
                                type="button"
                                className="view-all-btn"
                                onClick={handleViewAllClick}
                            >
                                Xem tất cả thông báo
                            </button>
                            <button
                                type="button"
                                className="delete-read-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRead();
                                }}
                                disabled={loading}
                            >
                                Xóa đã đọc
                            </button>
                        </div>
                    )}
                </div>
            )}
        </li>
    );
};

export default memo(NotificationIcon);
