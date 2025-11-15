const crypto = require("crypto");
const Carts = require("../models/Carts");
const Product = require("../../admin-services/models/Product");
const Stock = require("../models/Stock");
const Reservation = require("../models/Reservation");
const { getAvailableBatches, getAvailableQuantity } = require("./reservationController");

// Helper function to get or generate session key
function getSessionKey(req) {
    // Priority: x-session-key header > sessionID > generate new
    const headerKey = req.headers["x-session-key"];
    if (headerKey) return String(headerKey);
    
    const sessionId = req.sessionID;
    if (sessionId) return String(sessionId);
    
    // Generate a fallback session key if none exists
    const fallbackKey = `guest-${crypto.randomBytes(16).toString('hex')}`;
    console.warn("⚠️ No session key found in cart, generated fallback:", fallbackKey);
    return fallbackKey;
}

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
        cartKey = (typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
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
    
    // 🔥 Populate availableStock cho mỗi item từ batch
    const ImportItem = require("../../admin-services/models/ImportItem");
    
    for (const item of cart.items) {
        if (item.batchId) {
            try {
                const batch = await ImportItem.findById(item.batchId);
                if (batch) {
                    const displayStock = batch.quantity - (batch.soldQuantity || 0) - (batch.damagedQuantity || 0);
                    item.availableStock = Math.max(0, displayStock);
                } else {
                    item.availableStock = 0;
                }
            } catch (err) {
                console.error('Error fetching batch stock:', err);
                item.availableStock = 0;
            }
        } else {
            // Fallback to Stock model nếu chưa có batch
            try {
                const stock = await Stock.findOne({ product: item.product });
                item.availableStock = stock?.onHand || 0;
            } catch (err) {
                item.availableStock = 0;
            }
        }
    }
    
    return res.json(cart);
};


