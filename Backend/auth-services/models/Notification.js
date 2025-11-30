const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                "order_created",      // Đơn hàng được tạo thành công
                "order_processing",   // Đơn hàng đang xử lý
                "order_shipping",     // Đơn hàng đang giao
                "order_completed",    // Đơn hàng hoàn tất
                "order_confirmed",    // Đơn hàng đã được xác nhận
                "order_delivered",    // Đơn đã giao
                "order_delivery_success", // Giao thành công
                "order_expired",      // Đơn hết hạn
                "order_cancelled",    // Đơn hàng bị hủy
                "article_pending",    // Bài viết chờ duyệt
                "article_approved",   // Bài viết đã duyệt
                "article_rejected",   // Bài viết bị từ chối
                "new_comment",        // Comment mới vào bài viết
                "new_review",         // Review mới vào sản phẩm
                "comment_reply",      // Reply vào comment
                "review_reply",       // Reply vào review
                "comment_mention",    // Được mention trong comment reply
                "review_mention",     // Được mention trong review reply
                "comment_reaction",   // Reaction vào comment
                "review_reaction",    // Reaction vào review
                "reply_reaction",     // Reaction vào reply
            ],
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        relatedId: {
            type: String, // ID của đơn hàng hoặc bài viết liên quan
        },
        link: {
            type: String, // Link để chuyển hướng khi click vào thông báo
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index để query nhanh các thông báo chưa đọc của user
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
