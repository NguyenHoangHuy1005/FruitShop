const Product = require('../models/Product');

const productController = {
    // Tăng lượt xem sản phẩm
    increaseView: async (req, res) => {
        try {
            const productId = req.params.id;
            const product = await Product.findByIdAndUpdate(
                productId,
                { $inc: { viewCount: 1 } }, // đúng tên field
                { new: true }
            );
            if (!product) {
                return res.status(404).json({ message: "Không tìm thấy sản phẩm!" });
            }
            res.status(200).json({
                message: "Tăng lượt xem thành công!",
                viewCount: product.viewCount,
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    },
    // tăng lượt mua
    increasePurchase: async (req, res) => {
        try {
            const productId = req.params.id;
            const product = await Product.findByIdAndUpdate(
                productId,
                { $inc: { purchaseCount: 1 } }, // tăng purchaseCount
                { new: true }
            );

            if (!product) {
                return res.status(404).json({ message: "Không tìm thấy sản phẩm!" });
            }

            res.status(200).json({
                message: "Tăng lượt mua thành công!",
                purchaseCount: product.purchaseCount,
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    },


};

module.exports = productController;
