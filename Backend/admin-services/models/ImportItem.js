const mongoose = require("mongoose");

const ImportItemSchema = new mongoose.Schema({
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: "ImportReceipt", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true },
    damagedQuantity: { type: Number, default: 0 }, // Số lượng bị trừ/huỷ/hư hỏng
    unitPrice: { type: Number, required: true },
    sellingPrice: { type: Number }, // Giá bán của lô hàng này (nếu không set thì bằng unitPrice)
    total: { type: Number, required: true },
    importDate: { type: Date, default: Date.now }, // Ngày nhập hàng
    expiryDate: { type: Date }, // Hạn sử dụng (optional)
}, { timestamps: true });

module.exports = mongoose.model("ImportItem", ImportItemSchema);
