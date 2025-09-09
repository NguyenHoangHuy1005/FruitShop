const crypto = require("crypto");
const Stock = require("../models/Stock");
const Product = require("../../admin-services/models/Product");

// NEW: cập nhật cả onHand + status về Product
async function upsertProductInventory(productId, onHand) {
    const qty = Math.max(0, Number(onHand) || 0);
    const status = qty > 0 ? "Còn hàng" : "Hết hàng";
    try {
        await Product.findByIdAndUpdate(
        productId,
        { $set: { onHand: qty, status } },
        { new: false }
        );
    } catch (_) {}
}

// (giữ lại nếu nơi khác còn dùng)
async function updateProductStatus(productId, onHand) {
    return upsertProductInventory(productId, onHand);
}

exports.getOne = async (req, res) => {
    const { productId } = req.params;
    const doc = await Stock.findOne({ product: productId }).lean();
    return res.json(doc || { product: productId, onHand: 0 });
};

exports.list = async (_req, res) => {
  try {
    const rows = await Stock.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "p"
        }
      },
      {
        $addFields: { productDoc: { $arrayElemAt: ["$p", 0] } }
      },
      { $project: { p: 0 } }
    ]);
    console.log("rows=", JSON.stringify(rows, null, 2)); // 👈 log ra
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Lỗi lấy danh sách tồn kho", error: err.message });
  }
};



// nhập kho (+)
exports.stockIn = async (req, res) => {
    const { productId, qty = 0 } = req.body || {};
    const inc = Math.max(0, parseInt(qty, 10) || 0);
    if (!productId || inc <= 0) return res.status(400).json({ message: "Thiếu productId hoặc qty > 0" });

    const doc = await Stock.findOneAndUpdate(
        { product: productId },
        { $inc: { onHand: inc } },
        { new: true, upsert: true }
    );

    await upsertProductInventory(productId, doc.onHand);
    return res.json({ ok: true, data: doc });
};

// set cứng tồn
exports.setQuantity = async (req, res) => {
    const { productId, qty = 0 } = req.body || {};
    const val = Math.max(0, parseInt(qty, 10) || 0);
    if (!productId) return res.status(400).json({ message: "Thiếu productId" });

    const doc = await Stock.findOneAndUpdate(
        { product: productId },
        { $set: { onHand: val } },
        { new: true, upsert: true }
    );

    await upsertProductInventory(productId, doc.onHand);
    return res.json({ ok: true, data: doc });
};

exports._updateProductStatus = updateProductStatus;
exports._upsertProductInventory = upsertProductInventory; // tiện dùng nơi khác
