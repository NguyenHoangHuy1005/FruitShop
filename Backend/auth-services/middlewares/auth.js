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
        req.userId = uid; req.isAdmin = true; return next();
        }

        // Fallback kiểm DB nếu token không chứa flag admin
        if (!uid) return res.status(403).json({ message: "Yêu cầu quyền admin." });
        const user = await User.findById(uid).select("admin isAdmin").lean();
        if (user?.admin || user?.isAdmin) {
        req.userId = uid; req.isAdmin = true; return next();
        }
        return res.status(403).json({ message: "Yêu cầu quyền admin." });
    } catch (e) {
        return res.status(401).json({ message: "Token không hợp lệ." });
    }
};

module.exports = { requireAdmin, readBearer };
