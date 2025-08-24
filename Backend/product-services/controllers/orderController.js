const Carts = require("../models/Carts");
const Order = require("../models/Order");
const { getOrCreateCart } = require("./cartController");

// Tính tổng tiền đơn
function calcTotals(cart) {
    const subtotal = cart.summary?.subtotal || 0;
    const shipping = 0;  // tuỳ chính sách
    const discount = 0;  // áp mã giảm giá nếu có
    const total = Math.max(0, subtotal + shipping - discount);
    return { subtotal, shipping, discount, total };
}

exports.createOrder = async (req, res) => {
    try {
        const { name, fullName, address, phone, email, note } = req.body || {};
        const customerName = name || fullName;

        if (!customerName || !address || !phone || !email) {
        return res.status(400).json({ message: "Vui lòng nhập đủ họ tên, địa chỉ, điện thoại, email." });
        }

        const cart = await getOrCreateCart(req, res);
        if (!cart?.items?.length) {
        return res.status(400).json({ message: "Giỏ hàng đang trống." });
        }

        const amount = calcTotals(cart);

        const order = await Order.create({
        user: cart.user || null,
        customer: { name: customerName, address, phone, email, note: note || "" },
        items: cart.items.map(i => ({
            product: i.product,
            name:    i.name,
            image:   i.image,      // Mixed/string đều ok nếu schema OrderItem dùng Mixed
            price:   i.price,
            quantity:i.quantity,
            total:   i.total,
        })),
        amount,
        status:  "pending",
        payment: "COD",
        });

        // Đóng giỏ cũ
        cart.status = "ordered";
        await cart.save();

        // Tạo giỏ mới "active" và GÁN COOKIE CART_ID mới
        const newCart = await Carts.create({
        user: cart.user || null,
        cartKey: cart.cartKey || null,
        status: "active",
        items: [],
        summary: { totalItems: 0, subtotal: 0 },
        });
        res.cookie("CART_ID", newCart._id.toString(), { httpOnly: true, sameSite: "Lax" });

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

exports.myOrders = async (req, res) => {
    // Nếu có verifyToken thì lấy từ req.user; ở đây đọc tạm từ header "token"
    let userId = null;
    try {
        const raw =
        req.headers?.authorization ||
        req.headers?.Authorization ||
        req.headers?.token;
        const token = raw?.split(" ")?.[1];
        if (token && process.env.JWT_SECRET) {
        const jwt = require("jsonwebtoken");
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        userId = payload?.id || payload?._id || null;
        }
    } catch (_) {}

    if (!userId) {
        return res.status(401).json({ message: "Cần đăng nhập để xem đơn hàng của bạn." });
    }

    const orders = await Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .lean();

    return res.json(orders);
};
