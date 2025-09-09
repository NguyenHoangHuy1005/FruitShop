const path = require("path");
// nạp .env nằm ở Backend/.env
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const mongoose = require("mongoose");
const Product = require("../../admin-services/models/Product");
const Stock = require("../models/Stock");

const uri = process.env.MONGO_URL || process.env.MONGODB_URI;

(async () => {
    await mongoose.connect(uri);
    const cursor = Stock.find({}, { product: 1, onHand: 1 }).lean().cursor();

    let n = 0;
    for await (const s of cursor) {
        const qty = Math.max(0, Number(s.onHand) || 0);
        const status = qty > 0 ? "Còn hàng" : "Hết hàng";
        await Product.findByIdAndUpdate(
        s.product,
        { $set: { onHand: qty, status } },
        { new: false }
        );
        n++;
    }

    console.log(`Synced onHand for ${n} products from Stock.`);
    process.exit(0);
})();
