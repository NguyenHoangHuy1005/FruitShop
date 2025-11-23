// admin-services/models/Warehouse.js
const mongoose = require("mongoose");

const WarehouseSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        phone: { type: String, trim: true },
        contactName: { type: String, trim: true },
        note: { type: String, trim: true },
        active: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

WarehouseSchema.index({ name: 1 });

module.exports = mongoose.model("Warehouse", WarehouseSchema);
