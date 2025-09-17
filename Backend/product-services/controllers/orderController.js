// product-services/controllers/orderController.js
const crypto = require("crypto"); // đầu file
const Carts = require("../models/Carts");
const Order = require("../models/Order");
const { getOrCreateCart } = require("./cartController");
const jwt = require("jsonwebtoken");
const Product = require("../../admin-services/models/Product");
// mới đây nè
const Stock = require("../models/Stock");


// ==== helper dùng chung ====
const readBearer = (req) => {
    const raw = req.headers?.authorization || req.headers?.Authorization || req.headers?.token || "";
    if (typeof raw !== "string") return "";
    const t = raw.trim();
    return t.toLowerCase().startsWith("bearer ") ? t.slice(7).trim() : t;
};
const JWT_SECRET = process.env.JWT_ACCESS_KEY || process.env.JWT_SECRET;

// Tính tổng tiền đơn
// Tính tổng tiền đơn (theo giỏ)
function calcTotals(cart) {
    let subtotal = 0;
    let totalItems = 0;
    for (const it of cart.items) {
        subtotal += (Number(it.price) || 0) * (Number(it.quantity) || 1);
        totalItems += Number(it.quantity) || 0;
    }
    const shipping = 0;
    const discount = 0;
    const total = Math.max(0, subtotal + shipping - discount);
    return { subtotal, shipping, discount, total, totalItems };
}


exports.createOrder = async (req, res) => {
    try {
        let userId = null;
        const token = readBearer(req);
        if (token && JWT_SECRET) {
            try {
                const payload = jwt.verify(token, JWT_SECRET);
                userId = payload?.id || payload?._id || null;
            } catch (_) { }
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

        // gắn user cho giỏ nếu có
        if (!cart.user && userId) cart.user = userId;

        // Tổng tiền hiện tại từ giỏ
        const amount = calcTotals(cart);

        // ===== 1) Trừ kho nguyên tử từng dòng, rollback nếu thiếu =====
        const decremented = []; // lưu để hoàn kho nếu lỗi
        for (const line of cart.items) {
            const qty = Number(line.quantity) || 1;

            // yêu cầu đủ tồn: onHand >= qty
            const updated = await Stock.findOneAndUpdate(
                { product: line.product, onHand: { $gte: qty } },
                { $inc: { onHand: -qty } },
                { new: true }
            );

            if (!updated) {
                // rollback những gì đã trừ
                for (const d of decremented) {
                    await Stock.findOneAndUpdate({ product: d.product }, { $inc: { onHand: d.qty } });
                }
                return res.status(409).json({ message: `Sản phẩm "${line.name}" không đủ tồn kho.` });
            }

            decremented.push({ product: line.product, qty });

            // cập nhật trạng thái sản phẩm theo onHand mới
            try {
                const newQty = Math.max(0, Number(updated.onHand) || 0);
                await Product.findByIdAndUpdate(
                    line.product,
                    { $set: { onHand: newQty, status: newQty > 0 ? "Còn hàng" : "Hết hàng" } },
                    { new: false }
                );
            } catch (_) { }
        }

        // ===== 2) Rebuild items (đảm bảo giá cuối) =====
        const items = await Promise.all(cart.items.map(async (i) => {
            const product = await Product.findById(i.product).lean();
            if (!product) {
                // fallback nếu product bị xóa
                const q = Number(i.quantity) || 1;
                const price = Number(i.price) || 0;
                return {
                    product: i.product,
                    name: i.name,
                    image: Array.isArray(i.image) ? i.image : [i.image].filter(Boolean),
                    price,
                    quantity: q,
                    total: price * q,
                };
            }
            const pct = Number(product.discountPercent) || 0;
            const finalPrice = Math.max(0, Math.round((Number(product.price) || 0) * (100 - pct) / 100));
            const q = Number(i.quantity) || 1;
            return {
                product: product._id,
                name: product.name,
                image: Array.isArray(i.image) ? i.image : [i.image].filter(Boolean),
                price: finalPrice,
                quantity: q,
                total: finalPrice * q,
            };
        }));

        // ===== 3) Tạo đơn =====
        const order = await Order.create({
            user: userId || cart.user || null,
            customer: { name: customerName, address, phone, email, note: note || "" },
            items,
            amount,
            status: "pending",
            payment: "COD",
        });
        // BỔ SUNG: tăng purchaseCount sau khi tạo đơn thành công <<<
        const purchaseCount = items.map((item) => ({
            updateOne: {
                filter: { _id: item.product },
                update: { $inc: { purchaseCount: item.quantity } },
            },
        }));
        if (purchaseCount.length > 0) {
            await Product.bulkWrite(purchaseCount);
        }
        // ===== 4) Đổi trạng thái giỏ & phát sinh giỏ mới =====
        cart.status = "ordered";
        await cart.save();

        const newCart = await Carts.create({
            user: cart.user || null,
            cartKey: crypto.randomUUID(),
            status: "active",
            items: [],
            summary: { totalItems: 0, subtotal: 0 },
        });

        // set lại cookie CART_ID = cartKey mới
        res.cookie("CART_ID", newCart.cartKey, {
            httpOnly: true,
            sameSite: "lax",
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

// ===== Admin APIs =====
exports.adminList = async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { status, q, user, from, to } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (user) filter.user = user;

    if (q && q.trim()) {
        const esc = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = new RegExp(esc, "i");
        filter.$or = [
            { "customer.name": rx },
            { "customer.phone": rx },
            { "customer.email": rx },
            { "items.name": rx },
        ];
    }

    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }

    const [total, rows] = await Promise.all([
        Order.countDocuments(filter),
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.json({
        page, limit, total, pages: Math.ceil(total / limit) || 1,
        data: rows,
    });
};

exports.adminGetOne = async (req, res) => {
    const doc = await Order.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    return res.json(doc);
};

exports.adminUpdate = async (req, res) => {
    const { status, payment } = req.body || {};
    const update = {};
    if (status) update.status = status;   // pending|paid|shipped|completed|cancelled
    if (payment) update.payment = payment; // COD|BANK|VNPAY
    if (!Object.keys(update).length) {
        return res.status(400).json({ message: "Không có trường nào để cập nhật." });
    }
    const doc = await Order.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true, runValidators: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    return res.json({ ok: true, data: doc });
};
// PATCH /order/:id/status
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowed = ["pending", "paid", "shipped", "completed", "cancelled"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: "Trạng thái không hợp lệ." });
        }

        const order = await Order.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
        }

        return res.json(order);
    } catch (err) {
        console.error("updateOrderStatus error:", err);
        return res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái." });
    }
};