// ====== addItem (tích hợp reservation system) ======
exports.addItem = async (req, res) => {
    const { productId, quantity } = req.body || {};
    const qty = Math.max(1, Number(quantity) || 1);

    // 🔥 Tạo reservation trước
    const reservationResult = await createCartReservation(req, productId, qty);
    if (!reservationResult.success) {
        return res.status(400).json({ message: reservationResult.message });
    }

    const cart = await getOrCreateCart(req, res);
    let product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ message: "Sản phẩm không tồn tại." });

    // ✅ Sử dụng giá đã lock từ reservation
    const finalPrice = reservationResult.lockedPrice;
    const pct = reservationResult.discountPercent;

    // Tìm item trong giỏ
    const idx = cart.items.findIndex(i => String(i.product) === String(product._id));

    if (idx >= 0) {
        cart.items[idx].quantity += qty;
        cart.items[idx].price = finalPrice;
        cart.items[idx].lockedPrice = finalPrice;
        cart.items[idx].discountPercent = pct;
        cart.items[idx].unit = product.unit || "kg";
        cart.items[idx].batchId = reservationResult.batchId || null; // ✅ Thêm batchId
        cart.items[idx].reservationId = reservationResult.reservation._id;
        cart.items[idx].lockedAt = new Date();
    } else {
        cart.items.push({
            product: product._id,
            name: product.name,
            image: Array.isArray(product.image) ? product.image.filter(Boolean) : [product.image].filter(Boolean),
            price: finalPrice,
            lockedPrice: finalPrice,
            quantity: qty,
            total: 0,
            discountPercent: pct,
            unit: product.unit || "kg",
            batchId: reservationResult.batchId || null, // ✅ Thêm batchId
            reservationId: reservationResult.reservation._id,
            lockedAt: new Date()
        });
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

        // ✅ kiểm tồn theo batch displayStock
        const ImportItem = require("../../admin-services/models/ImportItem");
        let availableStock = 0;
        
        if (item.batchId) {
            // Có batch => check displayStock
            const batch = await ImportItem.findById(item.batchId);
            if (batch) {
                availableStock = batch.quantity - (batch.soldQuantity || 0) - (batch.damagedQuantity || 0);
                availableStock = Math.max(0, availableStock);
            }
        } else {
            // Fallback: check Stock.onHand
            const stock = await Stock.findOne({ product: productId }).lean();
            availableStock = Number(stock?.onHand) || 0;
        }

        if (qty > availableStock) {
            if (availableStock === 0) {
                cart.items = cart.items.filter((i) => i !== item); // hết hàng => xóa khỏi giỏ
            } else {
                item.quantity = availableStock; // hạ về mức tồn
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

        // Tìm item để lấy reservationId trước khi xóa
        const itemToRemove = cart.items.find(
            (i) => String(i.product) === String(productId)
        );

        // ⚡ lọc item ra khỏi mảng
        cart.items = cart.items.filter(
            (i) => String(i.product) !== String(productId)
        );

        if (before === cart.items.length) {
            return res.status(404).json({ message: "Item không có trong giỏ." });
        }

        // 🔥 Release reservation nếu có
        if (itemToRemove?.reservationId) {
            try {
                const reservation = await Reservation.findById(itemToRemove.reservationId);
                if (reservation && reservation.status === "active") {
                    // Xóa item khỏi reservation
                    reservation.items = reservation.items.filter(
                        item => item.product.toString() !== productId.toString()
                    );
                    
                    if (reservation.items.length === 0) {
                        // Nếu không còn item nào, release reservation
                        reservation.status = "released";
                        reservation.releasedAt = new Date();
                    }
                    
                    await reservation.save();
                    console.log(`Released reservation for product ${productId}`);
                }
            } catch (err) {
                console.error("Error releasing reservation:", err);
                // Không throw error, vẫn xóa item khỏi cart
            }
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

// ====== Helper: Tạo reservation khi add to cart ======
async function createCartReservation(req, productId, quantity) {
    try {
        const userId = getUserIdFromToken(req);
        const sessionKey = getSessionKey(req) || req.cookies?.CART_ID;

        const product = await Product.findById(productId);
        if (!product) {
            return { success: false, message: "Sản phẩm không tồn tại" };
        }

        // Lấy batch available theo FEFO
        const batches = await getAvailableBatches(productId);
        
        let activeBatch = null;
        let availableQty = 0;
        let lockedPrice = product.price || 0;
        
        if (batches.length > 0) {
            // Có ImportItem → dùng batch
            activeBatch = batches[0];
            availableQty = await getAvailableQuantity(activeBatch._id);
            lockedPrice = activeBatch.sellingPrice || activeBatch.unitPrice || product.price;
            
            if (availableQty < quantity) {
                return { 
                    success: false, 
                    message: `Chỉ còn ${availableQty} ${product.unit || "kg"} có thể đặt`
                };
            }
        } else {
            // Chưa có ImportItem → fallback dùng Product.price, không validate stock
            console.warn(`Product ${productId} chưa có ImportItem, dùng giá fallback`);
            lockedPrice = product.price || 0;
            // Không set activeBatch → batchId sẽ là null
        }

        // Tìm hoặc tạo reservation
        let reservation = await Reservation.findOne({
            $or: [
                { user: userId },
                { sessionKey: sessionKey }
            ],
            type: "cart",
            status: "active"
        });

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
        const discountPercent = product.discountPercent || 0;

        if (reservation) {
            const existingItemIndex = reservation.items.findIndex(
                item => item.product.toString() === productId.toString()
            );

            if (existingItemIndex >= 0) {
                reservation.items[existingItemIndex].quantity += quantity;
                // Cập nhật giá nếu có batch mới
                if (activeBatch) {
                    reservation.items[existingItemIndex].batchId = activeBatch._id;
                    reservation.items[existingItemIndex].lockedPrice = lockedPrice;
                }
            } else {
                reservation.items.push({
                    product: productId,
                    batchId: activeBatch?._id || null, // Có thể null nếu chưa có ImportItem
                    quantity: quantity,
                    lockedPrice: lockedPrice,
                    discountPercent: discountPercent,
                    unit: product.unit || "kg"
                });
            }
            
            reservation.expiresAt = expiresAt;
            await reservation.save();
        } else {
            reservation = await Reservation.create({
                user: userId,
                sessionKey: sessionKey,
                type: "cart",
                status: "active",
                items: [{
                    product: productId,
                    batchId: activeBatch?._id || null, // Có thể null nếu chưa có ImportItem
                    quantity: quantity,
                    lockedPrice: lockedPrice,
                    discountPercent: discountPercent,
                    unit: product.unit || "kg"
                }],
                expiresAt: expiresAt
            });
        }

        return {
            success: true,
            reservation: reservation,
            batchId: activeBatch?._id || null, // ✅ Thêm batchId
            lockedPrice: lockedPrice,
            discountPercent: discountPercent
        };
    } catch (error) {
        console.error("Error in createCartReservation:", error);
        return { success: false, message: "Lỗi khi tạo reservation" };
    }
}

exports.createCartReservation = createCartReservation;
