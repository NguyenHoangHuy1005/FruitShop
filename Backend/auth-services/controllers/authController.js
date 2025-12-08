const User = require("../models/User");
const PendingGoogleSignup = require("../models/PendingGoogleSignup");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendVerificationMail, sendResetMail } = require("../utils/mailer");
const { verifyGoogleToken } = require("../utils/googleAuth");
const { generateOtp, hashOtp, sendOtpEmail } = require("../utils/googleOtpService");
const Cart = require("../../product-services/models/Carts");


let refreshTokens = [];

const isProd = process.env.NODE_ENV === "production";
// ==== TOKEN SECRETS & TTL ====
const ACCESS_SECRET  = process.env.JWT_ACCESS_KEY  || process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_KEY || process.env.JWT_SECRET;


// Thời hạn
const REFRESH_LONG_MS = 30 * 24 * 60 * 60 * 1000;   // 30 ngày

// Helper
const generate6Digit = () =>
  String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const hasShipperRole = (user) => {
    if (!user) return false;
    if (user.shipper) return true;
    if (user.roles && Array.isArray(user.roles)) {
        return user.roles.includes("shipper");
    }
    return false;
};

const COOKIE_OPTS = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
};

// Chuẩn hoá cookie theo TTL
const cookieOpts = (ttlMs) => ({
    ...COOKIE_OPTS,
    ...(ttlMs ? { maxAge: ttlMs, expires: new Date(Date.now() + ttlMs) } : {}),
});

// ==== JWT HELPERS (global, KHÔNG gán lên authController) ====
function genAccessToken(user) {
    return jwt.sign(
        { 
            id: user._id, 
            admin: !!(user.admin || user.isAdmin),
            shipper: hasShipperRole(user),
            username: user.username,
            email: user.email
        },
        ACCESS_SECRET,
        { expiresIn: "6h" } // Phiên truy cập 6 giờ, hạn chế phải refresh liên tục khi đang làm việc
    );
}

function genRefreshToken(user, ttlMs, remember = false) {
    return jwt.sign(
        { 
            id: user._id, 
            admin: !!(user.admin || user.isAdmin), 
            shipper: hasShipperRole(user),
            remember: !!remember,
            username: user.username,
            email: user.email
        },
        REFRESH_SECRET,
        { expiresIn: Math.floor(ttlMs / 1000) } // <- luôn truyền REFRESH_LONG_MS
    );
}


