// product-services/controllers/orderController.js
const crypto = require("crypto"); // đầu file
const Carts = require("../models/Carts");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const Stock = require("../models/Stock");
const SpoilageRecord = require("../models/SpoilageRecord");
const Reservation = require("../models/Reservation");
const ImportItem = require("../../admin-services/models/ImportItem");
const { sendOrderConfirmationMail } = require("../../auth-services/utils/mailer");
const { getOrCreateCart } = require("./cartController");
const { createNotification } = require("../../auth-services/controllers/notificationController");
const { emitOrderUpdate } = require("../../auth-services/socket/chatEvents");

const buildHistoryEntry = ({ status, note = "", actorType = "system", actorId = null, actorName = "" }) => ({
  status: status || "",
  note,
  actorType,
  actorId,
  actorName,
  createdAt: new Date(),
});

const pushHistoryToDoc = (orderDoc, entry) => {
  if (!orderDoc || !entry?.status) return;
  if (!Array.isArray(orderDoc.history)) orderDoc.history = [];
  orderDoc.history.push(buildHistoryEntry(entry));
  try {
    orderDoc.markModified("history");
  } catch (_) {}
};

const pushHistoryById = async (orderId, entry) => {
  if (!orderId || !entry?.status) return;
  try {
    await Order.updateOne(
      { _id: orderId },
      { $push: { history: buildHistoryEntry(entry) } }
    );
  } catch (err) {
    console.error("[history] failed to append entry:", err?.message || err);
  }
};

const normalizeId = (raw) => {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (raw._id) return raw._id.toString();
  if (typeof raw.toString === "function") return raw.toString();
  return null;
};

const buildRealtimeOrderPayload = (orderDoc) => {
  if (!orderDoc) return null;
  const plain =
    typeof orderDoc.toObject === "function" ? orderDoc.toObject() : orderDoc;
  const userId = normalizeId(plain.user);
  const shipperId = normalizeId(plain.shipperId);

  return {
    id: normalizeId(plain._id || plain.id),
    status: plain.status,
    userId,
    shipperId,
    paymentType: plain.paymentType || plain.paymentMethod || "COD",
    amount: plain.amount || {},
    customer: plain.customer || null,
    pickupAddress: plain.pickupAddress || "",
    deliveredAt: plain.deliveredAt || null,
    updatedAt: plain.updatedAt || null,
    createdAt: plain.createdAt || null,
  };
};

const broadcastOrderUpdate = (orderDoc, event = "updated") => {
  const payload = buildRealtimeOrderPayload(orderDoc);
  if (!payload) return;
  emitOrderUpdate({
    event,
    userId: payload.userId,
    shipperId: payload.shipperId,
    order: payload,
  });
};

// Helper function to get or generate session key
function getSessionKey(req) {
  // Priority: x-session-key header > sessionID > generate new
  const headerKey = req.headers["x-session-key"];
  if (headerKey) return String(headerKey);
  
  const sessionId = req.sessionID;
  if (sessionId) return String(sessionId);
  
  // Generate a fallback session key if none exists
  const fallbackKey = `guest-${crypto.randomBytes(16).toString('hex')}`;
  console.warn("⚠️ No session key found in order, generated fallback:", fallbackKey);
  return fallbackKey;
}
const jwt = require("jsonwebtoken");
const Product = require("../../admin-services/models/Product");
const User = require("../../auth-services/models/User");
const { _updateProductStatus } = require("./stockController");

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
const AUTO_COMPLETE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

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
        if (it.batchId) {
            await ImportItem.findOneAndUpdate(
                { _id: it.batchId },
                { $inc: { soldQuantity: -it.quantity } }
            );

            const batch = await ImportItem.findById(it.batchId).lean();
            if (batch) {
                const remaining = Math.max(0, (batch.quantity || 0) - (batch.soldQuantity || 0) - (batch.damagedQuantity || 0));
                await _updateProductStatus(it.product, remaining);
            }
        } else {
            await Stock.findOneAndUpdate(
                { product: it.product },
                { $inc: { onHand: it.quantity } }
            );

            const stock = await Stock.findOne({ product: it.product }).lean();
            const newQty = Math.max(0, Number(stock?.onHand) || 0);
            await _updateProductStatus(it.product, newQty);
        }
    }
};

const recordSpoilageReturn = async ({ batch, productId, orderId, quantity, shipperId }) => {
    try {
        await SpoilageRecord.create({
            product: productId,
            batch: batch?._id || batch,
            order: orderId,
            quantity,
            reason: "expired_on_return",
            expiryDate: batch?.expiryDate || null,
            recordedBy: shipperId || null,
        });
    } catch (err) {
        console.error("[spoilage] Cannot record expired_on_return:", err?.message || err);
    }
};

const restoreInventoryAfterShipperCancel = async (orderDoc, shipperId) => {
    if (!orderDoc) return;
    const now = new Date();

    for (const it of orderDoc.items || []) {
        const qty = Math.max(0, Number(it.quantity) || 0);
        if (!qty) continue;
        const productId = it?.product?._id || it?.product || null;

        if (it.batchId) {
            const batch = await ImportItem.findById(it.batchId);
            if (!batch) continue;

            const sold = Math.max(0, Number(batch.soldQuantity) || 0);
            const decSold = Math.min(qty, sold);
            const expired = batch.expiryDate ? new Date(batch.expiryDate) <= now : false;

            const update = { $inc: { soldQuantity: -decSold } };
            if (expired) {
                update.$inc.damagedQuantity = qty;
            }

            await ImportItem.findByIdAndUpdate(batch._id, update);
            const refreshed = await ImportItem.findById(batch._id).lean();
            const remaining = Math.max(0, (refreshed?.quantity || 0) - (refreshed?.soldQuantity || 0) - (refreshed?.damagedQuantity || 0));
            await _updateProductStatus(productId, remaining);

            if (expired) {
                await recordSpoilageReturn({
                    batch,
                    productId,
                    orderId: orderDoc._id,
                    quantity: qty,
                    shipperId,
                });
            }
        } else if (productId) {
            await Stock.findOneAndUpdate(
                { product: productId },
                { $inc: { onHand: qty } },
                { upsert: true }
            );
            const stockDoc = await Stock.findOne({ product: productId }).lean();
            const onHand = Math.max(0, Number(stockDoc?.onHand) || 0);
            await _updateProductStatus(productId, onHand);
        }
    }
};

