const mongoose = require("mongoose");

const ImportItemSchema = new mongoose.Schema({
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: "ImportReceipt", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Lưu snapshot thông tin sản phẩm để giữ lại khi product bị xóa
    productName: { type: String },
    productImage: { type: String },
    quantity: { type: Number, required: true }, // Số lượng nhập ban đầu (KHÔNG THAY ĐỔI)
    soldQuantity: { type: Number, default: 0 }, // Số lượng đã bán (tăng khi thanh toán thành công)
    damagedQuantity: { type: Number, default: 0 }, // Số lượng bị trừ/huỷ/hư hỏng
    unitPrice: { type: Number, required: true },
    sellingPrice: { type: Number }, // Giá bán của lô hàng này (nếu không set thì bằng unitPrice)
    total: { type: Number, required: true },
    importDate: { type: Date, default: Date.now }, // Ngày nhập hàng
    expiryDate: { type: Date }, // Hạn sử dụng (optional)
}, { timestamps: true });

module.exports = mongoose.model("ImportItem", ImportItemSchema);