const authController = {
  // ============== REGISTER (tạo user + OTP) ==============
    registerUser: async (req, res) => {
        try {
        const { username, email, phone, password, password_confirm } = req.body;

        if (!username || !email || !phone || !password) {
            return res
            .status(400)
            .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
        }
        if (
            typeof password_confirm !== "undefined" &&
            password !== password_confirm
        ) {
            return res
            .status(400)
            .json({ message: "Xác nhận mật khẩu không khớp." });
        }

        const emailLower = String(email).trim().toLowerCase();
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(emailLower)) {
            return res.status(400).json({ message: "Email không hợp lệ." });
        }

        // Trùng email/username/phone?
        const duplicated = await User.findOne({
            $or: [{ email: emailLower }, { username }, { phone }],
        }).lean();
        if (duplicated) {
            const which =
            duplicated.email === emailLower
                ? "Email"
                : duplicated.username === username
                ? "Username"
                : "Số điện thoại";
            return res.status(409).json({ message: `${which} đã tồn tại.` });
        }

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);

        const token = generate6Digit();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        const user = await User.create({
            username,
            email: emailLower,
            phone,
            password: hashed,
            isVerified: false,
            verificationToken: token,
            verificationExpiresAt: expires,
        });

        const sent = await sendVerificationMail(user.email, user.username, token);

        return res.status(201).json({
            message: sent
            ? "Đăng ký thành công! Vui lòng kiểm tra email để lấy mã xác minh."
            : "Đăng ký thành công, nhưng chưa gửi được email. Vui lòng bấm 'Gửi lại mã'.",
            pendingEmail: user.email,
            emailSent: sent,
        });
        } catch (error) {
        console.error(error);
        if (error && error.code === 11000) {
            const key = Object.keys(error.keyPattern || { field: "Trường" })[0];
            return res.status(409).json({ message: `${key} đã tồn tại.` });
        }
        return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // ============== LOGIN (chặn nếu chưa verify) ==============
    loginUser: async (req, res) => {
        try {
        const identifier = req.body.username || req.body.email;
        const user = await User.findOne({
            $or: [
            { username: identifier },
            { email: identifier?.toLowerCase?.() },
            ],
        });

        if (!user) {
            return res
            .status(404)
            .json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác!" });
        }
        const validPassword = await bcrypt.compare(
            req.body.password,
            user.password
        );
        if (!validPassword) {
            return res
            .status(404)
            .json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác!" });
        }
        if (!user.isVerified) {
            return res.status(403).json({
            message:
                "Tài khoản chưa xác minh email. Vui lòng nhập mã hoặc bấm 'Gửi lại mã'.",
            pendingEmail: user.email,
            });
        }

        // ✅ Tăng loginCount mỗi lần đăng nhập thành công
        const remember = !!req.body.remember;
        return finalizeLoginSuccess({ req, res, user, remember });

        } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // generateAccessToken: (user) => {
    //     return jwt.sign(
    //     { id: user.id, admin: user.admin },
    //     process.env.JWT_ACCESS_KEY,
    //     { expiresIn: "30d" }
    //     );
    // },

    // generateRefreshToken: (user) => {
    //     return jwt.sign(
    //     { id: user.id, admin: user.admin },
    //     process.env.JWT_REFRESH_KEY,
    //     { expiresIn: "365d" }
    //     );
    // },

    // ============== REFRESH TOKEN ==============
    // requestRefreshToken: async (req, res) => {
    //     const refreshToken = req.cookies.refreshToken;
    //     if (!refreshToken)
    //     return res.status(401).json({ message: "You are not logged in" });
    //     if (!refreshTokens.includes(refreshToken))
    //     return res.status(403).json({ message: "Invalid refresh token" });

    //     jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, (err, user) => {
    //     if (err) {
    //         return res.status(403).json({ message: "Invalid refresh token" });
    //     }
    //     refreshTokens = refreshTokens.filter((t) => t !== refreshToken);

    //     const newAccessToken = authController.generateAccessToken(user);
    //     const newRefreshToken = authController.generateRefreshToken(user);
    //     refreshTokens.push(newRefreshToken);

    //     res.cookie("refreshToken", newRefreshToken, COOKIE_OPTS);
    //     return res.status(200).json({ accessToken: newAccessToken });
    //     });
    // },

    // ============== LOGOUT ==============
    userLogout: async (req, res) => {
        try {
            const refreshToken = req.cookies.refreshToken;

            // ❌ xoá cả refreshToken và CART_ID cookie
            res.clearCookie("refreshToken", COOKIE_OPTS);
            res.clearCookie("CART_ID", { path: "/" });

            if (refreshToken) {
            refreshTokens = refreshTokens.filter((t) => t !== refreshToken);
            }

            return res.status(200).json({ message: "Đăng xuất thành công, giỏ hàng đã được lưu cho tài khoản." });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },


    // ============== VERIFY ACCOUNT ==============
    verifyAccount: async (req, res) => {
        try {
            const email = String(req.body.email || "").trim().toLowerCase();
            const token = String(req.body.token || "").trim();

            if (!email || !token) {
            return res.status(400).json({ message: "Thiếu email hoặc mã xác minh." });
        }

            // Đọc trước để trả đúng loại lỗi
            const snap = await User.findOne({
                email,
                isVerified: false,
                verificationToken: token,
            }).select("verificationExpiresAt").lean();

            if (!snap) {
                // Không có bản ghi phù hợp: sai mã / đã verify / mã đã thay đổi do 'gửi lại'
                return res.status(400).json({ message: "Mã không đúng hoặc đã được sử dụng." });
            }

            // Hết hạn chỉ khi có Date và < now
            if (snap.verificationExpiresAt && snap.verificationExpiresAt < new Date()) {
                return res.status(400).json({
                    message: 'Mã đã hết hạn. Vui lòng bấm "Gửi lại mã".',
                    expired: true
                });
            }

            // Cập nhật xác minh (atomic điều kiện còn hạn)
            const r = await User.updateOne(
            {
                email,
                isVerified: false,
                verificationToken: token,
                // nếu có expires thì bắt buộc còn hạn; nếu null thì vẫn cho pass
                $or: [
                { verificationExpiresAt: null },
                { verificationExpiresAt: { $gte: new Date() } }
                ]
            },
            { $set: { isVerified: true }, $unset: { verificationToken: 1, verificationExpiresAt: 1 } }
            );

            if (r.modifiedCount === 1) {
                return res.status(200).json({
                    message: "Xác minh thành công! Bạn có thể đăng nhập.",
                    verified: true
                });
            }

            // Nếu tới đây mà không modified thì coi như mã không còn hợp lệ
            return res.status(400).json({ message: "Mã không đúng hoặc đã được sử dụng." });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // ============== RESEND CODE ==============
    resendVerifyCode: async (req, res) => {
        try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email) return res.status(400).json({ message: "Thiếu email để gửi lại mã." });

        const user = await User.findOne({ email })
            .select("username isVerified")
            .lean();
        if (!user || user.isVerified) {
            return res.status(400).json({ message: "Email không tồn tại hoặc đã xác minh." });
        }

        const token = generate6Digit();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        const upd = await User.updateOne(
            { email, isVerified: false },
            { $set: { verificationToken: token, verificationExpiresAt: expires } }
        );

        if (upd.modifiedCount !== 1) {
            return res.status(500).json({ message: "Không thể cập nhật mã xác minh." });
        }

        const sent = await sendVerificationMail(email, user.username || email, token);
        return res.status(200).json({
            message: sent
            ? `Đã gửi lại mã xác minh tới ${email} (hết hạn sau 10 phút).`
            : "Chưa gửi được email xác minh. Vui lòng thử lại.",
            pendingEmail: email,
            emailSent: sent,
        });
        } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },


        // ============== FORGOT PASSWORD ==============
    forgotPassword: async (req, res) => {
        try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email) return res.status(400).json({ message: "Thiếu email." });

        const genericMsg =
            "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi mã xác nhận để đặt lại mật khẩu (hết hạn sau 10 phút).";

        const user = await User.findOne({ email })
            .select("username isVerified")
            .lean();
        if (!user) {
            console.log("[forgot] email not found:", email);
            return res.status(200).json({ message: genericMsg });
        }

        const token = generate6Digit();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        await User.updateOne(
            { email },
            { $set: { resetPasswordToken: token, resetPasswordExpiresAt: expires } }
        );

        try {
            await sendResetMail(email, user.username || email, token);
        } catch (e) {
            console.error("[forgot] send mail error:", e?.message || e);
        }
        return res.status(200).json({ message: genericMsg, pendingEmail: email });
        } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // ============== RESET PASSWORD ==============
    resetPassword: async (req, res) => {
        try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const token = String(req.body.token || "").trim();
        const newPassword = String(req.body.newPassword || "");
        const confirm = String(req.body.password_confirm || "");

        if (!email || !token || !newPassword) {
            return res
            .status(200)
            .json({ ok: false, code: "MISSING", message: "Thiếu email, mã hoặc mật khẩu mới." });
        }
        if (newPassword !== confirm) {
            return res
            .status(200)
            .json({ ok: false, code: "MISMATCH", message: "Xác nhận mật khẩu không khớp." });
        }
        if (newPassword.length < 6) {
            return res
            .status(200)
            .json({ ok: false, code: "WEAK_PASSWORD", message: "Mật khẩu phải có ít nhất 6 ký tự." });
        }

        const user = await User.findOne({
            email,
            resetPasswordToken: token,
            resetPasswordExpiresAt: { $ne: null, $gte: new Date() },
        });

        if (!user) {
            const expired = await User.findOne({
            email,
            resetPasswordToken: token,
            $or: [
                { resetPasswordExpiresAt: null },
                { resetPasswordExpiresAt: { $lt: new Date() } },
            ],
            }).lean();

            if (expired) {
            return res.status(200).json({
                ok: false,
                code: "EXPIRED",
                expired: true,
                message: "Mã đã hết hạn. Vui lòng bấm 'Gửi lại mã'.",
            });
            }
            return res
            .status(200)
            .json({ ok: false, code: "INVALID_TOKEN", message: "Mã không đúng." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);

        await User.updateOne(
            { _id: user._id },
            {
            $set: { password: hashed },
            $unset: { resetPasswordToken: 1, resetPasswordExpiresAt: 1 },
            }
        );

        return res
            .status(200)
            .json({ ok: true, message: "Đặt lại mật khẩu thành công! Hãy đăng nhập." });
        } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Lỗi máy chủ." });
        }
    },
        // ============== CHANGE PASSWORD (AUTH) ==============
    changePassword: async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ message: "Not authenticated" });

            const currentPassword = String(req.body?.currentPassword || "");
            const newPassword = String(req.body?.newPassword || "");
            const confirm = String(req.body?.password_confirm || "");

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ message: "Thieu mat khau hien tai hoac mat khau moi." });
            }
            if (newPassword !== confirm) {
                return res.status(400).json({ message: "Mat khau moi khong khop." });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ message: "Mat khau moi phai tu 6 ky tu." });
            }

            const user = await User.findById(userId).select("password resetPasswordToken resetPasswordExpiresAt");
            if (!user) return res.status(404).json({ message: "Khong tim thay tai khoan." });
            if (!user.password) return res.status(400).json({ message: "Tai khoan khong ho tro doi mat khau." });

            const isMatch = await bcrypt.compare(currentPassword, user.password || "");
            if (!isMatch) return res.status(400).json({ message: "Mat khau hien tai khong dung." });

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
            user.resetPasswordToken = null;
            user.resetPasswordExpiresAt = null;
            await user.save();

            return res.status(200).json({ ok: true, message: "Doi mat khau thanh cong." });
        } catch (error) {
            console.error("changePassword error:", error);
            return res.status(500).json({ message: "Loi may chu khi doi mat khau." });
        }
    },

