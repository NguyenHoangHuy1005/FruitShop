const Product = require('../models/Product');
const Stock = require('../../product-services/models/Stock');

// helper: clamp %
const clampPercent = (n) => {
    n = Number.isFinite(+n) ? +n : 0;
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    return Math.floor(n);
};

// helper: normalize body trước khi lưu/cập nhật
const normalizePayload = (body) => {
    const out = { ...body };

    // price về số >=0
    if (out.price !== undefined) {
        const p = Number(out.price);
        out.price = Number.isFinite(p) && p >= 0 ? p : 0;
    }

    // discountPercent 0..100
    if (out.discountPercent !== undefined) {
        out.discountPercent = clampPercent(out.discountPercent);
    }

    // image: cho phép FE gửi string -> ép thành [string]
    if (typeof out.image === "string" && out.image.trim()) {
        out.image = [out.image.trim()];
    }

    return out;
};

const productControllers = {
    // Thêm sản phẩm
    creatProduct: async (req, res) => {
        try {
            // Lấy tên sản phẩm từ body
            const { name } = req.body;

            // Kiểm tra trùng tên (không phân biệt hoa thường)
            const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
            if (existingProduct) {
                return res.status(400).json({ message: "Sản phẩm đã tồn tại!" });
            }

            // Tạo sản phẩm mới
            const newProduct = new Product(req.body);
            const savedProduct = await newProduct.save();

            // 🔥 Tự động tạo Stock với số lượng 0
            await Stock.findOneAndUpdate(
                { product: savedProduct._id },
                { $setOnInsert: { product: savedProduct._id, onHand: 0 } },
                { upsert: true, new: true }
            );

            res.status(201).json(savedProduct);
        } catch (err) {
            res.status(500).json({ message: "Lỗi thêm sản phẩm", error: err.message });
        }
    },
    // Lấy danh sách sản phẩm (xáo trộn bằng JS)
    getAllProducts: async (req, res) => {
        try {
            // If admin=1 is present in query params, return all products (for admin pages).
            // Otherwise return only published products for public pages.
            const isAdminView = String(req.query.admin || "") === "1";

            // Build aggregation pipeline
            const pipeline = [];
            if (!isAdminView) {
                // filter only published products for public requests
                pipeline.push({ $match: { published: true } });
            }

            pipeline.push(
                {
                    $lookup: {
                        from: "stocks",
                        localField: "_id",
                        foreignField: "product",
                        as: "stock"
                    }
                },
                {
                    $addFields: {
                        onHand: { $ifNull: [{ $arrayElemAt: ["$stock.onHand", 0] }, 0] },
                        status: {
                            $cond: [
                                {
                                    $gt: [
                                        { $ifNull: [{ $arrayElemAt: ["$stock.onHand", 0] }, 0] },
                                        0
                                    ]
                                },
                                "Còn hàng",
                                "Hết hàng"
                            ]
                        }
                    }
                },
                { $project: { stock: 0 } }
            );

            let products = await Product.aggregate(pipeline);

            // 🔥 Kiểm tra và reset giảm giá hết hạn
            const now = new Date();
            const expiredProducts = [];

            for (const product of products) {
                // Nếu có discountEndDate và đã hết hạn
                if (product.discountEndDate && new Date(product.discountEndDate) < now && product.discountPercent > 0) {
                    expiredProducts.push(product._id);
                    product.discountPercent = 0; // Reset trong response
                    product.discountStartDate = null;
                    product.discountEndDate = null;
                }
            }

            // Cập nhật DB cho các sản phẩm hết hạn (async, không chặn response)
            if (expiredProducts.length > 0) {
                Product.updateMany(
                    { _id: { $in: expiredProducts } },
                    { $set: { discountPercent: 0, discountStartDate: null, discountEndDate: null } }
                ).catch(err => console.error("Error resetting expired discounts:", err));
            }

            // shuffle nếu cần
            for (let i = products.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [products[i], products[j]] = [products[j], products[i]];
            }

            return res.status(200).json(products);
        } catch (err) {
            return res
                .status(500)
                .json({ message: "Lỗi lấy danh sách sản phẩm", error: err.message });
        }
    },





    // Xóa sản phẩm
    deleteProduct: async (req, res) => {
        try {
            const product = await Product.findByIdAndDelete(req.params.id);
            if (!product) {
                return res.status(404).json({ message: "Sản phẩm không tồn tại!" });
            }
            res.status(200).json({ message: "Sản phẩm đã được xóa!" });
        } catch (err) {
            res.status(500).json({ message: "Lỗi xóa sản phẩm!", error: err.message });
        }
    },

    // Cập nhật sản phẩm
    updateProduct: async (req, res) => {
        try {
            const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!updatedProduct) {
                return res.status(404).json({ message: "Sản phẩm không tồn tại!" });
            }
            res.status(200).json(updatedProduct);
        } catch (err) {
            res.status(500).json({ message: "Lỗi cập nhật sản phẩm!", error: err.message });
        }
    },
    
    // Tìm sản phẩm theo tên
    searchProductByName: async (req, res) => {
        try {
            const name = req.query.name; // lấy từ query string

            if (!name) {
                return res.status(400).json({ message: "Vui lòng nhập tên sản phẩm cần tìm!" });
            }
            // Tìm sản phẩm có tên chứa từ khóa (không phân biệt hoa thường)
            const products = await Product.find({
                name: { $regex: name, $options: "i" }
            });

            if (products.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy sản phẩm!" });
            }

            res.status(200).json(products);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    },

    // Lấy sản phẩm theo category
    getProductByCategory: async (req, res) => {
        try {
            const categoryName = req.query.categoryName; // lấy từ query
            const products = await Product.find({ category: categoryName });
            // Nếu không có sản phẩm nào
            if (!products || products.length === 0) {
                return res.status(404).json({
                    message: "Không tìm thấy sản phẩm trong danh mục này!"
                });
            }
            res.status(200).json(products);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    },

    // 🔥 NEW: Giảm giá hàng loạt
    bulkDiscount: async (req, res) => {
        try {
            const { productIds, discountPercent, discountStartDate, discountEndDate } = req.body;

            if (!Array.isArray(productIds) || productIds.length === 0) {
                return res.status(400).json({ message: "Vui lòng chọn ít nhất 1 sản phẩm!" });
            }

            const percent = clampPercent(discountPercent);

            // Chuẩn bị update object
            const updateData = { discountPercent: percent };

            // Xử lý ngày bắt đầu và kết thúc
            if (discountStartDate) {
                updateData.discountStartDate = new Date(discountStartDate);
            } else {
                updateData.discountStartDate = null;
            }

            if (discountEndDate) {
                updateData.discountEndDate = new Date(discountEndDate);
            } else {
                updateData.discountEndDate = null;
            }

            const result = await Product.updateMany(
                { _id: { $in: productIds } },
                { $set: updateData }
            );

            res.status(200).json({
                message: `Đã áp dụng giảm giá ${percent}% cho ${result.modifiedCount} sản phẩm!`,
                modifiedCount: result.modifiedCount
            });
        } catch (err) {
            res.status(500).json({ message: "Lỗi giảm giá hàng loạt!", error: err.message });
        }
    },

    // Bật/tắt hiển thị sản phẩm cho trang người dùng
    togglePublish: async (req, res) => {
        try {
            const productId = req.params.id;
            const { publish } = req.body;

            const product = await Product.findById(productId);
            if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });

            // Nếu đang bật (publish = true), kiểm tra điều kiện:
            // - Phải có lô hàng (ImportItem)
            // - Giá bán (product.price) phải khác với giá nhập (latest ImportItem.unitPrice)
            if (publish === true) {
                const ImportItem = require("../../admin-services/models/ImportItem");
                const latest = await ImportItem.find({ product: productId }).sort({ importDate: -1 }).limit(1).lean();
                if (!latest || latest.length === 0) {
                    return res.status(400).json({ message: 'Sản phẩm chưa có lô hàng nên không thể bật hiển thị' });
                }
                const latestBatch = latest[0];
                const unitPrice = Number(latestBatch.unitPrice || 0);
                const selling = Number(product.price || 0);
                if (selling === unitPrice) {
                    return res.status(400).json({ message: 'Giá bán chưa khác giá nhập, không thể bật hiển thị' });
                }
            }

            product.published = !!publish;
            await product.save();
            return res.json({ ok: true, published: product.published });
        } catch (err) {
            console.error('togglePublish error:', err);
            return res.status(500).json({ message: 'Lỗi khi thay đổi trạng thái hiển thị', error: err.message });
        }
    },


};
module.exports = productControllers;