import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { API } from '../../../component/redux/apiRequest';
import './style.scss';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth?.login?.currentUser);

  const buildNotificationLink = (notification) => {
    const fallback = { to: notification.link || '/', state: null };
    if (!notification.link) return fallback;
    if (typeof window === 'undefined') return fallback;

    try {
      const url = new URL(notification.link, window.location.origin);
      const params = new URLSearchParams(url.search);
      const relatedId = notification.relatedId;
      let highlightTarget = null;

      if (relatedId) {
        const isArticleLink = url.pathname.startsWith('/articles');
        const isProductLink = url.pathname.startsWith('/product/detail');

        if (isArticleLink) {
          params.set('commentId', relatedId);
          highlightTarget = { type: 'comment', id: relatedId };
        } else if (isProductLink) {
          const replyTypes = ['review_reply', 'review_mention', 'reply_reaction'];
          if (replyTypes.includes(notification.type)) {
            params.set('replyId', relatedId);
            highlightTarget = { type: 'reply', id: relatedId };
          } else {
            params.set('reviewId', relatedId);
            highlightTarget = { type: 'review', id: relatedId };
          }
        }
      }

      const searchString = params.toString();
      return {
        to: `${url.pathname}${searchString ? `?${searchString}` : ''}${url.hash || ''}`,
        state: highlightTarget ? { highlightTarget } : null
      };
    } catch (err) {
      console.error('Invalid notification link:', err);
      return fallback;
    }
  };

  const buildOrderNavigation = (notification) => {
    if (!notification?.type?.startsWith('order_')) return null;

    if (notification.relatedId) {
      return {
        to: '/orders',
        options: { state: { selectedOrderId: String(notification.relatedId) } }
      };
    }

    return { to: '/orders', options: undefined };
  };

  useEffect(() => {
    console.log('NotificationsPage mounted');
    console.log('User:', user);
    console.log('AccessToken:', user?.accessToken ? 'exists' : 'missing');
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user?.accessToken) {
        navigate('/');
        return;
      }

      const params = {
        limit: 100,
        skip: 0
      };

      if (filter === 'unread') {
        params.unreadOnly = true;
      }

      const response = await API.get('/notification', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
        params
      });

      let notifs = response.data.notifications || [];
      
      if (filter === 'read') {
        notifs = notifs.filter(n => n.isRead);
      }

      setNotifications(notifs);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Không thể tải thông báo. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user?.accessToken]);

  const markAsRead = async (notificationId) => {
    try {
      if (!user?.accessToken) return;
      
      await API.patch(
        `/notification/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${user.accessToken}` } }
      );
      
      setNotifications(notifications.map(n => 
        n._id === notificationId ? { ...n, isRead: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!user?.accessToken) return;
      
      await API.patch(
        '/notification/read-all',
        {},
        { headers: { Authorization: `Bearer ${user.accessToken}` } }
      );
      
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      if (!user?.accessToken) return;
      
      await API.delete(
        `/notification/${notificationId}`,
        { headers: { Authorization: `Bearer ${user.accessToken}` } }
      );
      
      setNotifications(notifications.filter(n => n._id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const deleteAllRead = async () => {
    try {
      if (!user?.accessToken) return;
      
      await API.delete(
        '/notification/read-all',
        { headers: { Authorization: `Bearer ${user.accessToken}` } }
      );
      
      setNotifications(notifications.filter(n => !n.isRead));
    } catch (error) {
      console.error('Error deleting read notifications:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    const orderNavigation = buildOrderNavigation(notification);
    if (orderNavigation) {
      if (orderNavigation.options) {
        navigate(orderNavigation.to, orderNavigation.options);
      } else {
        navigate(orderNavigation.to);
      }
      return;
    }
    
    // Chuyển hướng dựa trên link hoặc type
    if (notification.link) {
      const navigation = buildNotificationLink(notification);
      const options = navigation.state ? { state: navigation.state } : undefined;
      if (options) {
        navigate(navigation.to, options);
      } else {
        navigate(navigation.to);
      }
    } else if (notification.type?.startsWith('article_')) {
      navigate('/articles');
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      new_comment: '💬',
      new_review: '⭐',
      comment_reply: '↩️',
      review_reply: '↩️',
      comment_mention: '@',
      review_mention: '@',
      comment_reaction: '❤️',
      review_reaction: '❤️',
      reply_reaction: '👍',
      order_created: '🛒',
      order_paid: '💳',
      order_processing: '📦',
      order_shipping: '🚚',
      order_completed: '✅',
      order_cancelled: '❌',
      article_pending: '⏳',
      article_approved: '✅',
      article_rejected: '❌',
    };
    return icons[type] || '🔔';
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Vừa xong';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
    return new Date(date).toLocaleDateString('vi-VN');
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Redirect nếu không có user
  useEffect(() => {
    if (!user) {
      console.log('No user found, redirecting to home');
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <div className="notifications-page">
      <div className="notifications-container">
        <div className="notifications-header">
          <h1>Thông báo</h1>
          <div className="notifications-stats">
            {unreadCount > 0 && <span className="unread-badge">{unreadCount} chưa đọc</span>}
          </div>
        </div>

        <div className="notifications-actions">
          <div className="filter-buttons">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Tất cả
            </button>
            <button
              className={filter === 'unread' ? 'active' : ''}
              onClick={() => setFilter('unread')}
            >
              Chưa đọc
            </button>
            <button
              className={filter === 'read' ? 'active' : ''}
              onClick={() => setFilter('read')}
            >
              Đã đọc
            </button>
          </div>

          <div className="action-buttons">
            {unreadCount > 0 && (
              <button className="btn-mark-all" onClick={markAllAsRead}>
                Đánh dấu tất cả đã đọc
              </button>
            )}
            {notifications.some(n => n.isRead) && (
              <button className="btn-delete-all" onClick={deleteAllRead}>
                Xóa đã đọc
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Đang tải thông báo...</p>
          </div>
        ) : error ? (
          <div className="empty-state error-state">
            <span className="empty-icon">⚠️</span>
            <h2>Có lỗi xảy ra</h2>
            <p>{error}</p>
            <button className="retry-button" onClick={fetchNotifications}>
              Thử lại
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔔</span>
            <h2>Chưa có thông báo nào</h2>
            <p>
              {filter === 'unread' 
                ? 'Bạn đã đọc hết thông báo rồi!'
                : filter === 'read'
                ? 'Chưa có thông báo nào được đánh dấu đã đọc'
                : 'Thông báo của bạn sẽ hiển thị ở đây'}
            </p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map(notification => (
              <div
                key={notification._id}
                className={`notification-card ${!notification.isRead ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-body">
                  <div className="notification-header">
                    <h3>{notification.title}</h3>
                    <span className="notification-time">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className="notification-message">{notification.message}</p>
                </div>
                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification._id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
