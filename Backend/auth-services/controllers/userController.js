const User = require("../models/User");
const Order = require("../../product-services/models/Order");

// ===== Không cần upload local nữa, dùng Cloudinary =====
// const path = require("path");
// const fs = require("fs");
// const multer = require("multer");
// const avatarDir = path.join(__dirname, "../../uploads/avatars");
// fs.mkdirSync(avatarDir, { recursive: true });
// ...

const userController = {
    getMe: async (req, res) => {
        try {
            const me = await User.findById(req.user.id).select("-password");
            if (!me) return res.status(404).json({ message: "Không tìm thấy người dùng." });
            res.status(200).json(me);
        } catch (e) { console.error(e); res.status(500).json({ message: "Lỗi máy chủ." }); }
    },

    // NEW: cập nhật hồ sơ (fullname/phone/avatar URL)
    updateMe: async (req, res) => {
        try {
            if (typeof req.body.email !== "undefined")
                return res.status(400).json({ message: "Đổi email phải dùng luồng OTP." });
            const patch = {};
            if (typeof req.body.fullname !== "undefined") patch.fullname = String(req.body.fullname);
            if (typeof req.body.phone !== "undefined") patch.phone = String(req.body.phone);
            if (typeof req.body.avatar !== "undefined") {
                patch.avatar = String(req.body.avatar);
                console.log("✅ Updating avatar to:", patch.avatar);
            }
            const me = await User.findByIdAndUpdate(req.user.id, patch, { new: true, runValidators: true }).select("-password");
            console.log("✅ User updated. New avatar:", me.avatar);
            console.log("✅ Full user object:", JSON.stringify(me, null, 2));
            res.status(200).json(me); // Trả về user object trực tiếp
        } catch (e) { 
            console.error("❌ Update error:", e); 
            res.status(500).json({ message: "Lỗi máy chủ." }); 
        }
    },

    // ===== KHÔNG CẦN NỮA: Đã chuyển sang Cloudinary =====
    // uploadAvatar: [
    //     upload.single("avatar"),
    //     async (req, res) => {
    //         try {
    //             if (!req.file) return res.status(400).json({ message: "Thiếu file ảnh." });
    //             const publicUrl = `/uploads/avatars/${req.file.filename}`;
    //             await User.updateOne({ _id: req.user.id }, { $set: { avatar: publicUrl } });
    //             const me = await User.findById(req.user.id).select("-password");
    //             res.status(200).json({ message: "Tải ảnh thành công", avatar: publicUrl, user: me });
    //         } catch (e) {
    //             console.error("Upload avatar error:", e);
    //             res.status(500).json({ message: e.message || "Lỗi máy chủ." });
    //         }
    //     }
    // ],

    getAllUsers: async (req, res) => {
        try {
            const users = await User.aggregate([
                {
                    $match: { admin: { $ne: true } } // loại bỏ admin
                },
                {
                    $lookup: {
                        from: "orders",        // collection đơn hàng
                        localField: "_id",     // so sánh với User._id
                        foreignField: "user",  // field trong Order
                        as: "orders"
                    }
                },
                {
                    $addFields: {
                        totalOrders: { $size: "$orders" }
                    }
                },
                {
                    $project: {
                        username: 1,
                        email: 1,
                        phone: 1,
                        createdAt: 1,
                        totalOrders: 1
                    }
                }
            ]);
            res.status(200).json(users);
        } catch (error) {
            console.error(error);
            res.status(500).json(error);
        }
    },

    deleteUser: async (req, res) => {
        try {
            const user = await User.findByIdAndDelete(req.params.id);
            res.status(200).json(user);
        } catch (error) {
            console.error(error);
            res.status(500).json(error);
        }
    },

    updateUser: async (req, res) => {
        try {
            const { username, email, phone } = req.body;
            const user = await User.findByIdAndUpdate(
                req.params.id,
                { username, email, phone },
                { new: true, runValidators: true }
            );
            res.status(200).json(user);
        } catch (error) {
            console.error(error);
            res.status(500).json(error);
        }
    }
};

module.exports = userController;
