const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    image: { type: [String], default: [] }, // <— đổi từ String sang [String]
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
}, { _id: false });


const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    customer: {
        name: { type: String, required: true },
        address: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, required: true },
        note: { type: String, default: "" },
    },
    items: { type: [OrderItemSchema], required: true },
    amount: {
        subtotal: { type: Number, required: true, min: 0 },
        shipping: { type: Number, required: true, min: 0, default: 0 },
        discount: { type: Number, required: true, min: 0, default: 0 },
        total: { type: Number, required: true, min: 0 },
    },
    status: { type: String, enum: ["pending", "paid", "shipped", "completed", "cancelled"], default: "pending" },
    payment: { type: String, enum: ["COD", "BANK", "VNPAY"], default: "COD" },
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);
