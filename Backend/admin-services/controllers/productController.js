const Product = require('../models/Product');

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

            res.status(201).json(savedProduct);
        } catch (err) {
            res.status(500).json({ message: "Lỗi thêm sản phẩm", error: err.message });
        }
    },
   // Lấy danh sách sản phẩm (xáo trộn bằng JS)
getAllProducts: async (req, res) => {
    try {
        let products = await Product.find();

        // Shuffle (Fisher-Yates)
        for (let i = products.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [products[i], products[j]] = [products[j], products[i]];
        }

        res.status(200).json(products);
    } catch (err) {
        res.status(500).json({ 
            message: "Lỗi lấy danh sách sản phẩm", 
            error: err.message 
        });
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


};
module.exports = productControllers;