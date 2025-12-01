const Notification = require("../models/Notification");

const notificationController = {
    // Lấy danh sách thông báo của user hiện tại
    getMyNotifications: async (req, res) => {
        try {
            const userId = req.user.id;
            const { limit = 20, skip = 0, unreadOnly = false } = req.query;

            const query = { user: userId };
            if (unreadOnly === "true" || unreadOnly === true) {
                query.isRead = false;
            }

            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(parseInt(skip))
                .lean();

            const unreadCount = await Notification.countDocuments({
                user: userId,
                isRead: false,
            });

            return res.status(200).json({
                notifications,
                unreadCount,
            });
        } catch (error) {
            console.error("Error getting notifications:", error);
            return res.status(500).json({ message: "Lỗi khi lấy thông báo" });
        }
    },

    // Đánh dấu một thông báo đã đọc
    markAsRead: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const notification = await Notification.findOneAndUpdate(
                { _id: id, user: userId },
                { isRead: true },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({ message: "Không tìm thấy thông báo" });
            }

            return res.status(200).json(notification);
        } catch (error) {
            console.error("Error marking notification as read:", error);
            return res.status(500).json({ message: "Lỗi khi cập nhật thông báo" });
        }
    },

    // Đánh dấu tất cả thông báo đã đọc
    markAllAsRead: async (req, res) => {
        try {
            const userId = req.user.id;

            await Notification.updateMany(
                { user: userId, isRead: false },
                { isRead: true }
            );

            return res.status(200).json({ message: "Đã đánh dấu tất cả thông báo là đã đọc" });
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
            return res.status(500).json({ message: "Lỗi khi cập nhật thông báo" });
        }
    },

    // Xóa một thông báo
    deleteNotification: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            const notification = await Notification.findOneAndDelete({
                _id: id,
                user: userId,
            });

            if (!notification) {
                return res.status(404).json({ message: "Không tìm thấy thông báo" });
            }

            return res.status(200).json({ message: "Đã xóa thông báo" });
        } catch (error) {
            console.error("Error deleting notification:", error);
            return res.status(500).json({ message: "Lỗi khi xóa thông báo" });
        }
    },

    // Xóa tất cả thông báo đã đọc
    deleteAllRead: async (req, res) => {
        try {
            const userId = req.user.id;

            await Notification.deleteMany({
                user: userId,
                isRead: true,
            });

            return res.status(200).json({ message: "Đã xóa tất cả thông báo đã đọc" });
        } catch (error) {
            console.error("Error deleting read notifications:", error);
            return res.status(500).json({ message: "Lỗi khi xóa thông báo" });
        }
    },

    // Helper function để tạo thông báo (dùng trong các controller khác)
    createNotification: async (userId, type, title, message, relatedId = null, link = null) => {
        try {
            const notification = new Notification({
                user: userId,
                type,
                title,
                message,
                relatedId,
                link,
            });
            await notification.save();
            try {
                const payload = {
                    id: notification._id,
                    title: notification.title,
                    message: notification.message,
                    body: notification.message,
                    type: notification.type,
                    relatedId: notification.relatedId,
                    link: notification.link,
                    createdAt: notification.createdAt,
                    unread: true,
                };
                const { emitNotificationNew } = require("../socket/chatEvents");
                emitNotificationNew(userId, payload);
            } catch (emitErr) {
                console.warn("[notification] emit socket fail:", emitErr?.message || emitErr);
            }
            return notification;
        } catch (error) {
            console.error("Error creating notification:", error);
            return null;
        }
    },
};

module.exports = notificationController;
