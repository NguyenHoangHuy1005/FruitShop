// product-services/controllers/couponController.js
const Coupon = require("../models/Coupon");

exports.createCoupon = async (req, res) => {
    try {
        let { code, discountType, value, minOrder, usageLimit, startDate, endDate } = req.body;

        // 🔑 Chuẩn hóa discountType
        if (discountType === "%" || discountType.toLowerCase() === "percent") {
            discountType = "percent";
        } else if (discountType.toLowerCase() === "vnđ" || discountType.toLowerCase() === "vnd" || discountType === "fixed") {
            discountType = "fixed";
        }

        const coupon = await Coupon.create({
            code: code.trim(),
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
        const { code, subtotal } = req.body;
        if (!code || !subtotal) {
            return res.status(400).json({ ok: false, message: "Thiếu mã code hoặc giá trị đơn hàng." });
        }

        const coupon = await Coupon.findOne({ code: code.trim() });
        if (!coupon) {
            return res.status(404).json({ ok: false, message: "Mã giảm giá không tồn tại." });
        }

        // Trạng thái
        if (coupon.active === false) {
            return res.status(400).json({ ok: false, message: "Mã giảm giá đã bị khóa." });
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

        if (coupon.usageLimit && coupon.usageLimit <= 0) {
            return res.status(400).json({ ok: false, message: "Mã giảm giá đã hết lượt sử dụng." });
        }

        // 🔑 Tính discount
        let discount = 0;
        if (coupon.discountType === "percent") {
            discount = Math.round((subtotal * coupon.value) / 100);
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

