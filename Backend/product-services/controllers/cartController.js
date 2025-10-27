const crypto = require("crypto");
const Carts = require("../models/Carts");
const Product = require("../../admin-services/models/Product");
//mơi đây nè
const Stock = require("../models/Stock");

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


// ====== addItem (đã chỉnh giá giảm + kiểm tồn) ======
exports.addItem = async (req, res) => {
    const { productId, quantity } = req.body || {};
    const qty = Math.max(1, Number(quantity) || 1);

    const cart = await getOrCreateCart(req, res);
    let product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ message: "Sản phẩm không tồn tại." });

    // 🔥 Kiểm tra và reset giảm giá hết hạn
    const now = new Date();
    if (product.discountEndDate && new Date(product.discountEndDate) < now && product.discountPercent > 0) {
        // Reset giảm giá hết hạn
        await Product.findByIdAndUpdate(productId, {
            $set: { discountPercent: 0, discountStartDate: null, discountEndDate: null }
        });
        product.discountPercent = 0;
        product.discountStartDate = null;
        product.discountEndDate = null;
    }

    // ✅ giá sau giảm
    const pct = Number(product.discountPercent) || 0;
    const finalPrice = Math.max(0, Math.round((Number(product.price) || 0) * (100 - pct) / 100));

    // ✅ kiểm tra tồn kho
    const stock = await Stock.findOne({ product: product._id }).lean();
    const onHand = Number(stock?.onHand) || 0;

    // số lượng SP này đang có trong giỏ
    const idx = cart.items.findIndex(i => String(i.product) === String(product._id));
    const currentInCart = idx >= 0 ? (Number(cart.items[idx].quantity) || 0) : 0;

    if (onHand <= 0) {
        return res.status(400).json({ message: "Sản phẩm đã hết hàng." });
    }

    const maxAdd = Math.max(0, onHand - currentInCart);
    if (qty > maxAdd) {
        if (maxAdd === 0) {
        return res.status(400).json({ message: "Số lượng trong giỏ đã đạt tối đa theo tồn kho." });
        }
        // Giới hạn theo tồn
        if (idx >= 0) {
        cart.items[idx].quantity += maxAdd;
        cart.items[idx].price = finalPrice;
        cart.items[idx].discountPercent = pct;
        cart.items[idx].unit = product.unit || "kg"; // ✅ Cập nhật unit
        } else {
        cart.items.push({
            product: product._id,
            name: product.name,
            image: Array.isArray(product.image) ? product.image.filter(Boolean) : [product.image].filter(Boolean),
            price: finalPrice,
            quantity: maxAdd,
            total: 0,
            discountPercent: pct,
            unit: product.unit || "kg", // ✅ Lưu đơn vị
        });
        }
    } else {
        // Thêm bình thường
        if (idx >= 0) {
        cart.items[idx].quantity += qty;
        cart.items[idx].price = finalPrice;
        cart.items[idx].discountPercent = pct;
        cart.items[idx].unit = product.unit || "kg"; // ✅ Cập nhật unit
        } else {
        cart.items.push({
            product: product._id,
            name: product.name,
            image: Array.isArray(product.image) ? product.image.filter(Boolean) : [product.image].filter(Boolean),
            price: finalPrice,
            quantity: qty,
            total: 0,
            discountPercent: pct,
            unit: product.unit || "kg", // ✅ Lưu đơn vị
        });
        }
    }

    recalc(cart);
    await cart.save();
    return res.json(cart);
};


// ====== updateItem (đã chỉnh giá giảm + kiểm tồn) ======
exports.updateItem = async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body || {};
    const qty = Math.max(0, Number(quantity) || 0);

    const cart = await getOrCreateCart(req, res);

    // ✅ tìm item trong giỏ
    const item = cart.items.find((i) =>
        (i.product?.equals && i.product.equals(productId)) ||
        i.product?.toString?.() === String(productId)
    );
    if (!item) {
        return res.status(404).json({ message: "Item không có trong giỏ." });
    }

    if (qty === 0) {
        cart.items = cart.items.filter((i) => i !== item);
    } else {
        // ✅ giá mới nhất
        const product = await Product.findById(productId).lean();
        if (product) {
        const pct = Number(product.discountPercent) || 0;
        const finalPrice = Math.max(0, Math.round((Number(product.price) || 0) * (100 - pct) / 100));
        item.price = finalPrice;
        item.discountPercent = pct;
        }

        // ✅ kiểm tồn & chặn vượt
        const stock = await Stock.findOne({ product: productId }).lean();
        const onHand = Number(stock?.onHand) || 0;

        if (qty > onHand) {
        if (onHand === 0) {
            cart.items = cart.items.filter((i) => i !== item); // hết hàng => xóa khỏi giỏ
        } else {
            item.quantity = onHand; // hạ về mức tồn
        }
        } else {
        item.quantity = qty;
        }
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
