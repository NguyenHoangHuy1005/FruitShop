const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendVerificationMail, sendResetMail } = require("../utils/mailer");

let refreshTokens = [];

// helper
const generate6Digit = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const authController = {
     // ============== REGISTER (tạo user + OTP) ==============
    registerUser: async (req, res) => {
        try {
        const { username, email, phone, password, password_confirm } = req.body;

        if (!username || !email || !phone || !password) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
        }
        if (typeof password_confirm !== "undefined" && password !== password_confirm) {
            return res.status(400).json({ message: "Xác nhận mật khẩu không khớp." });
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
            duplicated.email === emailLower ? "Email"
            : duplicated.username === username ? "Username"
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
        // Duplicate key (Mongo)
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
            $or: [{ username: identifier }, { email: identifier?.toLowerCase?.() }],
        });

        if (!user) {
            return res.status(404).json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác!" });
        }
        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword) {
            return res.status(404).json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác!" });
        }
        if (!user.isVerified) {
            return res.status(403).json({
            message: "Tài khoản chưa xác minh email. Vui lòng nhập mã hoặc bấm 'Gửi lại mã'.",
            pendingEmail: user.email,
            });
        }

        const accessToken = authController.generateAccessToken(user);
        const refreshToken = authController.generateRefreshToken(user);
        refreshTokens.push(refreshToken);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "strict",
        });

        const { password, ...others } = user._doc;
        return res.status(200).json({ ...others, accessToken });
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

    // ============== REFRESH TOKEN (SỬA set cookie token mới) ==============
    requestRefreshToken: async (req, res) => {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) return res.status(401).json({ message: "You are not logged in" });
        if (!refreshTokens.includes(refreshToken)) return res.status(403).json({ message: "Invalid refresh token" });

        jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid refresh token" });
        }
        refreshTokens = refreshTokens.filter((token) => token !== refreshToken);

        const newAccessToken = authController.generateAccessToken(user);
        const newRefreshToken = authController.generateRefreshToken(user);
        refreshTokens.push(newRefreshToken);

        // SỬA: phải set cookie = newRefreshToken
        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "strict",
        });
        return res.status(200).json({ accessToken: newAccessToken });
        });
    },

    // ============== LOGOUT ==============
    // câp nhật: xóa cookie trên trình duyệt
    userLogout: async (req, res) => {
        try {
            const refreshToken = req.cookies.refreshToken;

            const cookieOptions = {
            httpOnly: true,
            path: "/", // phải trùng path khi set
            sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
            secure: process.env.NODE_ENV === "production", // production mới bật Secure
            };

            res.clearCookie("refreshToken", cookieOptions);

            // Nếu có quản lý refreshTokens trên RAM/DB:
            if (refreshToken) {
            refreshTokens = refreshTokens.filter((t) => t !== refreshToken);
            }

            return res.status(200).json({ message: "Logged out" });
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

        const r = await User.updateOne(
            {
            email,
            isVerified: false,
            verificationToken: token,
            verificationExpiresAt: { $ne: null, $gte: new Date() },
            },
            {
            $set: { isVerified: true },
            $unset: { verificationToken: 1, verificationExpiresAt: 1 },
            }
        );

        if (r.modifiedCount === 1) {
            return res.status(200).json({ message: "Xác minh thành công! Bạn có thể đăng nhập.", verified: true });
        }

        const expired = await User.findOne({
            email,
            isVerified: false,
            verificationToken: token,
            $or: [{ verificationExpiresAt: null }, { verificationExpiresAt: { $lt: new Date() } }],
        }).lean();

        if (expired) {
            return res.status(400).json({ message: 'Mã đã hết hạn. Vui lòng bấm "Gửi lại mã".', expired: true });
        }

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

        const user = await User.findOne({ email }).select("username isVerified").lean();
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

    // ============== RESET PASSWORD ==============
    forgotPassword: async (req, res) => {
        try {
            const email = String(req.body.email || "").trim().toLowerCase();
            if (!email) return res.status(400).json({ message: "Thiếu email." });

            // Tạo phản hồi "mù" để tránh suy đoán tài khoản
            const genericMsg =
                "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi mã xác nhận để đặt lại mật khẩu (hết hạn sau 10 phút).";

            const user = await User.findOne({ email }).select("username isVerified").lean();
            if (!user) {
                console.log("[forgot] email not found:", email);
                // Không tiết lộ sự tồn tại của email
                return res.status(200).json({ message: genericMsg });
            }

            const token = generate6Digit();
            const expires = new Date(Date.now() + 10 * 60 * 1000);

            await User.updateOne(
                { email },
                { $set: { resetPasswordToken: token, resetPasswordExpiresAt: expires } }
            );

            // Gửi email
            await sendResetMail(email, user.username || email, token);
            try {
                await sendResetMail(email, user.username || email, token);
            } catch (e) {
                console.error("[forgot] send mail error:", e?.message || e);
                // vẫn trả 200 để không lộ tồn tại email
            }
            return res.status(200).json({
                message: genericMsg,
                // Bạn có thể trả về hint UI nếu muốn
                pendingEmail: email
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Lỗi máy chủ." });
        }
    },

    // ============== RESET PASSWORD (xác thực mã + đổi mật khẩu) ==============
    resetPassword: async (req, res) => {
        try {
            const email = String(req.body.email || "").trim().toLowerCase();
            const token = String(req.body.token || "").trim();
            const newPassword = String(req.body.newPassword || "");
            const confirm = String(req.body.password_confirm || "");

            if (!email || !token || !newPassword) {
            return res.status(200).json({ ok: false, code: "MISSING", message: "Thiếu email, mã hoặc mật khẩu mới." });
            }
            if (newPassword !== confirm) {
            return res.status(200).json({ ok: false, code: "MISMATCH", message: "Xác nhận mật khẩu không khớp." });
            }
            if (newPassword.length < 6) {
            return res.status(200).json({ ok: false, code: "WEAK_PASSWORD", message: "Mật khẩu phải có ít nhất 6 ký tự." });
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
                $or: [{ resetPasswordExpiresAt: null }, { resetPasswordExpiresAt: { $lt: new Date() } }],
            }).lean();

            if (expired) {
                return res.status(200).json({
                ok: false,
                code: "EXPIRED",
                expired: true,
                message: "Mã đã hết hạn. Vui lòng bấm 'Gửi lại mã'.",
                });
            }
            return res.status(200).json({
                ok: false,
                code: "INVALID_TOKEN",
                message: "Mã không đúng.",
            });
            }

            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(newPassword, salt);

            await User.updateOne(
            { _id: user._id },
            { $set: { password: hashed }, $unset: { resetPasswordToken: 1, resetPasswordExpiresAt: 1 } }
            );

            return res.status(200).json({ ok: true, message: "Đặt lại mật khẩu thành công! Hãy đăng nhập." });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ ok: false, message: "Lỗi máy chủ." });
        }
    },



};

module.exports = authController;
