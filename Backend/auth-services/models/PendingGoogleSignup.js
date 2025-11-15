const mongoose = require("mongoose");

const PendingGoogleSignupSchema = new mongoose.Schema(
    {
        email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
        },
        otpHash: {
        type: String,
        required: true,
        },
        verifyToken: {
        type: String,
        required: true,
        unique: true,
        },
        googleSub: { type: String, default: null },
        expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PendingGoogleSignup", PendingGoogleSignupSchema);
