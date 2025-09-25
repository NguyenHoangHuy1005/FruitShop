// product-services/controllers/couponController.js
const Coupon = require("../models/Coupon");

exports.createCoupon = async (req, res) => {
    try {
        let { code, discountType, value, minOrder, usageLimit, startDate, endDate } = req.body;

        // Chuẩn hóa giá trị giảm giá, Chuẩn hóa discountType
        if (discountType === "%" || discountType.toLowerCase() === "percent") {
            discountType = "percent";
        } else if (discountType.toLowerCase() === "vnđ" || discountType.toLowerCase() === "vnd" || discountType === "fixed") {
            discountType = "fixed";
        }

        const coupon = await Coupon.create({
            code: String(code || "").trim(),
            discountType,
            value,
            minOrder,
            usageLimit,
            startDate,
            endDate,
        });

        res.status(201).json({ ok: true, coupon });
    } catch (e) {
        res.status(400).json({ ok: false, message: e.message });
    }
};

exports.extendCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        let { addUsage = 0, newEndDate, reactivate = false } = req.body || {};

        const c = await Coupon.findById(id);
        if (!c) return res.status(404).json({ ok: false, message: "Không tìm thấy coupon." });

        const updates = {};

        // Xử lý tăng usageLimit
        if (addUsage !== undefined) {
            addUsage = Number(addUsage);
            if (!Number.isFinite(addUsage) || addUsage < 0) {
                return res.status(400).json({ ok: false, message: "addUsage phải là số >= 0." });
            }
            if (addUsage > 0) {
                if (c.usageLimit === 0) {
                // 0 = không giới hạn → chuyển sang giới hạn mới = usedCount + addUsage (để còn lại đúng addUsage)
                updates.usageLimit = Number(c.usedCount) + addUsage;
                } else {
                updates.usageLimit = Number(c.usageLimit) + addUsage;
                }
            }
        }

        // Xử lý dời ngày hết hạn
        if (newEndDate) {
            const d = new Date(newEndDate);
            if (isNaN(d.getTime())) {
                return res.status(400).json({ ok: false, message: "newEndDate không hợp lệ." });
            }
            const now = new Date();
            if (d < now) {
                return res.status(400).json({ ok: false, message: "newEndDate phải lớn hơn thời điểm hiện tại." });
            }
            updates.endDate = d;
        }

        // Tuỳ chọn kích hoạt lại nếu trước đó đã ngưng
        if (reactivate === true) {
            updates.active = true;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ ok: false, message: "Không có thay đổi nào để gia hạn." });
        }

        const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
        return res.json({ ok: true, coupon });
    } catch (err) {
        console.error("extendCoupon error:", err);
        return res.status(500).json({ ok: false, message: "Lỗi server khi gia hạn coupon." });
    }
};


exports.listCoupons = async (req, res) => {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
};

exports.deleteCoupon = async (req, res) => {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
    };

exports.toggleCoupon = async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    coupon.active = !coupon.active;
    await coupon.save();
    res.json({ ok: true, coupon });
};
// product-services/controllers/couponController.js
// product-services/controllers/couponController.js
exports.validateCoupon = async (req, res) => {
    try {
        const { code, subtotal } = req.body || {};
        if (!code) {
            return res.status(400).json({ ok: false, message: "Thiếu mã code." });
        }
        if (subtotal == null || isNaN(subtotal)) {
            return res.status(400).json({ ok: false, message: "Thiếu hoặc sai giá trị đơn hàng." });
        }

        const coupon = await Coupon.findOne({ code: code.trim(), active: true });
        if (!coupon) {
            return res.status(404).json({ ok: false, message: "Mã giảm giá không tồn tại hoặc đã bị khóa." });
        }

        const now = new Date();
        if (coupon.startDate && now < coupon.startDate) {
            return res.status(400).json({ ok: false, message: "Mã giảm giá chưa bắt đầu." });
        }
        if (coupon.endDate && now > coupon.endDate) {
            return res.status(400).json({ ok: false, message: "Mã giảm giá đã hết hạn." });
        }

        if (coupon.minOrder && subtotal < coupon.minOrder) {
            return res.status(400).json({
                ok: false,
                message: `Đơn hàng phải tối thiểu ${coupon.minOrder.toLocaleString()}đ để áp dụng.`,
            });
        }

        // kiểm tra số lượt dùng
        if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ ok: false, message: "Mã giảm giá đã hết lượt sử dụng." });
        }

        // 🔑 Tính discount
        let discount = 0;
        if (coupon.discountType === "percent") {
            discount = Math.min(subtotal, Math.round((subtotal * coupon.value) / 100));
        } else if (coupon.discountType === "fixed") {
            discount = Math.min(subtotal, coupon.value);
        }

        return res.status(200).json({
            ok: true,
            discount,
            message: `Áp dụng thành công mã ${coupon.code}!`,
        });
    } catch (err) {
        console.error("validateCoupon error:", err);
        return res.status(500).json({ ok: false, message: "Lỗi server khi kiểm tra coupon." });
    }
};

