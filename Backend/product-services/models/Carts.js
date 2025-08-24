const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema({
    product:  { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name:     String,
    image:    String,
    price:    { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    total:    { type: Number, required: true, min: 0 },
}, { _id: false });

const CartSchema = new mongoose.Schema({
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cartKey: { type: String, index: true, default: null },
    status:  { type: String, enum: ["active", "ordered", "abandoned"], default: "active" },
    items:   { type: [CartItemSchema], default: [] },
    summary: {
        totalItems: { type: Number, default: 0 },
        subtotal:   { type: Number, default: 0 },
    },
}, { timestamps: true });

// ✅ Model name "Cart"; tránh OverwriteModelError
module.exports = mongoose.models.Cart || mongoose.model("Cart", CartSchema);
