// middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_ACCESS_KEY || process.env.JWT_SECRET;

const readBearer = (req) => {
    const raw = req.headers?.authorization || req.headers?.Authorization || req.headers?.token || "";
    if (typeof raw !== "string") return "";
    const t = raw.trim();
    return t.toLowerCase().startsWith("bearer ") ? t.slice(7).trim() : t;
};

const requireAdmin = async (req, res, next) => {
    try {
        const token = readBearer(req);
        if (!token) return res.status(401).json({ message: "Thiếu token." });
        if (!JWT_SECRET) return res.status(500).json({ message: "Thiếu JWT_ACCESS_KEY." });

        const payload = jwt.verify(token, JWT_SECRET);
        const uid = payload?.id || payload?._id;
        const isAdminFromToken = !!(payload?.admin || payload?.isAdmin);

        if (isAdminFromToken) {
            req.userId = uid;
            req.user = { id: uid, admin: true };
            req.isAdmin = true;
            return next();
        }

        // Fallback kiểm DB nếu token không chứa flag admin
        if (!uid) return res.status(403).json({ message: "Yêu cầu quyền admin." });
        const user = await User.findById(uid).select("admin isAdmin").lean();
        if (user?.admin || user?.isAdmin) {
            req.userId = uid;
            req.user = { id: uid, admin: true };
            req.isAdmin = true;
            return next();
        }
        return res.status(403).json({ message: "Yêu cầu quyền admin." });
    } catch (e) {
        return res.status(401).json({ message: "Token không hợp lệ." });
    }
};

const verifyToken = (req, res, next) => {
    try {
        const token = readBearer(req);
        if (!token) {
            console.log('[AUTH] Missing token for:', req.method, req.originalUrl);
            return res.status(401).json({ message: "Thiếu token." });
        }
        if (!JWT_SECRET) {
            console.log('[AUTH] Missing JWT_SECRET');
            return res.status(500).json({ message: "Thiếu JWT_ACCESS_KEY." });
        }

        const payload = jwt.verify(token, JWT_SECRET);
        req.user = { 
            id: payload?.id || payload?._id,
            username: payload?.username,
            email: payload?.email,
            admin: payload?.admin || payload?.isAdmin || false
        }; // gán userId và thông tin user vào req
        next();
    } catch (e) {
        console.log('[AUTH] Invalid token:', e.message);
        return res.status(401).json({ message: "Token không hợp lệ.", error: e.message });
    }
};

const optionalAuth = (req, res, next) => {
    try {
        const token = readBearer(req);
        if (!token) {
            // Không có token, nhưng vẫn cho phép tiếp tục
            req.user = null;
            return next();
        }
        if (!JWT_SECRET) {
            console.log('[AUTH] Missing JWT_SECRET');
            req.user = null;
            return next();
        }

        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload?.id || payload?._id,
            username: payload?.username,
            email: payload?.email,
            admin: payload?.admin || payload?.isAdmin || false
        };
        next();
    } catch (e) {
        // Token không hợp lệ, nhưng vẫn cho phép tiếp tục
        console.log('[AUTH] Invalid token (optional):', e.message);
        req.user = null;
        next();
    }
};

module.exports = { requireAdmin, readBearer, verifyToken, optionalAuth };
