const crypto = require("crypto");
const Carts = require("../models/Carts");
const Product = require("../../admin-services/models/Product");
const ImportItem = require("../../admin-services/models/ImportItem");
const Stock = require("../models/Stock");
const { getAvailableBatches, getAvailableQuantity } = require("./reservationController");
const { computeBatchPricing } = require("../utils/batchPricing");

// Helper: ensure guest cart key via cookie (persistent)
function getGuestCartKey(req, res) {
    let cartKey = req.cookies?.CART_ID;
    if (!cartKey) {
        cartKey = (typeof crypto.randomUUID === "function")
            ? crypto.randomUUID()
            : crypto.randomBytes(16).toString("hex");
        res.cookie("CART_ID", cartKey, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
        });
    }
    return cartKey;
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
        maxAge: 1000 * 60 * 60 * 24 * 365,
        });
    }
    return cartKey;
}

function resolveCartSessionKey(req, res, userId) {
    if (userId) return `user-${userId}`;
    return ensureCartCookie(req, res);
}

async function getOrCreateCart(req, res) {
    const userId = getUserIdFromToken(req);
    const cartKey = ensureCartCookie(req, res);

    let cart = null;
    let guestCart = null;

    if (userId) {
        // ưu tiên giỏ user
        cart = await Carts.findOne({ user: userId, status: "active" });
        if (!cart) {
            cart = await Carts.create({
                user: userId,
                cartKey,
                items: [],
                summary: { totalItems: 0, subtotal: 0 },
            });
        } else if (cartKey) {
            guestCart = await Carts.findOne({ cartKey, status: "active", user: null });
            if (guestCart && guestCart._id.toString() !== cart._id.toString()) {
                for (const gItem of guestCart.items) {
                    const idx = cart.items.findIndex(i => String(i.product) === String(gItem.product));
                    if (idx >= 0) {
                        cart.items[idx].quantity += gItem.quantity;
                    } else {
                        cart.items.push(gItem.toObject ? gItem.toObject() : gItem);
                    }
                }
                recalc(cart);
                await cart.save();
                guestCart.status = "abandoned";
                await guestCart.save();
            }
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
        const basePrice = Number(it.lockedPrice ?? it.price ?? 0);
        const pct = Number(it.discountPercent) || 0;
        const finalPrice = pct > 0 ? Math.max(0, Math.round(basePrice * (100 - pct) / 100)) : basePrice;
        it.price = finalPrice;
        it.total = finalPrice * it.quantity;
        totalItems += it.quantity;
        subtotal += it.total;
    }
    cart.summary.totalItems = totalItems;
    cart.summary.subtotal = subtotal;
}

exports.getCart = async (req, res) => {
    const userId = getUserIdFromToken(req);
    const sessionKey = resolveCartSessionKey(req, res, userId);
    const cart = await getOrCreateCart(req, res);
    
    // 🔥 Populate availableStock cho mỗi item từ batch
    
    for (const item of cart.items) {
        if (item.batchId) {
            try {
                const available = await getAvailableQuantity(item.batchId, userId, sessionKey);
                item.availableStock = Math.max(0, available);
            } catch (err) {
                console.error('Error fetching batch stock:', err);
                item.availableStock = 0;
            }
        } else {
            try {
                const stock = await Stock.findOne({ product: item.product });
                item.availableStock = Math.max(0, Number(stock?.onHand) || 0);
            } catch (err) {
                item.availableStock = 0;
            }
        }
        item.isOutOfStock = item.availableStock === 0;
    }
    
    return res.json(cart);
};


// ====== addItem (khong giu hang, chi them vao gio) ======
exports.addItem = async (req, res) => {
    const { productId, quantity } = req.body || {};
    const qty = Math.max(1, Number(quantity) || 1);

    const cart = await getOrCreateCart(req, res);
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ message: "Sản phẩm không tồn tại." });

    // Được tính giá theo batch khi dùng (không lock hàng)
    const batches = await getAvailableBatches(productId);
    let pricing = { basePrice: Number(product.price) || 0, discountPercent: Number(product.discountPercent) || 0 };
    if (batches.length > 0) {
        pricing = computeBatchPricing(batches[0], product);
    }
    const lockedPrice = Number(pricing.basePrice) || 0;
    const pct = Number(pricing.discountPercent) || 0;
    const unitPrice = pct > 0 ? Math.max(0, Math.round(lockedPrice * (100 - pct) / 100)) : lockedPrice;

    const idx = cart.items.findIndex(i => String(i.product) === String(product._id));

    if (idx >= 0) {
        cart.items[idx].quantity += qty;
        cart.items[idx].price = unitPrice;
        cart.items[idx].lockedPrice = lockedPrice;
        cart.items[idx].discountPercent = pct;
        cart.items[idx].unit = product.unit || "kg";
        cart.items[idx].batchId = batches[0]?._id || null;
        cart.items[idx].lockedAt = new Date();
    } else {
        cart.items.push({
            product: product._id,
            name: product.name,
            image: Array.isArray(product.image) ? product.image.filter(Boolean) : [product.image].filter(Boolean),
            price: unitPrice,
            lockedPrice: lockedPrice,
            quantity: qty,
            total: 0,
            discountPercent: pct,
            unit: product.unit || "kg",
            batchId: batches[0]?._id || null,
            lockedAt: new Date()
        });
    }

    recalc(cart);
    await cart.save();
    return res.json(cart);
};


// ====== updateItem (da chinh gia giam + kiem ton) ======
exports.updateItem = async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body || {};
    const qty = Math.max(0, Number(quantity) || 0);

    const userId = getUserIdFromToken(req);
    const sessionKey = resolveCartSessionKey(req, res, userId);
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
        finalQuantity = 0;
    } else {
        // ✅ giá mới nhất
        const product = await Product.findById(productId).lean();
        let pricing = { basePrice: Number(product?.price) || 0, finalPrice: Number(product?.price) || 0, discountPercent: Number(product?.discountPercent) || 0 };
        if (item.batchId) {
            const batch = await ImportItem.findById(item.batchId).lean();
            if (batch) {
                pricing = computeBatchPricing(batch, product);
            }
        }
        item.lockedPrice = pricing.basePrice;
        item.price = pricing.finalPrice;
        item.discountPercent = pricing.discountPercent || 0;

        // ✅ kiểm tồn theo batch displayStock
        let availableStock = 0;
        
        if (item.batchId) {
            availableStock = await getAvailableQuantity(item.batchId, userId, sessionKey);
        } else {
            const stock = await Stock.findOne({ product: productId }).lean();
            availableStock = Number(stock?.onHand) || 0;
        }

        availableStock = Math.max(0, availableStock);

        if (qty > availableStock) {
            if (availableStock === 0) {
                item.quantity = 0;
                finalQuantity = 0;
            } else {
                item.quantity = availableStock; // hạ về mức tồn
                finalQuantity = availableStock;
            }
        } else {
            item.quantity = qty;
            finalQuantity = qty;
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

        // ⚡ lọc item ra khỏi mảng
        cart.items = cart.items.filter(
            (i) => String(i.product) !== String(productId)
        );

        if (before === cart.items.length) {
            return res.status(404).json({ message: "Item không có trong giỏ." });
        }

        // 🔥 Release reservation nếu có
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