const isShipperUser = async (userId) => {
    if (!userId) return false;
    const u = await User.findById(userId).select("admin isAdmin roles shipper").lean();
    return !!(u?.admin || u?.isAdmin || u?.shipper || (Array.isArray(u?.roles) && u.roles.includes("shipper")));
};

const autoExpireOrders = async (extraFilter = {}) => {
    const now = new Date();
    const filter = {
        status: { $in: ["pending", "pending_payment"] }, // Hỗ trợ cả COD và online payment
        $or: [
            { autoConfirmAt: { $ne: null, $lte: now } },
            { autoConfirmAt: null, paymentDeadline: { $ne: null, $lte: now } }
        ],
        ...extraFilter,
    };

    const expiredOrders = await Order.find(filter);
    if (!expiredOrders.length) return [];

    const updatedIds = [];
    for (const order of expiredOrders) {
        try {
            await restoreInventory(order);
        } catch (err) {
            console.error("[order] restoreInventory failed while auto-expiring:", err);
        }

        order.status = "expired";
        order.autoConfirmAt = null;
        order.paymentDeadline = null;
        order.paymentMeta = {
            ...(order.paymentMeta || {}),
            autoExpiredAt: new Date(),
            cancelReason: "hết hạn thanh toán",
        };
        try {
            order.markModified("paymentMeta");
        } catch (_) { }

        // Release checkout reservation if still active
        try {
            const reservation = await Reservation.findOne({
                user: order.user,
                type: "checkout",
                status: "active"
            });
            if (reservation) {
                reservation.status = "released";
                reservation.releasedAt = new Date();
                await reservation.save();
            }
        } catch (resErr) {
            console.error("[order] autoExpireOrders release reservation failed:", resErr);
        }

        try {
            await order.save();
            updatedIds.push(order._id);
        } catch (err) {
            console.error("[order] autoExpireOrders save error:", err);
        }
    }

    return updatedIds;
};

const autoCompleteOrders = async (extraFilter = {}) => {
    const now = new Date();
    const filter = {
        status: "delivered",
        autoCompleteAt: { $ne: null, $lte: now },
        ...extraFilter,
    };

    const orders = await Order.find(filter);
    if (!orders.length) return [];

    const updatedIds = [];
    for (const order of orders) {
        order.status = "completed";
        order.completedAt = new Date();
        order.autoCompleteAt = null;
        if (order.paymentType === "COD" && !order.paymentCompletedAt) {
            order.paymentCompletedAt = new Date();
        }
        pushHistoryToDoc(order, {
            status: "completed",
            note: "H��� thA�ng t��� �`��Tng hoA�n thA�nh sau khi giao.",
            actorType: "system",
            actorName: "System",
        });
        try { order.markModified("paymentMeta"); } catch (_) { }
        try {
            await order.save();
            updatedIds.push(order._id);
        } catch (err) {
            console.error("[order] autoCompleteOrders save error:", err);
        }

        if (order.user) {
            const orderIdShort = String(order._id).slice(-8).toUpperCase();
            createNotification(
                order.user,
                "order_completed",
                "Đơn hàng đã hoàn tất",
                `Đơn hàng #${orderIdShort} đã tự động hoàn tất sau khi giao hàng.`,
                order._id,
                "/orders"
            ).catch(err => console.error("[notification] Failed to create order_completed notification:", err));
        }
    }

    return updatedIds;
};

