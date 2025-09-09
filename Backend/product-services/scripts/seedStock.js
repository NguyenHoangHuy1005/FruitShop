// BE/product-services/scripts/seedStock.js
const path = require("path");
// nạp .env nằm ở Backend/.env
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const mongoose = require("mongoose");
const Product = require("../../admin-services/models/Product");
const Stock = require("../models/Stock");

const uri = process.env.MONGO_URL || process.env.MONGODB_URI;

(async () => {
    if (!uri) {
        console.error("Missing MONGO_URL or MONGODB_URI in .env");
        process.exit(1);
    }
    await mongoose.connect(uri);
    const products = await Product.find({}, "_id").lean();
    let created = 0;

    for (const p of products) {
        const r = await Stock.updateOne(
        { product: p._id },
        { $setOnInsert: { onHand: 0 } },
        { upsert: true }
        );
        if (r?.upsertedCount) created++;
    }

    console.log(`Seeded stock docs for ${products.length} products (created ${created}).`);
    process.exit(0);
})();
