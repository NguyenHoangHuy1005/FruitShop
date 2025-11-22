const mongoose = require("mongoose");

const SpoilageSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: "ImportItem", default: null },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  quantity: { type: Number, required: true, min: 0 },
  reason: { type: String, default: "expired_on_return" },
  note: { type: String, default: "" },
  expiryDate: { type: Date, default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

module.exports = mongoose.models.SpoilageRecord || mongoose.model("SpoilageRecord", SpoilageSchema);
