const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    image: { type: [String], default: [] }, // <— đổi từ String sang [String]
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
    importPrice: { type: Number, default: 0 }, // Giá nhập để tính lợi nhuận
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "ImportItem" }, // Lô hàng nguồn
    lockedPrice: { type: Number }, // Giá trước khi giảm
    discountPercent: { type: Number, default: 0 }, // % giảm giá
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
    status: {
        type: String,
        enum: ["pending", "pending_payment", "awaiting_payment", "expired", "processing", "shipping", "delivered", "completed", "cancelled"],
        default: "pending"
    },
    paymentType: {
        type: String,
        enum: ["COD", "BANK", "VNPAY"],
        default: "COD"
    },
    payment: {
        type: mongoose.Schema.Types.Mixed,
        default: "COD"
    },
    paymentDeadline: { type: Date, default: null },
    paymentCompletedAt: { type: Date, default: null },
    paymentMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    pickupAddress: { type: String, default: "123 Đường Nguyễn Văn Linh, Quận 7, TP.HCM" }, // Địa chỉ lấy hàng cho shipper
    shipperId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    autoConfirmAt: { type: Date, default: null },   // pending payment auto-expire deadline
    autoCompleteAt: { type: Date, default: null },  // delivered auto-complete deadline
    deliveryProof: {
        type: [{
            url: { type: String, required: true },
            note: { type: String, default: "" },
            uploadedAt: { type: Date, default: Date.now },
            uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            uploadedByName: { type: String, default: "" },
        }],
        default: []
    },
    history: {
        type: [{
            status: { type: String },
            note: { type: String, default: "" },
            actorType: { type: String, default: "system" },
            actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
            actorName: { type: String, default: "" },
            createdAt: { type: Date, default: Date.now },
        }],
        default: []
    },
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);
