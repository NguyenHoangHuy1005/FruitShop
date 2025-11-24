const Reservation = require("../models/Reservation");
const ImportItem = require("../../admin-services/models/ImportItem");
const Product = require("../models/Product");
const Carts = require("../models/Carts");
const Order = require("../models/Order");
const SpoilageRecord = require("../models/SpoilageRecord");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { computeBatchPricing } = require("../utils/batchPricing");

// Helper function to extract userId from token without requiring auth middleware
function extractUserId(req) {
  const token = req.headers.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_KEY);
    return decoded?.id || decoded?._id || null;
  } catch (error) {
    return null;
  }
}

// Helper function to get or generate session key
function getSessionKey(req) {
  const userId = req.user?.id || req.user?._id;
  if (userId) return `user-${userId}`;
  // Priority: x-session-key header > sessionID > generate new
  const headerKey = req.headers["x-session-key"];
  if (headerKey) return String(headerKey);

  const sessionId = req.sessionID;
  if (sessionId) return String(sessionId);
  
  // Generate a fallback session key if none exists
  const fallbackKey = `guest-${crypto.randomBytes(16).toString('hex')}`;
  console.warn("⚠️ No session key found, generated fallback:", fallbackKey);
  return fallbackKey;
}

/**
 * Tạo hoặc cập nhật reservation khi add to cart
 * Type: "cart" - tạm thời 15 phút
 */
exports.reserveForCart = async (req, res) => {
  try {
    return res.status(410).json({ message: "Cart reservations are only created during checkout." });
    const { productId, quantity } = req.body;
    const userId = req.user?.id || extractUserId(req);
    const sessionKey = getSessionKey(req);

    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ message: "Invalid productId or quantity" });
    }

    // Lấy thông tin sản phẩm và batch
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Lấy batch còn hàng theo FEFO
    const batches = await getAvailableBatches(productId);
    if (batches.length === 0) {
      return res.status(400).json({ message: "Sản phẩm hiện đã hết hàng" });
    }

    // Tính toán số lượng có thể reserve từ batch đầu tiên
    const activeBatch = batches[0];
    const availableQty = await getAvailableQuantity(activeBatch._id, userId, sessionKey);
    
    if (availableQty < quantity) {
      return res.status(400).json({ 
        message: `Chỉ còn ${availableQty} ${product.unit || "kg"} có thể đặt`,
        availableQuantity: availableQty
      });
    }

    // Tìm reservation hiện tại của user/session
    let reservation = await Reservation.findOne({
      $or: [
        { user: userId },
        { sessionKey: sessionKey }
      ],
      type: "cart",
      status: "active"
    });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    // Lấy giá và discount hiện tại
    const pricing = computeBatchPricing(activeBatch, product);
    const lockedPrice = pricing.basePrice;
    const discountPercent = pricing.discountPercent || 0;

    if (reservation) {
      // Kiểm tra xem sản phẩm đã có trong reservation chưa
      const existingItemIndex = reservation.items.findIndex(
        item => item.product.toString() === productId
      );

      if (existingItemIndex >= 0) {
        // Cập nhật số lượng
        reservation.items[existingItemIndex].quantity += quantity;
      } else {
        // Thêm item mới
        reservation.items.push({
          product: productId,
          batchId: activeBatch._id,
          quantity: quantity,
          lockedPrice: lockedPrice,
          discountPercent: discountPercent,
          unit: product.unit || "kg"
        });
      }
      
      reservation.expiresAt = expiresAt; // Gia hạn thêm 15 phút
      await reservation.save();
    } else {
      // Tạo reservation mới
      reservation = await Reservation.create({
        user: userId,
        sessionKey: sessionKey,
        type: "cart",
        status: "active",
        items: [{
          product: productId,
          batchId: activeBatch._id,
          quantity: quantity,
          lockedPrice: lockedPrice,
          discountPercent: discountPercent,
          unit: product.unit || "kg"
        }],
        expiresAt: expiresAt
      });
    }

    res.json({
      success: true,
      message: "Đã thêm vào giỏ hàng",
      reservation: {
        id: reservation._id,
        expiresAt: reservation.expiresAt,
        items: reservation.items
      }
    });
  } catch (error) {
    console.error("Error in reserveForCart:", error);
    res.status(500).json({ message: "Lỗi khi thêm vào giỏ hàng", error: error.message });
  }
};

