const Product = require('../models/Product');



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
    // Lấy danh sách sản phẩm
    getAllProducts: async (req, res) => {
        try {
            const products = await Product.find();
            res.status(200).json(products);
        } catch (err) {
            res.status(500).json({ message: "Lỗi lấy danh sách sản phẩm", error: err.message });
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