exports.createOrder = async (req, res) => {
    let decremented = [];
    let createdOrder = null;
    let checkoutReservation = null;

    try {
        let userId = null;
        const token = readBearer(req);
        if (token && JWT_SECRET) {
            try {
                const payload = jwt.verify(token, JWT_SECRET);
                userId = payload?.id || payload?._id || null;
            } catch (_) { }
        }

        const { name, fullName, address, phone, email, note, couponCode, checkoutReservationId } = req.body || {};
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

        if (!cart?.items?.length) {
            return res.status(400).json({ message: "Giỏ hàng đang trống." });
        }

        let workingItems = cart.items;
        if (selectedIds && selectedIds.length > 0) {
            workingItems = cart.items.filter(i => {
                const pid = String(i.product?._id || i.product);
                return selectedIds.includes(pid);
            });
            if (!workingItems.length) {
                return res.status(400).json({ message: "Không có sản phẩm nào được chọn để đặt hàng." });
            }
        }

        console.log(`📦 Working items count: ${workingItems.length}`);

        // gắn user cho giỏ nếu có
        if (!cart.user && userId) cart.user = userId;

        // ===== 1) Tìm hoặc tạo checkout reservation =====
        const sessionKey = getSessionKey(req);

        if (checkoutReservationId) {
            const ownerFilter = userId ? { user: userId } : { sessionKey };
            checkoutReservation = await Reservation.findOne({
                _id: checkoutReservationId,
                type: "checkout",
                status: "active",
                ...ownerFilter,
            });
            if (!checkoutReservation) {
                console.warn("⚠️ Provided checkoutReservationId is invalid or expired:", checkoutReservationId);
            }
        }

        if (!checkoutReservation) {
            checkoutReservation = await Reservation.findOne({
                $or: [
                    { user: userId },
                    { sessionKey: sessionKey }
                ],
                type: "checkout",
                status: "active"
            });
        }

        // Nếu không có checkout reservation, tạo mới từ cart
        if (!checkoutReservation) {
            console.log("⚠️ Không tìm thấy checkout reservation, tạo mới từ cart items");
            
            try {
                // Tạo checkout reservation từ cart items
                const checkoutItems = [];
                for (const cartItem of workingItems) {
                    console.log(`Processing cart item:`, {
                        product: cartItem.product,
                        batchId: cartItem.batchId,
                        quantity: cartItem.quantity,
                        lockedPrice: cartItem.lockedPrice,
                        price: cartItem.price
                    });

                    const productId = cartItem.product?._id || cartItem.product;
                    const product = await Product.findById(productId);
                    if (!product) {
                        console.warn(`Product ${productId} not found, skipping`);
                        continue;
                    }

                    checkoutItems.push({
                        product: productId,
                        batchId: cartItem.batchId || null,
                        quantity: cartItem.quantity || 1,
                        lockedPrice: cartItem.lockedPrice || cartItem.price || product.price,
                        discountPercent: cartItem.discountPercent || product.discountPercent || 0,
                        unit: product.unit || "kg"
                    });
                }

                if (checkoutItems.length === 0) {
                    return res.status(400).json({ 
                        message: "Không có sản phẩm hợp lệ để đặt hàng.",
                        code: "NO_VALID_ITEMS"
                    });
                }

                console.log(`Creating checkout reservation with ${checkoutItems.length} items`);

                checkoutReservation = await Reservation.create({
                    user: userId,
                    sessionKey: sessionKey,
                    type: "checkout",
                    status: "active",
                    items: checkoutItems,
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 phút
                });

                console.log("✅ Đã tạo checkout reservation mới:", checkoutReservation._id);
            } catch (createReservationError) {
                console.error("❌ Lỗi khi tạo checkout reservation:", createReservationError);
                throw createReservationError;
            }
        }

        // Validate các items trong checkout reservation
        const reservedProductIds = checkoutReservation.items.map(item => item.product.toString());
        const orderProductIds = workingItems.map(item => String(item.product?._id || item.product));
        
        const allProductsReserved = orderProductIds.every(pid => reservedProductIds.includes(pid));
        if (!allProductsReserved) {
            return res.status(400).json({ 
                message: "Một số sản phẩm không có trong phiên thanh toán",
                code: "INVALID_RESERVATION"
            });
        }

        // Tổng tiền từ reservation (locked prices)
        let subtotal = 0;
        const items = [];
        
        console.log(`📋 Building order items from ${checkoutReservation.items.length} reservation items`);
        
        for (const item of checkoutReservation.items) {
            try {
                const lockedPrice = item.lockedPrice || 0;
                const discountPercent = item.discountPercent || 0;
                const finalPrice = Math.round(lockedPrice * (100 - discountPercent) / 100);
                const quantity = item.quantity;
                
                const product = await Product.findById(item.product).lean();
                
                if (!product) {
                    console.warn(`⚠️ Product ${item.product} not found, using fallback data`);
                }
                
                // Lấy giá nhập từ batch để tính lợi nhuận
                let importPrice = 0;
                if (item.batchId) {
                    const batch = await ImportItem.findById(item.batchId).select('unitPrice').lean();
                    importPrice = batch?.unitPrice || 0;
                }
                
                items.push({
                    product: item.product,
                    name: product?.name || "Unknown Product",
                    image: product?.image || [],
                    price: finalPrice,
                    quantity: quantity,
                    total: finalPrice * quantity,
                    batchId: item.batchId,
                    lockedPrice: lockedPrice,
                    discountPercent: discountPercent,
                    importPrice: importPrice
                });
                
                subtotal += finalPrice * quantity;
                
                console.log(`✓ Item: ${product?.name}, qty: ${quantity}, price: ${finalPrice}`);
            } catch (itemError) {
                console.error(`❌ Error processing item ${item.product}:`, itemError);
                throw itemError;
            }
        }
        
        console.log(`💰 Subtotal: ${subtotal}, Total items: ${items.length}`);

        // ===== 2) Trừ kho từ ImportItem batches =====
        for (const item of items) {
            const qty = item.quantity;
            const batchId = item.batchId;

            // Nếu không có batchId (sản phẩm chưa có ImportItem), bỏ qua trừ kho
            if (!batchId) {
                console.warn(`Item ${item.product} không có batchId, bỏ qua trừ kho ImportItem`);
                // Có thể trừ từ Stock model cũ nếu muốn
                // const stock = await Stock.findOneAndUpdate(
                //     { product: item.product, onHand: { $gte: qty } },
                //     { $inc: { onHand: -qty } },
                //     { new: true }
                // );
                continue;
            }

            // Tăng soldQuantity thay vì giảm quantity
            // remainingQuantity = quantity - soldQuantity - damagedQuantity
            const batch = await ImportItem.findOne({ _id: batchId });
            
            if (!batch) {
                // Rollback các batch đã cập nhật
                for (const d of decremented) {
                    if (d.batchId) {
                        await ImportItem.findOneAndUpdate(
                            { _id: d.batchId },
                            { $inc: { soldQuantity: -d.qty } }
                        );
                    }
                }
                return res.status(409).json({ 
                    message: `Không tìm thấy lô hàng cho sản phẩm "${item.name}".`,
                    code: "BATCH_NOT_FOUND"
                });
            }
            
            // Kiểm tra còn đủ hàng không (quantity - soldQuantity - damagedQuantity >= qty)
            const remaining = (batch.quantity || 0) - (batch.soldQuantity || 0) - (batch.damagedQuantity || 0);
            if (remaining < qty) {
                // Rollback các batch đã cập nhật
                for (const d of decremented) {
                    if (d.batchId) {
                        await ImportItem.findOneAndUpdate(
                            { _id: d.batchId },
                            { $inc: { soldQuantity: -d.qty } }
                        );
                    }
                }
                return res.status(409).json({ 
                    message: `Sản phẩm "${item.name}" không đủ số lượng trong lô hàng (còn ${remaining}, cần ${qty}).`,
                    code: "INSUFFICIENT_STOCK"
                });
            }
            
            // Tăng soldQuantity
            await ImportItem.findOneAndUpdate(
                { _id: batchId },
                { $inc: { soldQuantity: qty } },
                { new: true }
            );

            decremented.push({ batchId: batchId, qty: qty, product: item.product });

            // Cập nhật trạng thái sản phẩm dựa trên remainingQuantity
            try {
                const updatedBatch = await ImportItem.findById(batchId);
                const remainingQty = Math.max(0, (updatedBatch.quantity || 0) - (updatedBatch.soldQuantity || 0) - (updatedBatch.damagedQuantity || 0));
                await _updateProductStatus(item.product, remainingQty);
            } catch (err) {
                console.error("Error updating product status:", err);
            }
        }

        // Tính total với coupon và shipping
        const SHIPPING_FEE = 0;
        const shipping = subtotal >= 199000 ? 0 : SHIPPING_FEE;
        let discount = 0;
        
        if (couponCode) {
            // Apply coupon logic (simplified)
            const coupon = await Coupon.findOne({ 
                code: new RegExp(`^${couponCode}$`, "i"), 
                active: true 
            }).lean();
            
            if (coupon) {
                const now = new Date();
                if (now >= coupon.startDate && now <= coupon.endDate) {
                    if (coupon.discountType === "percent") {
                        discount = Math.round(subtotal * coupon.value / 100);
                    } else {
                        discount = coupon.value;
                    }
                }
            }
        }
        
        const total = Math.max(0, subtotal + shipping - discount);
        const amount = { subtotal, shipping, discount, total, totalItems: items.length };

        // ===== 3) Tạo đơn =====
        const isOnlinePayment = paymentMethod !== "COD";
        const paymentDeadline = isOnlinePayment ? new Date(Date.now() + 10 * 60 * 1000) : null;
        
        // QR/Online payment: pending_payment (chờ thanh toán online)
        // COD: pending (chờ xác nhận/nhập địa chỉ)
        const initialStatus = isOnlinePayment ? "pending_payment" : "pending";
        
        const order = await Order.create({
            user: userId || cart.user || null,
            customer: { name: customerName, address, phone, email, note: note || "" },
            items,
            amount,
            status: initialStatus,
            paymentType: paymentMethod,
            payment: paymentMethod,
            paymentDeadline,
            autoConfirmAt: paymentDeadline,
            paymentCompletedAt: null,
            autoCompleteAt: null,
        });
        const initActorName = userId ? customerName : "Khách vãng lai";
        order.history = [
            buildHistoryEntry({
                status: initialStatus,
                note: "Đơn hàng được tạo",
                actorType: userId ? "user" : "guest",
                actorId: userId || cart.user || null,
                actorName: initActorName,
            })
        ];
        await order.save();
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

        // ===== Confirm checkout reservation =====
        if (checkoutReservation) {
            checkoutReservation.status = "confirmed";
            checkoutReservation.confirmedAt = new Date();
            checkoutReservation.orderId = order._id;
            await checkoutReservation.save();
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
                cartKey: (typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
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

        broadcastOrderUpdate(order, "created");

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
        // Rollback: giảm soldQuantity từ ImportItem batches
        try {
            for (const d of decremented) {
                // Chỉ rollback nếu có batchId
                if (d.batchId) {
                    await ImportItem.findOneAndUpdate(
                        { _id: d.batchId },
                        { $inc: { soldQuantity: -d.qty } }
                    );
                    
                    // Cập nhật lại trạng thái sản phẩm
                    const batch = await ImportItem.findById(d.batchId).lean();
                    if (batch) {
                        const remaining = Math.max(0, (batch.quantity || 0) - (batch.soldQuantity || 0) - (batch.damagedQuantity || 0));
                        await _updateProductStatus(d.product, remaining);
                    }
                }
            }
            
            // Release checkout reservation nếu có
            if (checkoutReservation) {
                checkoutReservation.status = "released";
                checkoutReservation.releasedAt = new Date();
                await checkoutReservation.save();
            }
            
            // Xóa order rác nếu đã tạo
            if (createdOrder?._id) {
                await Order.findByIdAndDelete(createdOrder._id);
            }
        } catch (rbErr) {
            console.error("Rollback error:", rbErr);
        }

        console.error("❌❌❌ CREATE ORDER ERROR ❌❌❌");
        console.error("Error message:", e.message);
        console.error("Error stack:", e.stack);
        console.error("Error details:", e);
        
        return res.status(500).json({ 
            message: "Tạo đơn thất bại.", 
            error: e.message,
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
    }
};

// User cancel order (pending/pending_payment/processing)
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || null; // from token (middleware verifyToken)

        const order = await Order.findOne({ _id: id, user: userId });
        if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

        const cancellableStatuses = ["pending", "pending_payment", "processing"];
        if (!cancellableStatuses.includes(order.status)) {
            return res.status(400).json({ message: "Chỉ các đơn đang chờ xác nhận hoặc đang xử lý mới có thể hủy." });
        }

        const rawReason = typeof req.body?.reason === "string" ? req.body.reason : "";
        const cancelReason = rawReason.trim().slice(0, 200) || "Khách tự hủy đơn";

        // Return items to stock
        await restoreInventory(order);

        // Update order state
        order.status = "cancelled";
        order.paymentDeadline = null;
        order.autoConfirmAt = null;
        order.autoCompleteAt = null;
        order.shipperId = null;
        order.paymentMeta = {
            ...(order.paymentMeta || {}),
            cancelledAt: new Date(),
            cancelReason,
            cancelledBy: "user",
        };
        try {
            order.markModified("paymentMeta");
        } catch (_) { }
        pushHistoryToDoc(order, {
            status: "cancelled",
            note: cancelReason,
            actorType: "user",
            actorId: userId,
            actorName: req.user?.username || req.user?.email || order.customer?.name
        });
        await order.save();
        broadcastOrderUpdate(order, "cancelled");

        // Notify user
        if (userId) {
            createNotification(
                userId,
                "order_cancelled",
                "Đơn hàng đã bị hủy",
                `Đơn hàng #${String(order._id).slice(-8).toUpperCase()} đã được hủy. Kho hàng đã được hoàn lại.`,
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

// Shipper list orders for shipper app
exports.shipperListOrders = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        if (!userId) return res.status(401).json({ message: "Thiếu thông tin đăng nhập shipper." });
        const canShip = await isShipperUser(userId);
        if (!canShip) return res.status(403).json({ message: "Tài khoản không có quyền shipper." });

        await autoExpireOrders();
        await autoCompleteOrders();

        const statusParam = req.query?.status;
        const statuses = statusParam ? String(statusParam).split(",") : null;
        const statusList = statuses
            ? statuses.map((s) => String(s).trim()).filter(Boolean)
            : ["processing", "shipping", "delivered", "completed", "cancelled"];

        const filter = { status: { $in: statusList } };
        const fromRaw = req.query?.from ? new Date(req.query.from) : null;
        const toRaw = req.query?.to ? new Date(req.query.to) : null;
        if (fromRaw && !isNaN(fromRaw)) {
            filter.createdAt = { ...(filter.createdAt || {}), $gte: fromRaw };
        }
        if (toRaw && !isNaN(toRaw)) {
            // include entire day
            toRaw.setHours(23, 59, 59, 999);
            filter.createdAt = { ...(filter.createdAt || {}), $lte: toRaw };
        }
        // Chỉ hiển thị đơn đã được admin xác nhận (processing) hoặc đơn đã được shipper này nhận
        filter.$or = [
            { shipperId: userId }, // Đơn đã được shipper này nhận (bất kể trạng thái)
            { status: "processing", shipperId: null, pickupAddress: { $exists: true, $ne: "" } }, // Đơn chờ nhận, đã có địa chỉ lấy hàng
        ];

        const orders = await Order.find(filter)
            .select('_id user customer items amount status paymentType payment paymentCompletedAt pickupAddress shipperId deliveredAt completedAt createdAt updatedAt history')
            .sort({ createdAt: -1 })
            .lean();
        
        // Format orders để hiển thị rõ phương thức thanh toán
        const formattedOrders = orders.map(order => ({
            ...order,
            paymentMethod: order.paymentType || 'COD', // Hiển thị phương thức thanh toán
            isPaid: order.paymentType !== 'COD' && order.paymentCompletedAt ? true : false, // Đã thanh toán hay chưa
        }));
        
        return res.json({ ok: true, orders: formattedOrders });
    } catch (err) {
        console.error("shipperListOrders error:", err);
        return res.status(500).json({ message: "Lỗi server khi tải đơn cho shipper." });
    }
};

// Shipper picks up order for delivery
exports.shipperAcceptOrder = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        if (!userId) return res.status(401).json({ message: "Thiếu thông tin đăng nhập shipper." });
        const canShip = await isShipperUser(userId);
        if (!canShip) return res.status(403).json({ message: "Tài khoản không có quyền shipper." });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
        if (order.status !== "processing") {
            return res.status(400).json({ message: "Chỉ đơn đang xử lý mới được nhận giao." });
        }
        if (order.shipperId && String(order.shipperId) !== String(userId)) {
            return res.status(409).json({ message: "Đơn hàng đã được gán cho shipper khác." });
        }

        order.shipperId = userId;
        order.status = "shipping";
        order.autoCompleteAt = null;
        pushHistoryToDoc(order, {
            status: "shipping",
            note: "Shipper nhận giao đơn.",
            actorType: "shipper",
            actorId: userId,
            actorName: req.user?.username || req.user?.email || "Shipper"
        });
        await order.save();
        broadcastOrderUpdate(order, "shipper_accept");

        if (order.user) {
            const orderIdShort = String(order._id).slice(-8).toUpperCase();
            createNotification(
                order.user,
                "order_shipping",
                "Đơn hàng đang giao",
                `Đơn hàng #${orderIdShort} đang được vận chuyển.`,
                order._id,
                "/orders"
            ).catch(err => console.error("[notification] Failed to create order_shipping notification:", err));
        }

        return res.json({ ok: true, order });
    } catch (err) {
        console.error("shipperAcceptOrder error:", err);
        return res.status(500).json({ message: "Lỗi server khi nhận giao đơn." });
    }
};

// Shipper marks order delivered
exports.shipperDeliveredOrder = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        if (!userId) return res.status(401).json({ message: "Thiếu thông tin đăng nhập shipper." });
        const canShip = await isShipperUser(userId);
        if (!canShip) return res.status(403).json({ message: "Tài khoản không có quyền shipper." });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
        if (order.status !== "shipping") {
            return res.status(400).json({ message: "Chỉ đơn đang giao mới có thể xác nhận đã giao." });
        }
        if (order.shipperId && String(order.shipperId) !== String(userId)) {
            return res.status(403).json({ message: "Bạn không phải shipper của đơn này." });
        }
        if (!order.shipperId) order.shipperId = userId;

        order.status = "delivered";
        order.deliveredAt = new Date();
        order.autoCompleteAt = new Date(Date.now() + AUTO_COMPLETE_AFTER_MS);
        if (order.paymentType === "COD" && !order.paymentCompletedAt) {
            order.paymentCompletedAt = new Date();
        }
        pushHistoryToDoc(order, {
            status: "delivered",
            note: "Shipper xác nhận đã giao hàng.",
            actorType: "shipper",
            actorId: userId,
            actorName: req.user?.username || req.user?.email || "Shipper"
        });
        await order.save();
        broadcastOrderUpdate(order, "delivered");

        if (order.user) {
            const orderIdShort = String(order._id).slice(-8).toUpperCase();
            createNotification(
                order.user,
                "order_delivered",
                "Đơn hàng đã giao",
                `Đơn hàng #${orderIdShort} đã được giao. Vui lòng xác nhận trong 3 ngày.`,
                order._id,
                "/orders"
            ).catch(err => console.error("[notification] Failed to create order_delivered notification:", err));
        }

        return res.json({ ok: true, order });
    } catch (err) {
        console.error("shipperDeliveredOrder error:", err);
        return res.status(500).json({ message: "Lỗi server khi xác nhận giao hàng." });
    }
};

