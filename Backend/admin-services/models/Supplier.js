const mongoose = require("mongoose");

const SupplierSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contact_name: String,
    phone: String,
    email: String,
    address: String,
}, { timestamps: true });

module.exports = mongoose.model("Supplier", SupplierSchema);
