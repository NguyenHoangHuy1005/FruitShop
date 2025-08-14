const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");


let refreshTokens = [];

const authController = {
    //register
    registerUser: async (req, res) => {
        try {
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(req.body.password, salt);

            const newUser = await new User({
                username: req.body.username,
                email: req.body.email,
                phone: req.body.phone,
                password: hashed
            });
            //save to db
            const user = await newUser.save();
            res.status(200).json();
        } catch (error) {
            console.error(error); // Hiện chi tiết lỗi trên terminal
            res.status(500).json();
        }
    },
    //generate
    generateAccessToken: (user) => {
        return jwt.sign(
            {
                id: user.id,
                admin: user.admin
            },
            process.env.JWT_ACCESS_KEY,
            { expiresIn: "30d" }
        );
    },

    generateRefreshToken: (user) => {
        return jwt.sign({
            id: user.id,
            admin: user.admin
        },
            process.env.JWT_REFRESH_KEY,
            { expiresIn: "365d" },
        );
    },

    //login
    loginUser: async (req, res) => {
        try {
            const user = await User.findOne({ username: req.body.username });
            if (!user) {
                return res.status(404).json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác!" });
            }
            const validPassword = await bcrypt.compare(req.body.password, user.password);
            if (!validPassword) {
                return res.status(404).json("Tên đăng nhập hoặc mật khẩu không chính xác!");
            }
            if (user && validPassword) {
                const accessToken = authController.generateAccessToken(user);
                const refreshToken = authController.generateRefreshToken(user);
                refreshTokens.push(refreshToken);
                res.cookie("refreshToken", refreshToken, {
                    httpOnly: true,
                    secure: false,
                    path: "/",
                    sameSite: "strict",
                })
                const { password, ...orthers } = user._doc;
                res.status(200).json({ ...orthers, accessToken });
            }
        } catch (error) {
            console.error(error); // chi tiết lỗi
            res.status(500).json(err);
        }
    },

    //
    requestRefreshToken: async (req, res) => {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) return res.status(401).json({ message: "You are not logged in" });
        if (!refreshTokens.includes(refreshToken)) return res.status(403).json({ message: "Invalid refresh token" });
        jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, (err, user) => {
            if (err) {
                return res.status(403).json({ message: "Invalid refresh token" });
            }
            refreshTokens = refreshTokens.filter((token) => token !== refreshToken)
            // tao accesstoken, refresh token moi
            const newAccessToken = authController.generateAccessToken(user);
            const newRefreshToken = authController.generateRefreshToken(user);
            refreshTokens.push(newRefreshToken);
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: false,
                path: "/",
                sameSite: "strict",
            });
            res.status(200).json({ accessToken: newAccessToken });
        })
    },
    //logout
    userLogout: async (req, res) => {
        try {
            const refreshToken = req.cookies.refreshToken; // lấy trước khi xóa
            res.clearCookie("refreshToken");

            // Cập nhật biến global/local lưu token
            refreshTokens = refreshTokens.filter((token) => token !== refreshToken);

            res.status(200).json();
        } catch (error) {
            console.error(error);
            res.status(500).json();
        }
    }

}

module.exports = authController