// Shipper marks order cancelled (customer refused)
exports.shipperCancelOrder = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        if (!userId) return res.status(401).json({ message: "Thiếu thông tin đăng nhập shipper." });
        const canShip = await isShipperUser(userId);
        if (!canShip) return res.status(403).json({ message: "Tài khoản không có quyền shipper." });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
        if (order.status !== "shipping") {
            return res.status(400).json({ message: "Chỉ đơn đang giao mới được hủy bỏ." });
        }
        if (order.shipperId && String(order.shipperId) !== String(userId)) {
            return res.status(403).json({ message: "Bạn không phải shipper của đơn này." });
        }
        if (!order.shipperId) order.shipperId = userId;

        const rawReason = typeof req.body?.reason === "string" ? req.body.reason : "";
        const cancelReason = rawReason.trim().slice(0, 200) || "khách hàng từ chối nhận hàng";

        await restoreInventoryAfterShipperCancel(order, userId);

        order.status = "cancelled";
        order.autoCompleteAt = null;
        order.paymentDeadline = null;
        order.autoConfirmAt = null;
        order.paymentMeta = {
            ...(order.paymentMeta || {}),
            cancelledAt: new Date(),
            cancelReason,
            cancelledBy: "shipper",
        };
        try { order.markModified("paymentMeta"); } catch (_) { }
        pushHistoryToDoc(order, {
            status: "cancelled",
            note: cancelReason,
            actorType: "shipper",
            actorId: userId,
            actorName: req.user?.username || req.user?.email || "Shipper"
        });
        await order.save();
        broadcastOrderUpdate(order, "shipper_cancel");

        if (order.user) {
            const orderIdShort = String(order._id).slice(-8).toUpperCase();
            createNotification(
                order.user,
                "order_cancelled",
                "Đơn hàng bị hủy khi giao",
                cancelReason
                    ? `Đơn hàng #${orderIdShort} bị hủy: ${cancelReason}.`
                    : `Đơn hàng #${orderIdShort} bị hủy khi giao.`,
                order._id,
                "/orders"
            ).catch(err => console.error("[notification] Failed to create order_cancelled notification:", err));
        }

        return res.json({ ok: true, order });
    } catch (err) {
        console.error("shipperCancelOrder error:", err);
        return res.status(500).json({ message: "Lỗi server khi hủy đơn giao hàng." });
    }
};

