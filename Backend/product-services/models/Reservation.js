const mongoose = require("mongoose");

const ReservationItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "ImportItem", required: true },
    quantity: { type: Number, required: true, min: 1 },
    lockedPrice: { type: Number, required: true }, // Giá đã lock
    discountPercent: { type: Number, default: 0 }, // % giảm giá tại thời điểm reserve
    unit: { type: String, default: "kg" },
}, { _id: false });

const ReservationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionKey: { type: String, required: true, index: true }, // For guest users
    type: { 
        type: String, 
        enum: ["cart", "checkout"], // cart = 15min temp, checkout = until payment
        default: "cart" 
    },
    status: {
        type: String,
        enum: ["active", "confirmed", "released", "expired"],
        default: "active"
    },
    items: [ReservationItemSchema],
    expiresAt: { type: Date, required: true, index: true }, // Auto-release time
    releasedAt: { type: Date },
    confirmedAt: { type: Date },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
}, { timestamps: true });

// Index for auto-cleanup
ReservationSchema.index({ expiresAt: 1, status: 1 });

module.exports = mongoose.models.Reservation || mongoose.model("Reservation", ReservationSchema);
