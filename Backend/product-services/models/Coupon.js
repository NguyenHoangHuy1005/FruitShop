// product-services/models/Coupon.js
const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },   // Mã giảm giá
  discountType: { type: String, enum: ["percent", "fixed"], default: "fixed" }, // % hoặc số tiền
  value: { type: Number, required: true, min: 1 }, // giá trị giảm (VD: 10% hoặc 50000đ)
  minOrder: { type: Number, default: 0 },          // đơn tối thiểu để dùng
  usageLimit: { type: Number, default: 0 },        // 0 = không giới hạn
  usedCount: { type: Number, default: 0 },         // số lần đã dùng
  startDate: { type: Date, default: Date.now },    // thời gian bắt đầu
  endDate: { type: Date, required: true },         // hết hạn
  active: { type: Boolean, default: true },        // có đang hoạt động không
}, { timestamps: true });

module.exports = mongoose.model("Coupon", CouponSchema);
