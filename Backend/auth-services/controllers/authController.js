const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendVerificationMail, sendResetMail } = require("../utils/mailer");
const Cart = require("../../product-services/models/Carts");


let refreshTokens = [];

// Helper
const generate6Digit = () =>
  String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: "lax",
    path: "/",
};

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

        const accessToken = authController.generateAccessToken(user);
        const refreshToken = authController.generateRefreshToken(user);
        refreshTokens.push(refreshToken);

        res.cookie("refreshToken", refreshToken, COOKIE_OPTS);

        // ✅ merge giỏ guest (nếu có CART_ID) vào giỏ user
        const guestKey = req.cookies.CART_ID;
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
                        const idx = userCart.items.findIndex(i => i.product.equals(gItem.product));
                        if (idx >= 0) {
                            userCart.items[idx].quantity += gItem.quantity;
                            userCart.items[idx].total = userCart.items[idx].quantity * userCart.items[idx].price;
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
            res.clearCookie("CART_ID", { path: "/" }); // ❌ clear cookie guest sau khi merge
        }


        const { password, ...others } = user._doc;
        
        // Lấy giỏ hiện tại của user (sau khi merge)
        userCart = await Cart.findOne({ user: user._id, status: "active" })
        .populate("items.product");

        if (!userCart) {
            userCart = { items: [], summary: { totalItems: 0, subtotal: 0 } }; // ⚡ fallback rỗng
        }

        return res.status(200).json({ ...others, accessToken, cart: userCart });


        } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // ============== JWT helpers ==============
    generateAccessToken: (user) => {
        return jwt.sign(
        { id: user.id, admin: user.admin },
        process.env.JWT_ACCESS_KEY,
        { expiresIn: "30d" }
        );
    },

    generateRefreshToken: (user) => {
        return jwt.sign(
        { id: user.id, admin: user.admin },
        process.env.JWT_REFRESH_KEY,
        { expiresIn: "365d" }
        );
    },

    // ============== REFRESH TOKEN ==============
    requestRefreshToken: async (req, res) => {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken)
        return res.status(401).json({ message: "You are not logged in" });
        if (!refreshTokens.includes(refreshToken))
        return res.status(403).json({ message: "Invalid refresh token" });

        jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid refresh token" });
        }
        refreshTokens = refreshTokens.filter((t) => t !== refreshToken);

        const newAccessToken = authController.generateAccessToken(user);
        const newRefreshToken = authController.generateRefreshToken(user);
        refreshTokens.push(newRefreshToken);

        res.cookie("refreshToken", newRefreshToken, COOKIE_OPTS);
        return res.status(200).json({ accessToken: newAccessToken });
        });
    },

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
};

module.exports = authController;
