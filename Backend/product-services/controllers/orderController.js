// product-services/controllers/orderController.js
const crypto = require("crypto"); // đầu file
const Carts = require("../models/Carts");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const Stock = require("../models/Stock");
const { sendOrderConfirmationMail } = require("../../auth-services/utils/mailer");
const { getOrCreateCart } = require("./cartController");
const jwt = require("jsonwebtoken");
const Product = require("../../admin-services/models/Product");


// ==== helper dùng chung ====
const readBearer = (req) => {
    const raw = req.headers?.authorization || req.headers?.Authorization || req.headers?.token || "";
    if (typeof raw !== "string") return "";
    const t = raw.trim();
    return t.toLowerCase().startsWith("bearer ") ? t.slice(7).trim() : t;
};
const JWT_SECRET = process.env.JWT_ACCESS_KEY || process.env.JWT_SECRET;

// Tính tổng tiền đơn (theo giỏ)
async function calcTotals(cart, couponCode) {
    let subtotal = 0, totalItems = 0;
    for (const it of cart.items) {
        subtotal += (Number(it.price) || 0) * (Number(it.quantity) || 1);
        totalItems += Number(it.quantity) || 0;
    }

    const SHIPPING_FEE = 30000;
    const shipping = subtotal >= 199000 ? 0 : SHIPPING_FEE;

    let discount = 0;
    let couponApplied = false;
    if (couponCode) {
        const coupon = await Coupon.findOne({
            code: { $regex: new RegExp("^" + couponCode.trim() + "$", "i") },
            active: true
        });
        const now = new Date();
        if (
            coupon &&
            now >= coupon.startDate && now <= coupon.endDate &&
            (coupon.usageLimit === 0 || coupon.usedCount < coupon.usageLimit) &&
            subtotal >= (coupon.minOrder || 0)
        ) {
            if (coupon.discountType === "percent") {
                discount = Math.min(subtotal, Math.round(subtotal * coupon.value / 100));
            } else if (coupon.discountType === "fixed") {
                discount = Math.min(subtotal, coupon.value);
            }
            couponApplied = discount > 0;
        }
    }

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

        const { name, fullName, address, phone, email, note, couponCode } = req.body || {};
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
        const amount = await calcTotals(cart, couponCode);

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

        // (3.1) Commit coupon usage SAU khi tạo đơn thành công
        if (couponCode && amount.discount > 0) {
            try {
                const code = String(couponCode).trim();
                const now = new Date();
                const updatedCoupon = await Coupon.findOneAndUpdate(
                    {
                        code: { $regex: new RegExp("^" + code + "$", "i") },
                        active: true,
                        startDate: { $lte: now },
                        endDate:   { $gte: now },
                        $or: [
                        { usageLimit: 0 },
                        { $expr: { $lt: ["$usedCount", "$usageLimit"] } }
                        ],
                    },
                    { $inc: { usedCount: 1 } },
                    { new: false }
                );
                if (!updatedCoupon) {
                    console.warn("[coupon] commit skipped: not matched (possibly exhausted or inactive)");
                }
            } catch (err) {
                console.warn("[coupon] commit failed:", err?.message || err);
            }
        }
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

        const payload = {
            id: order._id,
            createdAt: order.createdAt,
            items,
            amount,
            couponCode: (req.body?.couponCode || "").trim(),
            customer: { name: customerName, address, phone, email, note: note || "" },
        };
        const opts = {
            shopName: process.env.SHOP_NAME || "FruitShop",
            supportEmail: process.env.SHOP_SUPPORT_EMAIL || process.env.MAIL_FROM || process.env.MAIL_USER,
            baseUrl: process.env.APP_BASE_URL || "", // VD: https://fruitshop.example.com
        };

        // không await để tránh chậm phản hồi
        sendOrderConfirmationMail(email, customerName, payload, opts)
        .then((ok) => !ok && console.warn("[mailer] sendOrderConfirmationMail returned false"))
        .catch((err) => console.error("[mailer] sendOrderConfirmationMail failed:", err?.message || err));

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

// USer hủy đơn (chỉ được hủy đơn của mình, và chỉ khi đơn đang pending)
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || null; // lấy từ token (middleware verifyToken)

        const order = await Order.findOne({ _id: id, user: userId });
        if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

        if (order.status !== "pending") {
        return res.status(400).json({ message: "Đơn hàng không thể hủy ở trạng thái hiện tại." });
        }

        // 🔄 Trả lại tồn kho
        for (const it of order.items) {
        await Stock.findOneAndUpdate(
            { product: it.product },
            { $inc: { onHand: it.quantity } }
        );

        // cập nhật Product.onHand và status
        const stock = await Stock.findOne({ product: it.product });
        const newQty = Math.max(0, Number(stock?.onHand) || 0);
        await Product.findByIdAndUpdate(
            it.product,
            { $set: { onHand: newQty, status: newQty > 0 ? "Còn hàng" : "Hết hàng" } }
        );
        }

        // 🔴 Đổi trạng thái đơn
        order.status = "cancelled";
        await order.save();

        return res.json({ ok: true, message: "Đơn hàng đã được hủy.", order });
    } catch (err) {
        console.error("cancelOrder error:", err);
        return res.status(500).json({ message: "Lỗi server khi hủy đơn hàng." });
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

// Thống kê cho admin
exports.adminStats = async (req, res) => {
    try {
        // Lấy tất cả đơn (chỉ completed/paid mới tính doanh thu)
        const orders = await Order.find().lean();

        const totalRevenue = orders
        .filter(o => ["paid", "shipped", "completed"].includes(o.status))
        .reduce((sum, o) => sum + (o.amount?.total || 0), 0);

        const countOrders = orders.length;

        // Gom theo trạng thái
        const orderByStatus = {};
        for (const o of orders) {
        orderByStatus[o.status] = (orderByStatus[o.status] || 0) + 1;
        }

        // Gom theo tháng (YYYY-MM)
        const revenueByMonth = {};
        for (const o of orders) {
        const d = new Date(o.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!revenueByMonth[key]) revenueByMonth[key] = 0;
        if (["paid", "shipped", "completed"].includes(o.status)) {
            revenueByMonth[key] += o.amount?.total || 0;
        }
        }

        // Top sản phẩm
        const productMap = {};
        for (const o of orders) {
        for (const it of o.items) {
            productMap[it.name] = (productMap[it.name] || 0) + (it.quantity || 0);
        }
        }
        const topProducts = Object.entries(productMap)
        .map(([name, sales]) => ({ name, sales }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

        return res.json({
        totalRevenue,
        countOrders,
        orderByStatus,
        revenueByMonth,
        topProducts,
        });
    } catch (err) {
        console.error("adminStats error:", err);
        return res.status(500).json({ message: "Lỗi server khi thống kê." });
    }
};




