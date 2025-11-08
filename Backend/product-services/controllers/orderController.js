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
const { createNotification } = require("../../auth-services/controllers/notificationController");

// Helper function to generate VietQR code
const generateVietQR = (order) => {
    const bankId = process.env.SEPAY_BANK_ID;
    const accountNo = process.env.SEPAY_ACCOUNT_NO; 
    const accountName = process.env.SEPAY_ACCOUNT_NAME;
    const template = process.env.SEPAY_QR_TEMPLATE || "compact2";

    const orderAmount = order.amount?.total || 0;
    const transferContent = `DH${String(order._id).slice(-8).toUpperCase()}`;

    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${orderAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;

    return {
        qrUrl,
        code: transferContent,
        reference: transferContent,
        bankId,
        accountNo,
        accountName,
        amount: orderAmount,
    };
};

// dùng trong controller
const escapeRegExp = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
// phí ship 30k
    const SHIPPING_FEE = 0;
    const shipping = subtotal >= 199000 ? 0 : SHIPPING_FEE;

    let discount = 0;
    let couponApplied = false;
    if (couponCode) {
        let coupon = null;
        if (couponCode && String(couponCode).trim()) {
            const rx = new RegExp(`^${escapeRegExp(String(couponCode).trim())}$`, "i");
            coupon = await Coupon.findOne({ code: rx, active: true }).lean();
        }
        const now = new Date();
        
        // 🔥 Kiểm tra coupon hợp lệ
        if (
            coupon &&
            now >= coupon.startDate && now <= coupon.endDate &&
            (coupon.usageLimit === 0 || coupon.usedCount < coupon.usageLimit)
        ) {
            // 🔥 Tính applicableSubtotal (chỉ tính sản phẩm được áp dụng)
            let applicableSubtotal = subtotal;
            
            if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
                // Có danh sách sản phẩm cụ thể => chỉ tính những sản phẩm đó
                const applicableProductIds = coupon.applicableProducts.map(id => String(id));
                applicableSubtotal = 0;
                
                for (const it of cart.items) {
                    const productId = String(it.product?._id || it.product);
                    if (applicableProductIds.includes(productId)) {
                        applicableSubtotal += (Number(it.price) || 0) * (Number(it.quantity) || 1);
                    }
                }
            }
            
            // Kiểm tra đơn tối thiểu
            if (applicableSubtotal >= (coupon.minOrder || 0)) {
                if (coupon.discountType === "percent") {
                    discount = Math.min(applicableSubtotal, Math.round(applicableSubtotal * coupon.value / 100));
                } else if (coupon.discountType === "fixed") {
                    discount = Math.min(applicableSubtotal, coupon.value);
                }
                couponApplied = discount > 0;
            }
        }
    }

    const total = Math.max(0, subtotal + shipping - discount);
    return { subtotal, shipping, discount, total, totalItems };
}


const restoreInventory = async (orderDoc) => {
    if (!orderDoc) return;
    for (const it of orderDoc.items || []) {
        await Stock.findOneAndUpdate(
            { product: it.product },
            { $inc: { onHand: it.quantity } }
        );

        const stock = await Stock.findOne({ product: it.product }).lean();
        const newQty = Math.max(0, Number(stock?.onHand) || 0);
        await Product.findByIdAndUpdate(
            it.product,
            { $set: { onHand: newQty, status: newQty > 0 ? "Còn hàng" : "Hết hàng" } }
        );
    }
};

const autoCancelExpiredOrders = async (extraFilter = {}) => {
    const now = new Date();
    const filter = {
        status: "pending",
        paymentDeadline: { $ne: null, $lte: now },
        ...extraFilter,
    };

    const expiredOrders = await Order.find(filter);
    if (!expiredOrders.length) return [];

    const updatedIds = [];
    for (const order of expiredOrders) {
        try {
            await restoreInventory(order);
        } catch (err) {
            console.error("[order] restoreInventory failed while auto-cancelling:", err);
        }

        order.status = "cancelled";
        order.paymentDeadline = null;
        order.paymentMeta = {
            ...(order.paymentMeta || {}),
            autoCancelledAt: new Date(),
            cancelReason: "timeout",
        };
        try {
            order.markModified("paymentMeta");
        } catch (_) { }
        try {
            await order.save();
            updatedIds.push(order._id);
        } catch (err) {
            console.error("[order] autoCancelExpiredOrders save error:", err);
        }
    }

    return updatedIds;
};


