const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        price: { type: Number, required: true, min: 0 },
        category: { type: String, required: true },
        subcategories: { type: String, default: "" },
        rating: { type: Number, default: 0 },
        image: { type: [String], default: [] },
        imagethum: { type: [String], default: [] },
        status: { type: String, default: "Còn hàng" },
        //new fields
        discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    },{ timestamps: true }
);

module.exports = mongoose.models.Product || mongoose.model("Product", ProductSchema);