/**
 * Chuyển reservation từ "cart" sang "checkout"
 * Gia hạn thời gian cho đến khi payment hoàn tất
 */
exports.confirmForCheckout = async (req, res) => {
  try {
    const userId = req.user?.id || extractUserId(req);
    const cartKey = userId ? null : (req.cookies?.CART_ID || null);
    const sessionKey = userId ? `user-${userId}` : (cartKey || getSessionKey(req));
    const { selectedProductIds } = req.body; // Array of product IDs to checkout

    // Lấy giỏ hiện tại (user hoặc guest cart)
    const cart = await (async () => {
      if (userId) {
        let userCart = await Carts.findOne({ user: userId, status: "active" });
        if (userCart) return userCart;
      }
      if (cartKey) {
        return await Carts.findOne({ cartKey, status: "active" });
      }
      return null;
    })();

    if (!cart || !cart.items?.length) {
      return res.status(404).json({ message: "Không tìm thấy giỏ hàng" });
    }

    // Lọc items theo yêu cầu
    const cartItems = (cart.items || []).filter((it) => {
      if (!selectedProductIds || selectedProductIds.length === 0) return true;
      return selectedProductIds.includes(String(it.product));
    });

    if (!cartItems.length) {
      return res.status(400).json({ message: "Không có sản phẩm nào được chọn" });
    }

    const ownerFilter = userId ? { user: userId } : { sessionKey };
    const now = new Date();

    await Reservation.updateMany(
      {
        ...ownerFilter,
        type: "checkout",
        status: "active",
        expiresAt: { $lte: now },
      },
      {
        $set: {
          status: "expired",
          releasedAt: now,
        },
      }
    );

    const activeCheckoutReservations = await Reservation.find({
      ...ownerFilter,
      type: "checkout",
      status: "active",
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    const personalReservedByBatch = new Map();
    for (const reservation of activeCheckoutReservations) {
      for (const item of reservation.items || []) {
        if (!item?.batchId) continue;
        const qty = Number(item.quantity) || 0;
        if (!qty) continue;
        const key = String(item.batchId);
        personalReservedByBatch.set(key, (personalReservedByBatch.get(key) || 0) + qty);
      }
    }

    // Validate về gắn batch FEFO
    const reservationItems = [];
    for (const item of cartItems) {
      const productId = String(item.product);
      const productDoc = await Product.findById(productId).lean();
      if (!productDoc) {
        return res.status(404).json({ message: `Sản phẩm không tồn tại: ${productId}` });
      }

      const batches = await getAvailableBatches(productId);
      const allocations = [];
      let remainingQty = item.quantity;
      let totalAvailable = 0;

      for (const batch of batches) {
        if (remainingQty <= 0) break;
        const batchKey = String(batch._id);
        const baseQty = await getAvailableQuantity(batch._id, userId, sessionKey);
        const personalQty = personalReservedByBatch.get(batchKey) || 0;
        const effectiveQty = baseQty + personalQty;
        if (effectiveQty <= 0) continue;

        totalAvailable += effectiveQty;
        const takeQty = Math.min(effectiveQty, remainingQty);
        if (takeQty > 0) {
          allocations.push({ batch, quantity: takeQty });
          remainingQty -= takeQty;
          if (personalQty > 0) {
            const usedFromPersonal = Math.min(personalQty, takeQty);
            const remainingPersonal = personalQty - usedFromPersonal;
            if (remainingPersonal > 0) {
              personalReservedByBatch.set(batchKey, remainingPersonal);
            } else {
              personalReservedByBatch.delete(batchKey);
            }
          }
        }
      }

      if (remainingQty > 0) {
        const fallbackQty = totalAvailable || 0;
        return res.status(400).json({
          message: `Sản phẩm "${productDoc?.name || productId}" không đủ hàng (chỉ còn ${fallbackQty}).`,
          productId,
          availableQuantity: fallbackQty,
          requestedQuantity: item.quantity,
        });
      }

      for (const allocation of allocations) {
        const pricing = computeBatchPricing(allocation.batch, productDoc);
        reservationItems.push({
          product: productId,
          batchId: allocation.batch._id,
          quantity: allocation.quantity,
          lockedPrice: pricing.basePrice,
          discountPercent: pricing.discountPercent || 0,
          unit: productDoc.unit || "kg",
        });
      }
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
    let checkoutReservation = activeCheckoutReservations[0] || null;

    if (checkoutReservation) {
      checkoutReservation.items = reservationItems;
      checkoutReservation.expiresAt = expiresAt;
      checkoutReservation.sessionKey = sessionKey;
      if (userId && !checkoutReservation.user) {
        checkoutReservation.user = userId;
      }
      checkoutReservation.status = "active";
      await checkoutReservation.save();
    } else {
      checkoutReservation = await Reservation.create({
        user: userId || null,
        sessionKey,
        type: "checkout",
        status: "active",
        items: reservationItems,
        expiresAt,
      });
    }

    if (activeCheckoutReservations.length > 1) {
      const redundant = activeCheckoutReservations.slice(1).map((res) => res._id).filter(Boolean);
      if (redundant.length) {
        await Reservation.updateMany(
          { _id: { $in: redundant } },
          { $set: { status: "released", releasedAt: new Date() } }
        );
      }
    }

    return res.json({
      success: true,
      checkoutReservation: {
        id: checkoutReservation._id,
        items: checkoutReservation.items,
        expiresAt: checkoutReservation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error in confirmForCheckout:", error);
    res.status(500).json({ message: "Lỗi khi chuyển sang thanh toán", error: error.message });
  }
};

/**
 * Xác nhận reservation khi payment thành công
 */
exports.confirmPayment = async (req, res) => {
  try {
    const { reservationId, orderId } = req.body;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: "Không tìm thấy reservation" });
    }

    if (reservation.status !== "active") {
      return res.status(400).json({ message: "Reservation không còn active" });
    }

    reservation.status = "confirmed";
    reservation.confirmedAt = new Date();
    reservation.orderId = orderId;
    await reservation.save();

    let order = null;
    if (orderId) {
      order = await Order.findById(orderId);
      if (order) {
        if (order.status === "pending") {
          order.status = "processing";
        }
        if (!order.paymentCompletedAt) {
          order.paymentCompletedAt = new Date();
        }
        order.paymentDeadline = null;
        order.autoConfirmAt = null;
        await order.save();
      }
    }

    res.json({
      success: true,
      message: "Đã xác nhận đơn hàng",
      order,
    });
  } catch (error) {
    console.error("Error in confirmPayment:", error);
    res.status(500).json({ message: "Lỗi khi xác nhận thanh toán", error: error.message });
  }
};

exports.releaseReservation = async (req, res) => {
  try {
    const { reservationId } = req.body;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: "Không tìm thấy reservation" });
    }

    if (reservation.status === "confirmed") {
      return res.status(400).json({ message: "Không thể release reservation đã confirmed" });
    }

    reservation.status = "released";
    reservation.releasedAt = new Date();
    await reservation.save();

    res.json({
      success: true,
      message: "Đã hủy reservation"
    });
  } catch (error) {
    console.error("Error in releaseReservation:", error);
    res.status(500).json({ message: "Lỗi khi hủy reservation", error: error.message });
  }
};