// ============== REQUEST CHANGE EMAIL (OTP to current email) ==============
    requestChangeEmail: async (req, res) => {
        try {
            const userId = req.user?.id;
            const newEmail = String(req.body?.newEmail || "").trim().toLowerCase();
            if (!userId) return res.status(401).json({ message: "Not authenticated" });
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!newEmail || !emailRegex.test(newEmail)) return res.status(400).json({ message: "Email mới không hợp lệ." });

            const me = await User.findById(userId).select("email username");
            if (!me) return res.status(404).json({ message: "Không tìm thấy người dùng." });
            if (newEmail === me.email) return res.status(400).json({ message: "Email mới trùng email hiện tại." });

            const dup = await User.findOne({ email: newEmail }).select("_id").lean();
            if (dup) return res.status(409).json({ message: "Email mới đã được sử dụng." });

            const token = generate6Digit();
            const expires = new Date(Date.now() + 10 * 60 * 1000);

            await User.updateOne(
            { _id: userId },
            { $set: { newEmailPending: newEmail, emailChangeToken: token, emailChangeExpiresAt: expires } }
            );

            let sent = false;
            try { sent = await sendVerificationMail(me.email, me.username || me.email, token); } catch(_) {}

            return res.status(200).json({
            message: sent
                ? `Đã gửi mã xác minh tới ${me.email}. Mã sẽ hết hạn sau 10 phút.`
                : "Chưa gửi được email xác minh. Vui lòng thử lại.",
            emailSent: sent,
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // ============== CONFIRM CHANGE EMAIL ==============
    confirmChangeEmail: async (req, res) => {
        try {
            const userId = req.user?.id;
            const token = String(req.body?.token || "").trim();
            if (!userId) return res.status(401).json({ message: "Not authenticated" });
            if (!/^\d{6}$/.test(token)) return res.status(400).json({ message: "Mã OTP không hợp lệ." });

            const snap = await User.findOne({
            _id: userId,
            emailChangeToken: token,
            newEmailPending: { $ne: null },
            $or: [{ emailChangeExpiresAt: null }, { emailChangeExpiresAt: { $gte: new Date() } }],
            }).select("email newEmailPending");

            if (!snap) return res.status(400).json({ message: "Mã không đúng hoặc đã hết hạn." });

            const dup = await User.findOne({ email: snap.newEmailPending }).select("_id").lean();
            if (dup) return res.status(409).json({ message: "Email mới đã được sử dụng." });

            await User.updateOne(
            { _id: userId },
            { $set: { email: snap.newEmailPending }, $unset: { newEmailPending: 1, emailChangeToken: 1, emailChangeExpiresAt: 1 } }
            );

            const updated = await User.findById(userId).select("-password").lean();
            return res.status(200).json({ message: "Đổi email thành công!", user: updated });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // ============== REQUEST CHANGE USERNAME (OTP) ==============
    requestChangeUsername: async (req, res) => {
        try {
            const userId = req.user?.id;
            const newUsername = String(req.body?.newUsername || "").trim();
            if (!userId) return res.status(401).json({ message: "Chưa xác thực" });
            const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;
            if (!newUsername || !usernameRegex.test(newUsername)) {
                return res
                    .status(400)
                    .json({ message: "tên tài khoản phải có 3-30 ký tự (chữ cái, chữ số hoặc ._-)." });
            }

            const me = await User.findById(userId).select("username email");
            if (!me) return res.status(404).json({ message: "Người dùng không tìm thấy." });
            if (newUsername.toLowerCase() === String(me.username || "").toLowerCase()) {
                return res.status(400).json({ message: "Tên tài khoản mới trùng với tên tài khoản hiện tại." });
            }

            const dup = await User.findOne({ username: newUsername }).select("_id").lean();
            if (dup) return res.status(409).json({ message: "Tên tài khoản đã được sử dụng." });
            const token = generate6Digit();
            const expires = new Date(Date.now() + 10 * 60 * 1000);

            await User.updateOne(
                { _id: userId },
                {
                    $set: {
                        newUsernamePending: newUsername,
                        usernameChangeToken: token,
                        usernameChangeExpiresAt: expires,
                    },
                }
            );

            let sent = false;
            try {
                sent = await sendVerificationMail(me.email, me.username || me.email, token);
            } catch (_) {}

            return res.status(200).json({
                message: sent
                    ? `Mã OTP để xác nhận đổi tên tài khoản đã được gửi tới ${me.email}. Mã có hiệu lực trong 10 phút.`
                    : "Không thể gửi email OTP. Vui lòng thử lại.",
                emailSent: sent,
            });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // ============== CONFIRM CHANGE USERNAME ==============
    confirmChangeUsername: async (req, res) => {
        try {
            const userId = req.user?.id;
            const token = String(req.body?.token || "").trim();
            if (!userId) return res.status(401).json({ message: "Chưa xác thực" });
            if (!/^\d{6}$/.test(token)) return res.status(400).json({ message: "Mã OTP phải gồm 6 chữ số" });

            const snap = await User.findOne({
                _id: userId,
                usernameChangeToken: token,
                newUsernamePending: { $ne: null },
                $or: [
                    { usernameChangeExpiresAt: null },
                    { usernameChangeExpiresAt: { $gte: new Date() } },
                ],
            }).select("newUsernamePending");

            if (!snap) return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn." });

            const dup = await User.findOne({ username: snap.newUsernamePending }).select("_id").lean();
            if (dup) return res.status(409).json({ message: "Tên tài khoản đã được sử dụng." });

            await User.updateOne(
                { _id: userId },
                {
                    $set: { username: snap.newUsernamePending },
                    $unset: {
                        newUsernamePending: 1,
                        usernameChangeToken: 1,
                        usernameChangeExpiresAt: 1,
                    },
                }
            );

            const updated = await User.findById(userId).select("-password").lean();
            return res.status(200).json({ message: "Đổi tên tài khoản thành công!", user: updated });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },
};

authController.refresh = async (req, res) => {
    try {
        const oldToken = req.cookies?.refreshToken;
        if (!oldToken) return res.status(401).json({ message: "Thiếu refresh token." });

        let payload;
        try {
        payload = jwt.verify(oldToken, REFRESH_SECRET);
        } catch (_) {
        return res.status(401).json({ message: "Refresh token không hợp lệ/đã hết hạn." });
        }

        const { id, remember } = payload || {};
        const user = await User.findById(id).select("_id admin isAdmin").lean();
        if (!user) return res.status(401).json({ message: "Người dùng không tồn tại." });

        const isAdmin = !!(user.admin || user.isAdmin);

        // 1) Cấp access token mới
        const accessToken = genAccessToken(user);

        // 2) Xoay vòng refresh token (luôn TTL dài 30d; remember đi trong payload)
        const newRefresh = genRefreshToken(user, REFRESH_LONG_MS, !!remember);

        // 3) Cookie: Admin & User-không-tick = session cookie; User-tick = persistent 30d
        const cookieConf = (isAdmin || !remember) ? COOKIE_OPTS : cookieOpts(REFRESH_LONG_MS);
        res.cookie("refreshToken", newRefresh, cookieConf);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ accessToken, admin: isAdmin });
    } catch (_) {
        return res.status(401).json({ message: "Refresh token không hợp lệ/đã hết hạn." });
    }
};

authController.googleLogin = async (req, res) => {
    try {
        const credential = String(req.body.credential || "").trim();
        const remember = !!req.body.remember;
        const profile = await verifyGoogleToken(credential);
        const email = profile?.email;

        if (!email) {
            return res.status(404).json({
                success: false,
                message: "email không đúng hoặc chưa đăng ký",
            });
        }

        let user = await User.findOne({ email });
        if (!user) {
            // Tạo username duy nhất từ email hoặc googleSub
            const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
            let username = baseUsername;
            let counter = 1;
            
            // Kiểm tra username đã tồn tại chưa, nếu có thì thêm số
            while (await User.findOne({ username })) {
                username = `${baseUsername}${counter}`;
                counter++;
            }

            // Tạo phone giả để tránh duplicate null
            const fakePhone = `0xxxxxxxxx`;

            user = await User.create({
                email,
                username, // Thêm username tự động
                phone: fakePhone, // Thêm phone tự động để tránh null
                fullname: profile?.name || "",
                avatar: profile?.picture || "",
                provider: "google",
                isVerified: true,
                verificationToken: null,
                verificationExpiresAt: null,
            });
        } else {
            if (!user.isVerified) {
                user.isVerified = true;
                user.verificationToken = null;
                user.verificationExpiresAt = null;
            }
            if (profile?.picture && profile.picture !== user.avatar) {
                user.avatar = profile.picture;
            }
            if (profile?.name && !user.fullname) {
                user.fullname = profile.name;
            }
        }

        return finalizeLoginSuccess({ req, res, user, remember });
    } catch (error) {
        console.error("googleLogin error:", error?.message || error);
        const status = error?.status || 500;
        const message = error?.message || "Đăng nhập Google thất bại";
        return res.status(status).json({ success: false, message });
    }
};

authController.googleRegister = async (req, res) => {
    try {
        const credential = String(req.body.credential || "").trim();
        const profile = await verifyGoogleToken(credential);
        const email = profile?.email;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "email không đúng hoặc chưa đăng ký",
            });
        }

        const exists = await User.findOne({ email }).lean();
        if (exists) {
            return res.status(409).json({
                success: false,
                message: "email đã tồn tại",
            });
        }

        const otp = generateOtp();
        const verifyToken = crypto.randomBytes(24).toString("hex");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await PendingGoogleSignup.findOneAndUpdate(
            { email },
            {
                email,
                otpHash: hashOtp(otp),
                verifyToken,
                googleSub: profile?.sub || null,
                expiresAt,
            },
            { upsert: true, setDefaultsOnInsert: true }
        );

        const sent = await sendOtpEmail(email, otp);
        if (!sent) {
            return res.status(500).json({
                success: false,
                message: "không gửi được otp",
            });
        }

        return res.status(200).json({
            success: true,
            verifyToken,
            message: "otp đã được gửi",
        });
    } catch (error) {
        console.error("googleRegister error:", error?.message || error);
        const status = error?.status || 500;
        const message = error?.message || "đăng ký Google thất bại";
        return res.status(status).json({ success: false, message });
    }
};

authController.googleVerifyOtp = async (req, res) => {
    try {
        const verifyToken = String(req.body.verifyToken || "").trim();
        const otp = String(req.body.otp || "").trim();

        if (!verifyToken || !otp) {
            return res.status(400).json({
                success: false,
                message: "thiếu token hoặc otp",
            });
        }

        const pending = await PendingGoogleSignup.findOne({ verifyToken });
        if (!pending) {
            return res.status(400).json({
                success: false,
                message: "otp không hợp lệ",
            });
        }

        if (pending.expiresAt && pending.expiresAt < new Date()) {
            await PendingGoogleSignup.deleteOne({ _id: pending._id });
            return res.status(400).json({
                success: false,
                message: "otp đã hết hạn",
            });
        }

        const hashed = hashOtp(otp);
        if (hashed !== pending.otpHash) {
            return res.status(400).json({
                success: false,
                message: "otp không hợp lệ",
            });
        }

        const exists = await User.findOne({ email: pending.email }).lean();
        if (exists) {
            await PendingGoogleSignup.deleteOne({ _id: pending._id });
            return res.status(409).json({
                success: false,
                message: "email đã tồn tại",
            });
        }

        // Tạo username duy nhất từ email
        const baseUsername = pending.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        let username = baseUsername;
        let counter = 1;
        
        // Kiểm tra username đã tồn tại chưa, nếu có thì thêm số
        while (await User.findOne({ username })) {
            username = `${baseUsername}${counter}`;
            counter++;
        }

        // Tạo phone giả từ timestamp để tránh duplicate null
        const fakePhone = `0${Date.now().toString().slice(-9)}`;

        await User.create({
            email: pending.email,
            username, // Thêm username tự động
            phone: fakePhone, // Thêm phone tự động để tránh null
            provider: "google",
            isVerified: true,
        });

        await PendingGoogleSignup.deleteOne({ _id: pending._id });

        return res.status(201).json({
            success: true,
            message: "đăng ký Google thành công",
        });
    } catch (error) {
        console.error("googleVerifyOtp error:", error?.message || error);
        return res.status(500).json({
            success: false,
            message: "xác minh OTP thất bại",
        });
    }
};

async function finalizeLoginSuccess({ req, res, user, remember }) {
    const rememberFlag = !!remember;
    const isAdmin = !!(user.admin || user.isAdmin);
    const tokenTtl = REFRESH_LONG_MS;
    let cookieConf;

    if (isAdmin) {
        cookieConf = COOKIE_OPTS;
    } else if (rememberFlag) {
        cookieConf = cookieOpts(REFRESH_LONG_MS);
    } else {
        cookieConf = COOKIE_OPTS;
    }

    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const accessToken  = genAccessToken(user);
    const refreshToken = genRefreshToken(user, tokenTtl, rememberFlag);
    refreshTokens.push(refreshToken);

    res.cookie("refreshToken", refreshToken, cookieConf);

    const guestKey = req.cookies?.CART_ID;
    let userCart = await Cart.findOne({ user: user._id, status: "active" });

    if (guestKey) {
        const guestCart = await Cart.findOne({ cartKey: guestKey, status: "active" });
        if (guestCart && guestCart.items.length) {
            if (!userCart) {
                guestCart.user = user._id;
                guestCart.cartKey = null;
                await guestCart.save();
                userCart = guestCart;
            } else {
                for (const gItem of guestCart.items) {
                    const idx = userCart.items.findIndex((i) => i.product.equals(gItem.product));
                    if (idx >= 0) {
                        userCart.items[idx].quantity += gItem.quantity;
                        userCart.items[idx].total =
                        userCart.items[idx].quantity * userCart.items[idx].price;
                    } else {
                        userCart.items.push(gItem);
                    }
                }
                userCart.summary.totalItems = userCart.items.reduce((s, i) => s + i.quantity, 0);
                userCart.summary.subtotal   = userCart.items.reduce((s, i) => s + i.total, 0);
                await userCart.save();
                await Cart.deleteOne({ _id: guestCart._id });
            }
        }
        res.clearCookie("CART_ID", { path: "/" });
    }

    const { password, ...others } = user._doc;

    userCart = await Cart.findOne({ user: user._id, status: "active" }).populate("items.product");

    if (!userCart) {
        userCart = await Cart.create({
        user: user._id,
        items: [],
        summary: { totalItems: 0, subtotal: 0 },
        });
        userCart = await userCart.populate("items.product");
    }

    return res.status(200).json({ ...others, accessToken, admin: isAdmin });
}

module.exports = authController;