// User confirms delivered -> completed
exports.userConfirmDelivered = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        if (!userId) return res.status(401).json({ message: "Thiếu thông tin đăng nhập." });

        const order = await Order.findOne({ _id: req.params.id, user: userId });
        if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
        if (order.status !== "delivered") {
            return res.status(400).json({ message: "Chỉ đơn đã giao mới được xác nhận hoàn tất." });
        }

        order.status = "completed";
        order.completedAt = new Date();
        order.autoCompleteAt = null;
        if (!order.paymentCompletedAt) {
            order.paymentCompletedAt = new Date();
        }
        await order.save();
        broadcastOrderUpdate(order, "completed");

        return res.json({ ok: true, order });
    } catch (err) {
        console.error("userConfirmDelivered error:", err);
        return res.status(500).json({ message: "Lỗi server khi xác nhận nhận hàng." });
    }
};

exports.myOrders = async (req, res) => {
    const token = readBearer(req);                // <— dùng helper
    if (!token) return res.status(401).json({ message: "Cần đăng nhập để xem đơn hàng của bạn." });
    if (!JWT_SECRET) return res.status(500).json({ message: "Thiếu JWT_ACCESS_KEY trên server." });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const userId = payload?.id || payload?._id || null;
        if (!userId) return res.status(401).json({ message: "Phiên đăng nhập hết hạn hoặc token không hợp lệ." });

        await autoExpireOrders({ user: userId });
        await autoCompleteOrders({ user: userId });
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

    await autoExpireOrders();
    await autoCompleteOrders();

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
    await autoExpireOrders({ _id: req.params.id });
    await autoCompleteOrders({ _id: req.params.id });
    const doc = await Order.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    return res.json(doc);
};

