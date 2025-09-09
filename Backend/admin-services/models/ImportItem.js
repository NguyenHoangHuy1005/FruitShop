const mongoose = require("mongoose");

const ImportItemSchema = new mongoose.Schema({
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: "ImportReceipt", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model("ImportItem", ImportItemSchema);
