// product-services/controllers/orderController.js
const Carts = require("../models/Carts");
const Order = require("../models/Order");
const { getOrCreateCart } = require("./cartController");
const jwt = require("jsonwebtoken");


// ==== helper dùng chung ====
const readBearer = (req) => {
    const raw = req.headers?.authorization || req.headers?.Authorization || req.headers?.token || "";
    if (typeof raw !== "string") return "";
    const t = raw.trim();
    return t.toLowerCase().startsWith("bearer ") ? t.slice(7).trim() : t;
};
const JWT_SECRET = process.env.JWT_ACCESS_KEY || process.env.JWT_SECRET;

// Tính tổng tiền đơn
function calcTotals(cart) {
    const subtotal = cart.summary?.subtotal || 0;
    const shipping = 0;
    const discount = 0;
    const total = Math.max(0, subtotal + shipping - discount);
    return { subtotal, shipping, discount, total };
}

exports.createOrder = async (req, res) => {
    try {
        let userId = null;
        const token = readBearer(req);              // <— thay ở đây
        if (token && JWT_SECRET) {
            try {
                const payload = jwt.verify(token, JWT_SECRET);
                userId = payload?.id || payload?._id || null;
            } catch (_) {}
        }

        const { name, fullName, address, phone, email, note } = req.body || {};
        const customerName = name || fullName;

        if (!customerName || !address || !phone || !email) {
        return res.status(400).json({ message: "Vui lòng nhập đủ họ tên, địa chỉ, điện thoại, email." });
        }

        const cart = await getOrCreateCart(req, res);
        if (!cart?.items?.length) {
        return res.status(400).json({ message: "Giỏ hàng đang trống." });
        }

        // Gắn user cho giỏ nếu đang thiếu
        if (!cart.user && userId) cart.user = userId;

        const amount = calcTotals(cart);

        const order = await Order.create({
        user: userId || cart.user || null,
        customer: { name: customerName, address, phone, email, note: note || "" },
        items: cart.items.map((i) => ({
            product: i.product,
            name: i.name,
            // nếu i.image là mảng → lấy phần tử đầu, tránh lỗi cast
            image: Array.isArray(i.image) ? (i.image[0] || "") : (i.image || ""),
            price: Number(i.price) || 0,
            quantity: Number(i.quantity) || 1,
            total: typeof i.total === "number" ? i.total : ((Number(i.price) || 0) * (Number(i.quantity) || 1)),
        })),
        amount,
        status: "pending",
        payment: "COD",
        });

        cart.status = "ordered";
        await cart.save();

        const newCart = await Carts.create({
        user: cart.user || null,
        cartKey: cart.cartKey || null,
        status: "active",
        items: [],
        summary: { totalItems: 0, subtotal: 0 },
        });

        res.cookie("CART_ID", newCart._id.toString(), {
        httpOnly: true,
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        });

        return res.status(201).json({
        ok: true,
        message: "Đặt hàng thành công!",
        orderId: order._id,
        amount,
        createdAt: order.createdAt,
        });
    } catch (e) {
        console.error("createOrder error:", e);
        return res.status(500).json({ message: "Tạo đơn thất bại." });
    }
};


// ===== SỬA Ở ĐÂY: verify bằng JWT_ACCESS_KEY và lấy Bearer chuẩn =====
exports.myOrders = async (req, res) => {
    const token = readBearer(req);                // <— dùng helper
    if (!token) return res.status(401).json({ message: "Cần đăng nhập để xem đơn hàng của bạn." });
    if (!JWT_SECRET) return res.status(500).json({ message: "Thiếu JWT_ACCESS_KEY trên server." });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const userId = payload?.id || payload?._id || null;
        if (!userId) return res.status(401).json({ message: "Phiên đăng nhập hết hạn hoặc token không hợp lệ." });

        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).lean();
        return res.json(orders);
    } catch {
        return res.status(401).json({ message: "Phiên đăng nhập hết hạn hoặc token không hợp lệ." });
    }
};