/**
 * Lấy thông tin reservation hiện tại của user
 */
exports.getMyReservation = async (req, res) => {
  try {
    const userId = req.user?.id || extractUserId(req);
    const sessionKey = getSessionKey(req);
    const { type } = req.query; // "cart" or "checkout"

    const query = {
      $or: [
        { user: userId },
        { sessionKey: sessionKey }
      ],
      status: "active"
    };

    if (type) {
      query.type = type;
    }

    const reservations = await Reservation.find(query)
      .populate("items.product", "name image unit")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      reservations: reservations
    });
  } catch (error) {
    console.error("Error in getMyReservation:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông tin reservation", error: error.message });
  }
};

/**
 * Background job: Tự động release expired reservations
 */
exports.cleanupExpiredReservations = async () => {
  try {
    const now = new Date();
    const expiredReservations = await Reservation.find({
      status: "active",
      expiresAt: { $lt: now }
    }).lean();
    
    const result = await Reservation.updateMany(
      {
        status: "active",
        expiresAt: { $lt: now }
      },
      {
        $set: {
          status: "expired",
          releasedAt: now
        }
      }
    );

    if (expiredReservations.length) {
      for (const reservation of expiredReservations) {
        await recordSpoilageForReservation(reservation, now);
      }
    }

    console.log(`[Cleanup] Released ${result.modifiedCount} expired reservations`);
    return result;
  } catch (error) {
    console.error("Error in cleanupExpiredReservations:", error);
    throw error;
  }
};

