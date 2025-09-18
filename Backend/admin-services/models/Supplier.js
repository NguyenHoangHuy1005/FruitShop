const mongoose = require("mongoose");

const SupplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    contact_name: {
        type: String
    },
    phone: {
        type: String,
        required: true,
        match: /^(0|\+84)(\d{9})$/, // số VN: 0xxxxxxxxx hoặc +84xxxxxxxxx
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        minlength: 5,
        maxlength: 50,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // regex email chuẩn
        lowercase: true,
        trim: true,
        index: true,
    },
    address: {
        type: String
    },
    note: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model("Supplier", SupplierSchema);
