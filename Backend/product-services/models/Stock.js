const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", unique: true, required: true, index: true },
    onHand:  { type: Number, default: 0, min: 0 },          // số khả dụng để bán
    lowStockThreshold: { type: Number, default: 0, min: 0 }, // ngưỡng cảnh báo (tùy chọn)
}, { timestamps: true });

module.exports = mongoose.models.Stock || mongoose.model("Stock", StockSchema);