// Admin xác nhận và chuẩn bị đơn hàng (pending -> processing/ready for pickup)
exports.adminPrepareOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { pickupAddress } = req.body;

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
        }

        // Chỉ cho phép chuẩn bị đơn ở trạng thái pending (chờ xác nhận)
        if (order.status !== "pending") {
            return res.status(400).json({ 
                message: `Chỉ có thể xác nhận đơn hàng ở trạng thái "Chờ xác nhận". Trạng thái hiện tại: ${order.status}` 
            });
        }

        // Cập nhật địa chỉ lấy hàng
        if (pickupAddress && pickupAddress.trim()) {
            order.pickupAddress = pickupAddress.trim();
        }

        // Chuyển trạng thái sang processing (chờ shipper nhận)
        order.status = "processing";
        
        // Đánh dấu thời gian xác nhận
        if (!order.paymentMeta) order.paymentMeta = {};
        order.paymentMeta.confirmedAt = new Date();
        order.markModified('paymentMeta');

        await order.save();
        broadcastOrderUpdate(order, "processing");

        // Tạo thông báo cho user
        if (order.user) {
            const orderId = String(order._id).slice(-8).toUpperCase();
            createNotification(
                order.user,
                "order_confirmed",
                "Đơn hàng đã được xác nhận",
                `Đơn hàng #${orderId} đã được xác nhận và đang chờ shipper nhận hàng.`,
                order._id,
                "/orders"
            ).catch(err => console.error("[notification] Failed to create order_confirmed notification:", err));
        }

        return res.json({ 
            ok: true, 
            message: "Đơn hàng đã được xác nhận, chờ shipper nhận hàng.",
            data: order 
        });
    } catch (err) {
        console.error("adminPrepareOrder error:", err);
        return res.status(500).json({ message: "Lỗi khi xác nhận đơn hàng." });
    }
};

