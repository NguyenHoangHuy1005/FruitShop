const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        username: {
        type: String,
        required: true,
        unique: true,
        minlength: 3,
        maxlength: 50,
        trim: true,
        },
        email: {
        type: String,
        required: true,
        unique: true,
        minlength: 5,
        maxlength: 50,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        lowercase: true,
        trim: true,
        index: true,
        },
        phone: {
        type: String,
        required: true,
        match: /^(0|\+84)(\d{9})$/,
        unique: true,
        trim: true,
        },
        // SỬA LỖI: không dùng default: true cho password!
        password: {
        type: String,
        required: true,
        minlength: 6,
        },
        admin: {
        type: Boolean,
        default: false,
        },

        // ============ XÁC MINH EMAIL ============
        isVerified: { type: Boolean, default: false },
        verificationToken: { type: String, default: null },
        verificationExpiresAt: { type: Date, default: null },
        resetPasswordToken: { type: String, default: null },
        resetPasswordExpiresAt: { type: Date, default: null },

    },
    { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
