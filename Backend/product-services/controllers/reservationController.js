const Reservation = require("../models/Reservation");
const ImportItem = require("../../admin-services/models/ImportItem");
const Product = require("../models/Product");
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
    const availableQty = await getAvailableQuantity(activeBatch._id);
    
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

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

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
    const sessionKey = getSessionKey(req);
    const { selectedProductIds } = req.body; // Array of product IDs to checkout

    // Tìm cart reservation
    const reservation = await Reservation.findOne({
      $or: [
        { user: userId },
        { sessionKey: sessionKey }
      ],
      type: "cart",
      status: "active"
    });

    if (!reservation) {
      return res.status(404).json({ message: "Không tìm thấy giỏ hàng" });
    }

    // Lọc items được chọn để checkout
    let itemsToCheckout = reservation.items;
    if (selectedProductIds && selectedProductIds.length > 0) {
      itemsToCheckout = reservation.items.filter(item =>
        selectedProductIds.includes(item.product.toString())
      );
    }

    if (itemsToCheckout.length === 0) {
      return res.status(400).json({ message: "Không có sản phẩm nào được chọn" });
    }

    // Validate số lượng còn đủ không
    for (const item of itemsToCheckout) {
      // Kiểm tra batchId tồn tại
      if (!item.batchId) {
        console.warn(`Item ${item.product} không có batchId, bỏ qua validation`);
        continue;
      }
      
      const availableQty = await getAvailableQuantity(item.batchId);
      if (availableQty < item.quantity) {
        const product = await Product.findById(item.product);
        return res.status(400).json({
          message: `Sản phẩm "${product?.name}" chỉ còn ${availableQty} ${item.unit}`,
          productId: item.product
        });
      }
    }

    // Tạo checkout reservation mới (30 phút cho payment)
    const checkoutReservation = await Reservation.create({
      user: userId,
      sessionKey: sessionKey,
      type: "checkout",
      status: "active",
      items: itemsToCheckout,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 phút
    });

    // Xóa items đã checkout khỏi cart reservation
    if (selectedProductIds && selectedProductIds.length > 0) {
      reservation.items = reservation.items.filter(item =>
        !selectedProductIds.includes(item.product.toString())
      );
      
      if (reservation.items.length === 0) {
        reservation.status = "released";
        reservation.releasedAt = new Date();
      }
      await reservation.save();
    } else {
      // Checkout tất cả -> release cart reservation
      reservation.status = "released";
      reservation.releasedAt = new Date();
      await reservation.save();
    }

    res.json({
      success: true,
      checkoutReservation: {
        id: checkoutReservation._id,
        items: checkoutReservation.items,
        expiresAt: checkoutReservation.expiresAt
      }
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

    // Confirm reservation
    reservation.status = "confirmed";
    reservation.confirmedAt = new Date();
    reservation.orderId = orderId;
    await reservation.save();

    res.json({
      success: true,
      message: "Đã xác nhận đơn hàng"
    });
  } catch (error) {
    console.error("Error in confirmPayment:", error);
    res.status(500).json({ message: "Lỗi khi xác nhận thanh toán", error: error.message });
  }
};

/**
 * Release reservation khi payment fail hoặc cancel
 */
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

    console.log(`[Cleanup] Released ${result.modifiedCount} expired reservations`);
    return result;
  } catch (error) {
    console.error("Error in cleanupExpiredReservations:", error);
    throw error;
  }
};

// ==================== Helper Functions ====================

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
    .select("quantity damagedQuantity unitPrice sellingPrice importDate expiryDate discountPercent discountStartDate discountEndDate")
    .lean();

  // Tính số lượng đã bán theo FEFO để xác định lô còn hàng
  const Order = require("../models/Order");
  const orders = await Order.find({
    'items.product': productId,
    status: { $in: ['paid', 'completed', 'shipped', 'delivered'] }
  }).select('items').lean();

  const totalSold = orders.reduce((sum, order) => {
    const productItems = order.items.filter(item => item.product.toString() === productId);
    return sum + productItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

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

  // Phân bổ số lượng đã bán và lọc chỉ lấy lô còn hàng
  let remainingSold = totalSold;
  const batchesWithStock = [];
  
  for (const batch of batches) {
    const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
    const soldFromThisBatch = Math.min(remainingSold, effectiveQty);
    const remainingInBatch = Math.max(0, effectiveQty - soldFromThisBatch);
    
    // CHỈ thêm lô còn hàng
    if (remainingInBatch > 0) {
      batchesWithStock.push({
        ...batch,
        remainingQuantity: remainingInBatch
      });
    }
    
    remainingSold -= soldFromThisBatch;
  }

  return batchesWithStock;
}

/**
 * Tính số lượng available của một batch (trừ reserved & sold)
 */
async function getAvailableQuantity(batchId) {
  const batch = await ImportItem.findById(batchId);
  if (!batch) return 0;

  // Tính số lượng đã sold (từ orders completed)
  const Order = require("../models/Order");
  const orders = await Order.find({
    "items.product": batch.product,
    status: { $in: ["completed", "shipped", "delivered"] }
  }).select("items createdAt").lean();

  let totalSold = 0;
  orders.forEach(order => {
    order.items.forEach(item => {
      if (item.product.toString() === batch.product.toString()) {
        totalSold += item.quantity;
      }
    });
  });

  // Tính số lượng đã reserved (active reservations)
  const activeReservations = await Reservation.find({
    "items.batchId": batchId,
    status: "active"
  }).lean();

  let totalReserved = 0;
  activeReservations.forEach(reservation => {
    reservation.items.forEach(item => {
      if (item.batchId.toString() === batchId.toString()) {
        totalReserved += item.quantity;
      }
    });
  });

  const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
  const available = Math.max(0, effectiveQty - totalSold - totalReserved);

  return available;
}

module.exports.getAvailableQuantity = getAvailableQuantity;
module.exports.getAvailableBatches = getAvailableBatches;
