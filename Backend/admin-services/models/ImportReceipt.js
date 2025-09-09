const mongoose = require("mongoose");

const ImportReceiptSchema = new mongoose.Schema({
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    admin:    { type: mongoose.Schema.Types.ObjectId, ref: "User",     required: true },
    note: String,
    invoicePath: String,
    totalAmount: { type: Number, default: 0 }, // ✅ thêm
}, { timestamps: true });

module.exports = mongoose.model("ImportReceipt", ImportReceiptSchema);
