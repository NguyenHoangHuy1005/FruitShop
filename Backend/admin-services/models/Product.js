const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        price: { type: Number, required: true, min: 0 },
        category: { type: String, required: true },
        subcategories: { type: String, default: "" },
        // NEW: Đơn vị tính (kg, cái, giỏ, bó...)
        unit: { type: String, default: "kg" },
        // NEW: Họ sản phẩm (quýt, bưởi, cam, nho...)
        family: { type: String, default: "" },
        rating: { type: Number, default: 0 },
        image: { type: [String], default: [] },
        imagethum: { type: [String], default: [] },
        // NEW: snapshot số lượng tồn (được cập nhật tự động từ Stock)
        onHand: { type: Number, default: 0, min: 0 },
        status: { type: String, default: "Còn hàng" },
        discountPercent: { type: Number, default: 0, min: 0, max: 100 },
        // NEW: Ngày bắt đầu và kết thúc giảm giá (null = vô thời hạn)
        discountStartDate: { type: Date, default: null },
        discountEndDate: { type: Date, default: null },
        // đếm số lượt xem
        viewCount: { type: Number, default: 0, min: 0 },
        // đếm số lượt mua
        purchaseCount: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);

module.exports =
    mongoose.models.Product || mongoose.model("Product", ProductSchema);
