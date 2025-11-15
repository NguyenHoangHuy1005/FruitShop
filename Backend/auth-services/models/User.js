const mongoose = require("mongoose");

const providerIsLocal = function () {
    return (this.provider || "local") === "local";
};

const UserSchema = new mongoose.Schema(
    {
        username: {
        type: String,
        required: providerIsLocal,
        unique: true,
        sparse: true,
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
        required: providerIsLocal,
        match: /^(0|\+84)(\d{9})$/,
        unique: true,
        sparse: true,
        trim: true,
        },
        password: {
        type: String,
        required: providerIsLocal,
        minlength: 6,
        default: null,
        },
        provider: {
        type: String,
        enum: ["local", "google"],
        default: "local",
        index: true,
        },
        admin: {
        type: Boolean,
        default: false,
        },
        fullname: { type: String, default: "" },
        avatar:   { type: String, default: "" },
        
        loginCount: { type: Number, default: 0 },

        isVerified: { type: Boolean, default: false },
        verificationToken: { type: String, default: null },
        verificationExpiresAt:  { type: Date,   default: null },

        resetPasswordToken: { type: String, default: null },
        resetPasswordExpiresAt: { type: Date, default: null },

        newEmailPending:      { type: String, default: null },
        emailChangeToken:     { type: String, default: null },
        emailChangeExpiresAt: { type: Date,   default: null },

        newUsernamePending:      { type: String, default: null, trim: true },
        usernameChangeToken:     { type: String, default: null },
        usernameChangeExpiresAt: { type: Date,   default: null },

    },
    { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