// ==================== Helper Functions ====================
async function recordSpoilageForReservation(reservation, now = new Date()) {
  if (!reservation?.items?.length) return;
  for (const item of reservation.items) {
    const qty = Number(item.quantity) || 0;
    if (!qty || !item.batchId) continue;
    try {
      const batch = await ImportItem.findById(item.batchId).select("product expiryDate").lean();
      if (!batch) continue;
      const expiryDate = batch.expiryDate ? new Date(batch.expiryDate) : null;
      if (expiryDate && expiryDate <= now) {
        await SpoilageRecord.create({
          product: batch.product || item.product,
          batch: item.batchId,
          order: null,
          quantity: qty,
          reason: "expired_on_return",
          expiryDate: batch.expiryDate || null,
          recordedBy: reservation.user || null,
        });
      }
    } catch (err) {
      console.error("[reservation] record spoilage failed:", err?.message || err);
    }
  }
}

/**
 * Lấy danh sách batch available theo FEFO - CHỈ trả về lô còn hàng
 */
async function getAvailableBatches(productId) {
  const now = new Date();
  const batches = await ImportItem.find({
    product: productId,
    $or: [
      { expiryDate: null },
      { expiryDate: { $gt: now } }
    ]
  })
    .select("quantity soldQuantity damagedQuantity unitPrice sellingPrice importDate expiryDate discountPercent discountStartDate discountEndDate")
    .lean();

  // Sắp xếp theo FEFO + FIFO
  batches.sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) {
      return new Date(a.importDate) - new Date(b.importDate);
    }
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    const expiryDiff = new Date(a.expiryDate) - new Date(b.expiryDate);
    if (expiryDiff === 0) {
      return new Date(a.importDate) - new Date(b.importDate);
    }
    return expiryDiff;
  });

  // ✅ Sử dụng soldQuantity trực tiếp từ batch thay vì tính lại
  const batchesWithStock = [];
  
  for (const batch of batches) {
    const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
    const soldFromThisBatch = Number(batch.soldQuantity) || 0;
    const remainingInBatch = Math.max(0, effectiveQty - soldFromThisBatch);
    
    // CHỈ thêm lô còn hàng
    if (remainingInBatch > 0) {
      batchesWithStock.push({
        ...batch,
        remainingQuantity: remainingInBatch
      });
    }
  }

  return batchesWithStock;
}

/**
 * Tính số lượng available của một batch (trừ reserved & sold)
 */
async function getAvailableQuantity(batchId, userId = null, sessionKey = null) {
  const batch = await ImportItem.findById(batchId);
  if (!batch) return 0;

  const now = new Date();

  // ✅ Sử dụng soldQuantity từ batch thay vì tính toán lại
  // soldQuantity được cập nhật trong orderController khi tạo đơn
  const soldFromBatch = Number(batch.soldQuantity) || 0;

  // Tính số lượng đã reserved (active reservations)
  await Reservation.updateMany(
    {
      "items.batchId": batchId,
      status: "active",
      expiresAt: { $lte: now },
    },
    { $set: { status: "expired", releasedAt: now } }
  );

  const activeReservations = await Reservation.find({
    "items.batchId": batchId,
    status: "active",
    expiresAt: { $gt: now },
  }).lean();

  let totalReserved = 0;
  let reservedSelf = 0;
  const normalizedUserId = userId ? String(userId) : null;
  const normalizedSessionKey = sessionKey ? String(sessionKey) : null;

  activeReservations.forEach(reservation => {
    const isSameUser = normalizedUserId && reservation.user && String(reservation.user) === normalizedUserId;
    const isSameSession = normalizedSessionKey && reservation.sessionKey === normalizedSessionKey;
    reservation.items.forEach(item => {
      if (item.batchId && item.batchId.toString() === batchId.toString()) {
        const qty = Number(item.quantity) || 0;
        totalReserved += qty;
        if (isSameUser || isSameSession) {
          reservedSelf += qty;
        }
      }
    });
  });

  const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
  const available = Math.max(0, effectiveQty - soldFromBatch - totalReserved + reservedSelf);

  return available;
}

module.exports.getAvailableQuantity = getAvailableQuantity;
module.exports.getAvailableBatches = getAvailableBatches;
