// BE/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./auth-services/config/db");
const cookieParser = require("cookie-parser");
const path = require("path");

dotenv.config();
connectDB();

const app = express();

// Nếu sau này chạy sau reverse proxy (Nginx...), bật dòng này:
app.set("trust proxy", 1);

// ===== CORS (đồng nhất cho cả preflight & request thật) =====
const allowlist = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/\[::1\]:\d+$/,
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);                   // Postman, curl, SSR...
    const ok = allowlist.some((re) => re.test(origin));
    return cb(null, ok ? true : false);                   // phản chiếu origin khi hợp lệ
  },
  credentials: true,                                      // ✔️ cho phép cookie
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With","token"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));                       // ✔️ preflight dùng cùng cấu hình

app.use(cookieParser());
app.use(express.json());

// Log gọn
app.use((req, _res, next) => { console.log(`[${req.method}] ${req.originalUrl}`); next(); });

// ===== Mount routes =====
const authRoute      = require("./auth-services/routes/auth");
const userRoute      = require("./auth-services/routes/user");
// admin
const productRoute   = require("./admin-services/routes/product");
const uploadRoutes   = require("./admin-services/routes/image");
const supplierRoutes = require("./admin-services/routes/supplier");
// product
const cartRoutes     = require("./product-services/routes/cart");
const orderRoutes    = require("./product-services/routes/order");
const stockRoutes    = require("./product-services/routes/stock");
const productRoutes  = require("./product-services/routes/product");
const couponRoutes   = require("./product-services/routes/coupon");

// Static file
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================== API ==================

// ---- Auth & User ----
app.use("/api/auth",    authRoute);
app.use("/api/user",    userRoute);

// ---- Admin ----
app.use("/api",         uploadRoutes);       // upload ảnh
app.use("/api/product", productRoute);       // CRUD sản phẩm (admin)
app.use("/api/supplier", supplierRoutes);
app.use("/api/stock",   stockRoutes);        // nhập/xem tồn kho

// ---- Public/User ----
app.use("/api/product", productRoutes);      // GET sản phẩm (user)
app.use("/api/coupon",  couponRoutes);
app.use("/api/cart",    cartRoutes);
app.use("/api/order",   orderRoutes);

// 404 JSON
app.use((req, res) => res.status(404).json({ message: "Not Found", path: req.originalUrl }));

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