exports.createOrder = async (req, res) => {
    let decremented = [];
    let createdOrder = null;

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
        const paymentMethodRaw = (req.body?.paymentMethod || req.body?.payment || "").toString().toUpperCase();
        const allowedMethods = ["COD", "BANK", "VNPAY"];
        const paymentMethod = allowedMethods.includes(paymentMethodRaw) ? paymentMethodRaw : "COD";
        const customerName = name || fullName;

        if (!customerName || !address || !phone || !email) {
            return res.status(400).json({ message: "Vui lòng nhập đủ họ tên, địa chỉ, điện thoại, email." });
        }

        const cart = await getOrCreateCart(req, res);
        // chỉ thanh toán theo danh sách được chọn (nếu có)
        const selectedIds = Array.isArray(req.body?.selectedProductIds)
            ? req.body.selectedProductIds.map(String)
            : null;

        let workingItems = cart.items;
        if (selectedIds && selectedIds.length > 0) {
            workingItems = cart.items.filter(i => {
                const pid = String(i.product?._id || i.product);
                return selectedIds.includes(pid);
            });
            if (!workingItems.length) {
                return res.status(400).json({ message: "Không có sản phẩm nào để đặt hàng." });
            }
        }


        if (!cart?.items?.length) {
            return res.status(400).json({ message: "Giỏ hàng đang trống." });
        }

        // gắn user cho giỏ nếu có
        if (!cart.user && userId) cart.user = userId;

        // Tổng tiền hiện tại từ giỏ
        const amount = await calcTotals({ items: workingItems }, couponCode);

        // ===== 1) Trừ kho nguyên tử từng dòng, rollback nếu thiếu =====
        for (const line of workingItems) {
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
        const items = await Promise.all(workingItems.map(async (i) => {
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
        const paymentDeadline = paymentMethod === "COD" ? null : new Date(Date.now() + 10 * 60 * 1000);

        const order = await Order.create({
            user: userId || cart.user || null,
            customer: { name: customerName, address, phone, email, note: note || "" },
            items,
            amount,
            status: "pending",
            payment: paymentMethod,
            paymentDeadline,
        });
        createdOrder = order;
        
        // Generate QR code immediately for BANK payment
        if (paymentMethod === "BANK") {
            try {
                const qrData = generateVietQR(order);
                order.paymentMeta = {
                    ...(order.paymentMeta || {}),
                    sepay: {
                        createdAt: new Date(),
                        qrUrl: qrData.qrUrl,
                        code: qrData.code,
                        reference: qrData.reference,
                        bankId: qrData.bankId,
                        accountNo: qrData.accountNo,
                        accountName: qrData.accountName,
                        amount: qrData.amount,
                    }
                };
                order.markModified("paymentMeta");
                await order.save();
            } catch (qrErr) {
                console.error("[createOrder] QR generation failed:", qrErr);
                // Continue anyway - QR can be generated later via /payment/qr/:id endpoint
            }
        }
        
        // (3.1) Commit coupon usage SAU khi tạo đơn thành công
        if (couponCode && amount.discount > 0) {
            try {
                const code = String(couponCode).trim();
                const now = new Date();
                const rx = new RegExp(`^${escapeRegExp(String(couponCode).trim())}$`, "i");
                const updatedCoupon = await Coupon.findOneAndUpdate(
                    {
                        code: rx,
                        active: true,
                        startDate: { $lte: now },
                        endDate:   { $gte: now },
                        $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
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

        // ===== 4) Cập nhật giỏ sau khi đặt đơn =====
        const purchasedSet = new Set(workingItems.map(i => String(i.product?._id || i.product)));
        const remaining = cart.items.filter(i => !purchasedSet.has(String(i.product?._id || i.product)));

        if (remaining.length === 0) {
            // Mua hết -> đóng giỏ cũ, tạo giỏ mới & set cookie
            cart.status = "ordered";
            await cart.save();

            const newCart = await Carts.create({
                user: cart.user || null,
                cartKey: crypto.randomUUID(),
                status: "active",
                items: [],
                summary: { totalItems: 0, subtotal: 0 },
            });

            res.cookie("CART_ID", newCart.cartKey, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
            });
        } else {
            // Mua một phần -> giữ giỏ, chỉ xoá các item đã mua và recalc summary
            cart.items = remaining;
            let subtotal = 0, totalItems = 0;
            for (const it of remaining) {
                subtotal += (Number(it.price) || 0) * (Number(it.quantity) || 0);
                totalItems += Number(it.quantity) || 0;
            }
            cart.summary = { totalItems, subtotal };
            await cart.save();
        }

        const payload = {
            id: order._id,
            createdAt: order.createdAt,
            items,
            amount,
            couponCode: (req.body?.couponCode || "").trim(),
            customer: { name: customerName, address, phone, email, note: note || "" },
            payment: {
                method: paymentMethod,
                deadline: paymentDeadline,
                qrCode: order.paymentMeta?.sepay?.qrUrl || null,
            },
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

        // Tạo thông báo cho user
        if (userId) {
            createNotification(
                userId,
                "order_created",
                "Đặt hàng thành công",
                `Đơn hàng #${String(order._id).slice(-8).toUpperCase()} đã được tạo thành công. Tổng tiền: ${amount.total.toLocaleString('vi-VN')}đ`,
                order._id,
                "/orders"
            ).catch(err => console.error("[notification] Failed to create order_created notification:", err));
        }

        return res.status(201).json({
            ok: true,
            message: "Đặt hàng thành công!",
            orderId: order._id,
            amount,
            createdAt: order.createdAt,
            paymentMethod,
            paymentDeadline,
            requiresPayment: paymentMethod !== "COD",
        });
    } catch (e) {
        // hoàn kho những dòng đã trừ
        try {
            for (const d of decremented) {
            await Stock.findOneAndUpdate({ product: d.product }, { $inc: { onHand: d.qty } });
            // cập nhật lại Product.onHand + status sau khi hoàn kho
            const stock = await Stock.findOne({ product: d.product }).lean();
            const newQty = Math.max(0, Number(stock?.onHand) || 0);
            await Product.findByIdAndUpdate(
                d.product,
                { $set: { onHand: newQty, status: newQty > 0 ? "Còn hàng" : "Hết hàng" } }
            );
            }
            // nếu đã tạo order nhưng lỗi về sau → xoá order rác
            if (createdOrder?._id) {
            await Order.findByIdAndDelete(createdOrder._id);
            }
        } catch (rbErr) {
            console.error("rollback error:", rbErr);
        }

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
        await restoreInventory(order);

        // 🔴 Đổi trạng thái đơn
        order.status = "cancelled";
        order.paymentDeadline = null;
        order.paymentMeta = {
            ...(order.paymentMeta || {}),
            cancelledAt: new Date(),
            cancelReason: "user_cancelled",
        };
        try {
            order.markModified("paymentMeta");
        } catch (_) { }
        await order.save();

        // Tạo thông báo hủy đơn
        if (userId) {
            createNotification(
                userId,
                "order_cancelled",
                "Đơn hàng đã bị hủy",
                `Đơn hàng #${String(order._id).slice(-8).toUpperCase()} đã được hủy thành công. Kho hàng đã được hoàn lại.`,
                order._id,
                "/orders"
            ).catch(err => console.error("[notification] Failed to create order_cancelled notification:", err));
        }

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

        await autoCancelExpiredOrders({ user: userId });
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

    await autoCancelExpiredOrders();

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
    await autoCancelExpiredOrders({ _id: req.params.id });
    const doc = await Order.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    return res.json(doc);
};

exports.adminUpdate = async (req, res) => {
    const { status, payment, paymentDeadline, paymentCompletedAt, paymentMeta } = req.body || {};
    const update = {};
    if (status) update.status = status;   // pending|paid|shipped|completed|cancelled
    if (payment) update.payment = payment; // COD|BANK|VNPAY
    if (paymentDeadline !== undefined) update.paymentDeadline = paymentDeadline;
    if (paymentCompletedAt !== undefined) update.paymentCompletedAt = paymentCompletedAt;
    if (paymentMeta !== undefined) update.paymentMeta = paymentMeta;
    if (!Object.keys(update).length) {
        return res.status(400).json({ message: "Không có trường nào để cập nhật." });
    }
    
    // Lấy đơn hàng trước khi update để so sánh status
    const oldOrder = await Order.findById(req.params.id).lean();
    
    const doc = await Order.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true, runValidators: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    
    // Tạo thông báo khi status thay đổi
    if (oldOrder && doc.user && status && status !== oldOrder.status) {
        const orderId = String(doc._id).slice(-8).toUpperCase();
        let notifType, notifTitle, notifMessage;
        
        switch (status) {
            case "paid":
                notifType = "order_paid";
                notifTitle = "Đơn hàng đã thanh toán";
                notifMessage = `Đơn hàng #${orderId} đã được thanh toán thành công.`;
                break;
            case "processing":
                notifType = "order_processing";
                notifTitle = "Đơn hàng đang xử lý";
                notifMessage = `Đơn hàng #${orderId} đang được chuẩn bị.`;
                break;
            case "shipping":
                notifType = "order_shipping";
                notifTitle = "Đơn hàng đang giao";
                notifMessage = `Đơn hàng #${orderId} đang trên đường giao đến bạn.`;
                break;
            case "completed":
                notifType = "order_completed";
                notifTitle = "Đơn hàng hoàn tất";
                notifMessage = `Đơn hàng #${orderId} đã được giao thành công. Cảm ơn bạn đã mua hàng!`;
                break;
            case "cancelled":
                notifType = "order_cancelled";
                notifTitle = "Đơn hàng đã bị hủy";
                notifMessage = `Đơn hàng #${orderId} đã bị hủy bởi quản trị viên.`;
                break;
        }
        
        if (notifType) {
            createNotification(
                doc.user,
                notifType,
                notifTitle,
                notifMessage,
                doc._id,
                "/orders"
            ).catch(err => console.error(`[notification] Failed to create ${notifType} notification:`, err));
        }
    }
    
    return res.json({ ok: true, data: doc });
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

        // 🔥 Gom theo trạng thái và tháng
        const orderByStatusAndMonth = {};
        for (const o of orders) {
            const d = new Date(o.createdAt);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!orderByStatusAndMonth[monthKey]) orderByStatusAndMonth[monthKey] = {};
            orderByStatusAndMonth[monthKey][o.status] = (orderByStatusAndMonth[monthKey][o.status] || 0) + 1;
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

        // Top sản phẩm (tất cả thời gian)
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

        // 🔥 Top sản phẩm theo từng tháng
        const topProductsByMonth = {};
        for (const o of orders) {
            const d = new Date(o.createdAt);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!topProductsByMonth[monthKey]) topProductsByMonth[monthKey] = {};
            
            for (const it of o.items) {
                const productName = it.name;
                topProductsByMonth[monthKey][productName] = 
                    (topProductsByMonth[monthKey][productName] || 0) + (it.quantity || 0);
            }
        }

        // Convert map to sorted array for each month
        Object.keys(topProductsByMonth).forEach(monthKey => {
            topProductsByMonth[monthKey] = Object.entries(topProductsByMonth[monthKey])
                .map(([name, sales]) => ({ name, sales }))
                .sort((a, b) => b.sales - a.sales)
                .slice(0, 5);
        });

        return res.json({
        totalRevenue,
        countOrders,
        orderByStatus,
        orderByStatusAndMonth,
        revenueByMonth,
        topProducts,
        topProductsByMonth,
        });
    } catch (err) {
        console.error("adminStats error:", err);
        return res.status(500).json({ message: "Lỗi server khi thống kê." });
    }
};




