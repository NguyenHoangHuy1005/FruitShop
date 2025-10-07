const Order = require("../../product-services/models/Order");
const Stock = require("../../product-services/models/Stock");
const Product = require("../../admin-services/models/Product");

const sanitizeOrder = (orderDoc) => {
    if (!orderDoc) return null;
    const obj = typeof orderDoc.toObject === "function" ? orderDoc.toObject() : orderDoc;
    return {
        id: obj._id,
        status: obj.status,
        payment: obj.payment,
        amount: obj.amount,
        items: obj.items,
        customer: obj.customer,
        paymentDeadline: obj.paymentDeadline,
        paymentCompletedAt: obj.paymentCompletedAt,
        paymentMeta: obj.paymentMeta || {},
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
    };
};

const restoreInventory = async (orderDoc) => {
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

const ensureNotExpired = async (orderDoc) => {
    if (!orderDoc) return { order: orderDoc, expired: false };
    if (orderDoc.status !== "pending") {
        return { order: orderDoc, expired: false };
    }
    if (!orderDoc.paymentDeadline) {
        return { order: orderDoc, expired: false };
    }
    const deadline = new Date(orderDoc.paymentDeadline).getTime();
    if (Number.isNaN(deadline) || deadline > Date.now()) {
        return { order: orderDoc, expired: false };
    }

    await restoreInventory(orderDoc);
    orderDoc.status = "cancelled";
    orderDoc.paymentDeadline = null;
    orderDoc.paymentMeta = {
        ...(orderDoc.paymentMeta || {}),
        autoCancelledAt: new Date(),
        cancelReason: "timeout",
    };
    await orderDoc.save();
    return { order: orderDoc, expired: true };
};

exports.getPaymentSession = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const orderDoc = await Order.findOne({ _id: id, user: userId });
        if (!orderDoc) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng cần thanh toán." });
        }

        const { order, expired } = await ensureNotExpired(orderDoc);
        const now = Date.now();
        const deadline = order.paymentDeadline ? new Date(order.paymentDeadline).getTime() : null;
        const remainingMs = order.status === "pending" && deadline
            ? Math.max(0, deadline - now)
            : 0;

        return res.json({
            ok: true,
            order: sanitizeOrder(order),
            remainingMs,
            expired,
        });
    } catch (err) {
        console.error("[payment] getPaymentSession error:", err);
        return res.status(500).json({ message: "Không lấy được thông tin thanh toán." });
    }
};

exports.confirmPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const orderDoc = await Order.findOne({ _id: id, user: userId });
        if (!orderDoc) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng cần thanh toán." });
        }

        const { order, expired } = await ensureNotExpired(orderDoc);
        if (expired) {
            return res.status(410).json({
                message: "Đơn hàng đã hết hạn thanh toán.",
                order: sanitizeOrder(order),
            });
        }

        if (order.status === "paid") {
            return res.json({ ok: true, order: sanitizeOrder(order) });
        }

        if (order.status !== "pending") {
            return res.status(400).json({ message: "Đơn hàng không ở trạng thái chờ thanh toán." });
        }

        order.status = "paid";
        order.paymentDeadline = null;
        order.paymentCompletedAt = new Date();
        const channel = typeof req.body?.channel === "string" && req.body.channel.trim()
            ? req.body.channel.trim()
            : null;
        order.paymentMeta = {
            ...(order.paymentMeta || {}),
            transactionId: req.body?.transactionId || null,
            paidAt: order.paymentCompletedAt,
        };
        if (channel) {
            order.paymentMeta.channel = channel;
        }
        try {
            order.markModified("paymentMeta");
        } catch (_) { }
        await order.save();

        return res.json({ ok: true, order: sanitizeOrder(order) });
    } catch (err) {
        console.error("[payment] confirmPayment error:", err);
        return res.status(500).json({ message: "Không xác nhận được thanh toán." });
    }
};

exports.cancelPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const orderDoc = await Order.findOne({ _id: id, user: userId });
        if (!orderDoc) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng cần hủy." });
        }

        if (orderDoc.status === "cancelled") {
            return res.json({ ok: true, order: sanitizeOrder(orderDoc) });
        }

        const { order, expired } = await ensureNotExpired(orderDoc);
        if (expired) {
            return res.json({ ok: true, order: sanitizeOrder(order) });
        }

        if (order.status !== "pending") {
            return res.status(400).json({ message: "Đơn hàng không thể hủy ở trạng thái hiện tại." });
        }

        await restoreInventory(order);
        order.status = "cancelled";
        order.paymentDeadline = null;
        order.paymentMeta = {
            ...(order.paymentMeta || {}),
            cancelledAt: new Date(),
            cancelReason: req.body?.reason || "user_cancelled",
        };
        await order.save();

        return res.json({ ok: true, order: sanitizeOrder(order) });
    } catch (err) {
        console.error("[payment] cancelPayment error:", err);
        return res.status(500).json({ message: "Không thể hủy thanh toán." });
    }
};