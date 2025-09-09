// BE/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./auth-services/config/db");
const cookieParser = require("cookie-parser");
const path = require("path");

const authRoute    = require("./auth-services/routes/auth");
const userRoute    = require("./auth-services/routes/user");
const productRoute = require("./admin-services/routes/product");
const uploadRoutes = require("./admin-services/routes/image");
//mới đây nè
const supplierRoutes = require("./admin-services/routes/supplier");
const stockRoutes = require("./product-services/routes/stock");

// 🔧 ĐÚNG tên file routes (không phải *Routers*)
const cartRoutes  = require("./product-services/routes/cart");
const orderRoutes = require("./product-services/routes/order");

dotenv.config();
connectDB();

const app = express();

// CORS
const allowlist = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/\[::1\]:\d+$/];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const ok = allowlist.some((re) => re.test(origin));
    cb(null, ok);
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With","token"],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 204,
}));
app.options("*", cors());

app.use(cookieParser());
app.use(express.json());

// Log gọn
app.use((req, _res, next) => { console.log(`[${req.method}] ${req.originalUrl}`); next(); });

// ===== Mount routes 1 LẦN =====
app.use("/api",  uploadRoutes);
app.use("/api/auth",    authRoute);
app.use("/api/user",    userRoute);
app.use("/api/product", productRoute);

app.use("/api/cart",   cartRoutes);   // <- /api/cart/... (PUT /item/:productId OK)
app.use("/api/order",  orderRoutes);  // <- KHỚP FE: POST /api/order

// tồn kho
app.use("/api/stock", stockRoutes);
app.use("/api/supplier", supplierRoutes);

// Static file
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// 404 JSON
app.use((req, res) => res.status(404).json({ message: "Not Found", path: req.originalUrl }));

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
