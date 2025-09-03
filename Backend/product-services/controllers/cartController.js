const crypto = require("crypto");
const Carts = require("../models/Carts");
const Product = require("../../admin-services/models/Product");

// Optional: lấy userId từ JWT
function getUserIdFromToken(req) {
    try {
        const raw =
            req.headers?.authorization ||
            req.headers?.Authorization ||
            req.headers?.token; // FE đang dùng 'token'
        const token = raw?.split(" ")?.[1];
        if (!token) return null;

        const jwt = require("jsonwebtoken");
        // ⚡ phải verify bằng ACCESS_KEY, không phải JWT_SECRET
        const payload = jwt.verify(token, process.env.JWT_ACCESS_KEY);

        return payload?.id || payload?._id || null;
    } catch (_) {
        return null;
    }
}


function ensureCartCookie(req, res) {
    let cartKey = req.cookies?.CART_ID;
    if (!cartKey) {
        cartKey = crypto.randomUUID();
        res.cookie("CART_ID", cartKey, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,               // đổi true nếu chạy https
        maxAge: 1000 * 60 * 60 * 24 * 30,
        });
    }
    return cartKey;
}

async function getOrCreateCart(req, res) {
    const userId = getUserIdFromToken(req);
    const cartKey = ensureCartCookie(req, res);

    let cart = null;

    if (userId) {
        // ưu tiên giỏ user
        cart = await Carts.findOne({ user: userId, status: "active" });
        if (!cart) {
            cart = await Carts.create({
                user: userId,
                cartKey,   // ⚡ luôn gắn cartKey để tracking session song song
                items: [],
                summary: { totalItems: 0, subtotal: 0 },
            });
        }
    } else {
        // guest
        cart = await Carts.findOne({ cartKey, status: "active" });
        if (!cart) {
            cart = await Carts.create({
                cartKey,
                items: [],
                summary: { totalItems: 0, subtotal: 0 },
            });
        }
    }

    return cart;
}



function recalc(cart) {
    let totalItems = 0, subtotal = 0;
    for (const it of cart.items) {
        it.total = it.price * it.quantity;
        totalItems += it.quantity;
        subtotal += it.total;
    }
    cart.summary.totalItems = totalItems;
    cart.summary.subtotal = subtotal;
}

exports.getCart = async (req, res) => {
    const cart = await getOrCreateCart(req, res);
    return res.json(cart);
};

// ====== addItem (chỉ sửa phần push) ======
exports.addItem = async (req, res) => {
    const { productId, quantity } = req.body || {};
    const qty = Math.max(1, Number(quantity) || 1);

    const cart = await getOrCreateCart(req, res);
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ message: "Sản phẩm không tồn tại." });

    const idx = cart.items.findIndex(i => String(i.product) === String(product._id));
    if (idx >= 0) {
        cart.items[idx].quantity += qty;
    } else {
        cart.items.push({
        product: product._id,
        name: product.name,
        // ✅ ép về string để tránh lỗi Cast to string failed (khi product.image là mảng)
        image: Array.isArray(product.image) ? (product.image[0] || "") : (product.image || ""),
        price: Number(product.price) || 0,
        quantity: qty,
        total: 0,
        });
    }
    recalc(cart);
    await cart.save();
    return res.json(cart);
};


// ====== updateItem (vá khớp ID mọi kiểu) ======
exports.updateItem = async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body || {};
    const qty = Math.max(0, Number(quantity) || 0);

    const cart = await getOrCreateCart(req, res);

    // ✅ Tìm item bằng equals() hoặc toString()
    const item = cart.items.find((i) =>
        (i.product?.equals && i.product.equals(productId)) ||
        i.product?.toString?.() === String(productId)
    );

    if (!item) {
        return res.status(404).json({ message: "Item không có trong giỏ." });
    }

    if (qty === 0) {
        // xoá item
        cart.items = cart.items.filter((i) => i !== item);
    } else {
        item.quantity = qty;
    }

    recalc(cart);
    await cart.save();
    return res.json(cart);
};


exports.removeItem = async (req, res) => {
    try {
        const { productId } = req.params;
        const cart = await getOrCreateCart(req, res);
        const before = cart.items.length;

        // ⚡ lọc item ra khỏi mảng
        cart.items = cart.items.filter(
            (i) => String(i.product) !== String(productId)
        );

        if (before === cart.items.length) {
            return res.status(404).json({ message: "Item không có trong giỏ." });
        }

        // tính lại tổng
        recalc(cart);
        await cart.save();   // ✅ bắt buộc để ghi xuống MongoDB

        return res.json(cart);
    } catch (err) {
        console.error("removeItem error:", err);
        return res.status(500).json({ message: "Lỗi server khi xóa item." });
    }
};


exports.clearCart = async (req, res) => {
    try {
        const cart = await getOrCreateCart(req, res);

        // ⚡ clear hết items
        cart.items = [];

        recalc(cart); // đặt lại summary về 0
        await cart.save();   // ✅ lưu DB

        return res.json(cart);
    } catch (err) {
        console.error("clearCart error:", err);
        return res.status(500).json({ message: "Lỗi server khi xóa giỏ." });
    }
};


exports.getOrCreateCart = getOrCreateCart;