exports.adminUpdate = async (req, res) => {
    const {
        status, payment, paymentDeadline, paymentCompletedAt, paymentMeta,
        paymentType, shipperId, deliveredAt, completedAt,
        autoConfirmAt, autoCompleteAt, pickupAddress
    } = req.body || {};
    const update = {};
    if (status) update.status = status;   // pending|expired|processing|shipping|delivered|completed|cancelled
    if (payment) update.payment = payment; // legacy payment info
    if (paymentType) update.paymentType = paymentType;
    if (paymentDeadline !== undefined) update.paymentDeadline = paymentDeadline;
    if (autoConfirmAt !== undefined) update.autoConfirmAt = autoConfirmAt;
    if (paymentCompletedAt !== undefined) update.paymentCompletedAt = paymentCompletedAt;
    if (paymentMeta !== undefined) update.paymentMeta = paymentMeta;
    if (shipperId !== undefined) update.shipperId = shipperId;
    if (deliveredAt !== undefined) update.deliveredAt = deliveredAt;
    if (completedAt !== undefined) update.completedAt = completedAt;
    if (autoCompleteAt !== undefined) update.autoCompleteAt = autoCompleteAt;
    if (pickupAddress !== undefined) update.pickupAddress = pickupAddress;
    if (!Object.keys(update).length) {
        return res.status(400).json({ message: "Không có trường nào để cập nhật." });
    }
    
    const oldOrder = await Order.findById(req.params.id).lean();
    
    const doc = await Order.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true, runValidators: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    
    if (oldOrder && doc.user && status && status !== oldOrder.status) {
        const orderId = String(doc._id).slice(-8).toUpperCase();
        let notifType, notifTitle, notifMessage;
        
        switch (status) {
            case "pending":
                notifType = "order_pending";
                notifTitle = "Đơn hàng chờ thanh toán";
                notifMessage = `Đơn hàng #${orderId} đang chờ thanh toán online.`;
                break;
            case "processing":
                notifType = "order_processing";
                notifTitle = "Đơn hàng đang xử lý";
                notifMessage = `Đơn hàng #${orderId} đang được chuẩn bị.`;
                break;
            case "shipping":
                notifType = "order_shipping";
                notifTitle = "Đơn hàng đang giao";
                notifMessage = `Đơn hàng #${orderId} đang được vận chuyển.`;
                break;
            case "delivered":
                notifType = "order_delivered";
                notifTitle = "Đơn hàng đã giao";
                notifMessage = `Đơn hàng #${orderId} đã giao, vui lòng xác nhận nhận hàng.`;
                break;
            case "completed":
                notifType = "order_completed";
                notifTitle = "Đơn hàng hoàn tất";
                notifMessage = `Đơn hàng #${orderId} đã hoàn tất. Cảm ơn bạn!`;
                break;
            case "cancelled":
                notifType = "order_cancelled";
                notifTitle = "Đơn hàng bị hủy";
                notifMessage = `Đơn hàng #${orderId} đã bị hủy bởi quản trị viên.`;
                break;
            case "expired":
                notifType = "order_expired";
                notifTitle = "Đơn hàng hết hạn thanh toán";
                notifMessage = `Đơn hàng #${orderId} hết hạn thanh toán và đã hủy tự động.`;
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
    
    broadcastOrderUpdate(doc, "admin_update");
    return res.json({ ok: true, data: doc });
};

exports.adminStats = async (req, res) => {
    try {
        // 🔥 Lấy selectedMonth từ query params (YYYY-MM format)
        const { selectedMonth } = req.query;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const DAY_MS = 24 * 60 * 60 * 1000;
        
        // Lấy tất cả đơn hàng
        const allOrders = await Order.find().lean();
        
        // Filter orders by selected month
        let filteredOrders = allOrders;
        if (selectedMonth) {
            filteredOrders = allOrders.filter(o => {
                const d = new Date(o.createdAt);
                const orderMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                return orderMonth === selectedMonth;
            });
        }

        // 🔥 Tính doanh thu và lợi nhuận từ đơn hàng đã lọc
        let totalRevenue = 0;
        let totalCost = 0;
        
        for (const o of filteredOrders) {
            if (!["processing", "shipping", "delivered", "completed"].includes(o.status)) continue;
            
            // Doanh thu = amount.total
            const orderRevenue = o.amount?.total || 0;
            totalRevenue += orderRevenue;
            
            // Tính chi phí từng item
            for (const item of o.items || []) {
                const quantity = Number(item.quantity) || 0;
                let importPrice = Number(item.importPrice) || 0;
                
                // Fallback: Nếu đơn hàng cũ không có importPrice, lấy từ batch
                if (importPrice === 0 && item.batchId) {
                    try {
                        const batch = await ImportItem.findById(item.batchId).select('unitPrice').lean();
                        importPrice = batch?.unitPrice || 0;
                    } catch (err) {
                        console.warn(`Cannot fetch batch ${item.batchId}:`, err.message);
                    }
                }
                
                // Chi phí = giá nhập * số lượng
                const itemCost = importPrice * quantity;
                totalCost += itemCost;
            }
        }
        
        // Lợi nhuận = Doanh thu - Chi phí
        const totalProfit = totalRevenue - totalCost;

        const countOrders = filteredOrders.length;

        // Gom theo trạng thái (từ filtered orders)
        const orderByStatus = {};
        for (const o of filteredOrders) {
            orderByStatus[o.status] = (orderByStatus[o.status] || 0) + 1;
        }

        // 🔥 Gom theo trạng thái và tháng (from all orders)
        const orderByStatusAndMonth = {};
        for (const o of allOrders) {
            const d = new Date(o.createdAt);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!orderByStatusAndMonth[monthKey]) orderByStatusAndMonth[monthKey] = {};
            orderByStatusAndMonth[monthKey][o.status] = (orderByStatusAndMonth[monthKey][o.status] || 0) + 1;
        }

        // Gom theo tháng (YYYY-MM) - from all orders
        const revenueByMonth = {};
        for (const o of allOrders) {
        const d = new Date(o.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!revenueByMonth[key]) revenueByMonth[key] = 0;
        if (["processing", "shipping", "delivered", "completed"].includes(o.status)) {
            revenueByMonth[key] += o.amount?.total || 0;
        }
        }

        // 🔁 Lượng truy cập = tổng loginCount từ User model
        const User = require("../../auth-services/models/User");
        const totalLoginCount = await User.aggregate([
            { $group: { _id: null, total: { $sum: "$loginCount" } } }
        ]);
        const websiteVisits = totalLoginCount[0]?.total || 0;

        // Lượng truy cập theo tháng (từ updatedAt của User khi login)
        const visitsByMonth = {};
        const userLogins = await User.find(
            { loginCount: { $gt: 0 } },
            { updatedAt: 1, loginCount: 1 }
        ).lean();
        
        for (const user of userLogins) {
            const d = new Date(user.updatedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            visitsByMonth[key] = (visitsByMonth[key] || 0) + (user.loginCount || 0);
        }

        // Top sản phẩm (from filtered orders)
        const productMap = {};
        for (const o of filteredOrders) {
            for (const it of o.items) {
                productMap[it.name] = (productMap[it.name] || 0) + (it.quantity || 0);
            }
        }
        const topProducts = Object.entries(productMap)
            .map(([name, sales]) => ({ name, sales }))
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5);

        // 🔥 Top sản phẩm theo từng tháng (from all orders)
        const topProductsByMonth = {};
        for (const o of allOrders) {
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

        // ✅ Lấy sản phẩm sắp hết kho dựa trên tồn kho thực tế từ các lô hàng (displayStock)
        const LOW_STOCK_THRESHOLD = 10;
        let lowStockProducts = [];
        try {
            const importItems = await ImportItem.find({})
                .populate('product', 'name image images price unit')
                .lean();

            if (importItems.length > 0) {
                const productTotals = new Map();

                for (const batch of importItems) {
                    const productRef = batch.product?._id || batch.product;
                    if (!productRef) continue;
                    const productId = String(productRef);
                    const qty = Number(batch.quantity) || 0;
                    const sold = Number(batch.soldQuantity) || 0;
                    const damaged = Number(batch.damagedQuantity) || 0;
                    let remaining = Math.max(0, qty - sold - damaged);

                    let daysLeft = null;
                    if (batch.expiryDate) {
                        const expiryDate = new Date(batch.expiryDate);
                        const expiryDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
                        daysLeft = Math.floor((expiryDay - today) / DAY_MS);
                        if (daysLeft < 0) {
                            remaining = 0;
                        }
                    }

                    const productInfo = batch.product || {};
                    const primaryImage = Array.isArray(productInfo.image)
                        ? productInfo.image[0]
                        : (productInfo.images?.[0] || productInfo.image || batch.productImage || "");

                    const bucket = productTotals.get(productId) || {
                        productId,
                        name: productInfo.name || batch.productName || 'N/A',
                        image: primaryImage,
                        price: Number(productInfo.price) || 0,
                        unit: productInfo.unit || 'kg',
                        displayStock: 0,
                        batchCount: 0,
                        expiringBatches: 0,
                        expiredBatches: 0,
                    };

                    bucket.displayStock += remaining;
                    bucket.batchCount += 1;
                    if (daysLeft !== null) {
                        if (daysLeft < 0) bucket.expiredBatches += 1;
                        else if (daysLeft <= 7) bucket.expiringBatches += 1;
                    }

                    productTotals.set(productId, bucket);
                }

                lowStockProducts = Array.from(productTotals.values())
                    .filter((p) => p.displayStock > 0 && p.displayStock < LOW_STOCK_THRESHOLD)
                    .sort((a, b) => a.displayStock - b.displayStock);
            }
        } catch (lowStockErr) {
            console.error('Low stock aggregation failed:', lowStockErr);
        }

        if (lowStockProducts.length === 0) {
            const fallbackItems = await Stock.find({ onHand: { $lt: LOW_STOCK_THRESHOLD, $gt: 0 } })
                .populate('product', 'name images image price unit')
                .sort({ onHand: 1 })
                .limit(10)
                .lean();

            lowStockProducts = fallbackItems
                .filter(item => item.product)
                .map(item => ({
                    productId: item.product._id,
                    name: item.product.name || 'N/A',
                    image: item.product.images?.[0] || item.product.image?.[0] || '',
                    price: item.product.price || 0,
                    unit: item.product.unit || 'kg',
                    displayStock: item.onHand || 0,
                    batchCount: 0,
                    expiringBatches: 0,
                    expiredBatches: 0,
                }));
        }

        // 🔥 Lấy 5 đơn hàng gần nhất (từ filtered orders)
        const sortedOrders = [...filteredOrders]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        // Populate user info for these orders
        const orderIds = sortedOrders.map(o => o._id);
        const populatedOrders = await Order.find({ _id: { $in: orderIds } })
            .populate('user', 'username email')
            .lean();

        const orderMap = new Map(populatedOrders.map(o => [String(o._id), o]));

        const recentOrdersFormatted = await Promise.all(sortedOrders.map(async (o) => {
            const populated = orderMap.get(String(o._id)) || o;
            
            let orderCost = 0;
            let orderRevenue = o.amount?.total || 0;
            
            for (const item of o.items || []) {
                const quantity = Number(item.quantity) || 0;
                let importPrice = Number(item.importPrice) || 0;
                
                // Fallback: Nếu đơn hàng cũ không có importPrice, lấy từ batch
                if (importPrice === 0 && item.batchId) {
                    try {
                        const batch = await ImportItem.findById(item.batchId).select('unitPrice').lean();
                        importPrice = batch?.unitPrice || 0;
                    } catch (err) {
                        console.warn(`Cannot fetch batch ${item.batchId}:`, err.message);
                    }
                }
                
                // Chi phí = giá nhập * số lượng
                orderCost += importPrice * quantity;
            }
            
            // Lợi nhuận = Doanh thu - Chi phí
            const orderProfit = orderRevenue - orderCost;
            
            return {
                _id: o._id,
                orderNumber: `DH${String(o._id).slice(-8).toUpperCase()}`,
                customer: populated.user?.username || o.guestInfo?.name || 'Khách',
                email: populated.user?.email || o.guestInfo?.email || '',
                totalAmount: orderRevenue,
                cost: orderCost,
                profit: orderProfit,
                status: o.status,
                createdAt: o.createdAt,
                itemCount: o.items?.length || 0
            };
        }));

        return res.json({
            totalRevenue,
            totalProfit,
            totalCost,
            countOrders,
            orderByStatus,
            orderByStatusAndMonth,
            revenueByMonth,
            topProducts,
            topProductsByMonth,
            lowStockProducts,
            lowStockProductCount: lowStockProducts.length,
            visitsByMonth,
            websiteVisits,
            recentOrders: recentOrdersFormatted,
        });
    } catch (err) {
        console.error("adminStats error:", err);
        return res.status(500).json({ message: "Lỗi server khi thống kê." });
    }
};

// Manual triggers for cron/maintenance
exports.runAutoExpireOrders = async (req, res) => {
    try {
        const ids = await autoExpireOrders(req.body?.filter || {});
        return res.json({ ok: true, count: ids.length, ids });
    } catch (err) {
        console.error("runAutoExpireOrders error:", err);
        return res.status(500).json({ message: "Lỗi khi tự động hết hạn đơn hàng" });
    }
};

exports.runAutoCompleteOrders = async (req, res) => {
    try {
        const ids = await autoCompleteOrders(req.body?.filter || {});
        return res.json({ ok: true, count: ids.length, ids });
    } catch (err) {
        console.error("runAutoCompleteOrders error:", err);
        return res.status(500).json({ message: "Lỗi khi tự động hoàn thành đơn hàng" });
    }
};

// Expose maintenance utilities
exports.autoExpireOrders = autoExpireOrders;
exports.autoCompleteOrders = autoCompleteOrders;
