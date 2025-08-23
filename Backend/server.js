// BE/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./auth-services/config/db");
const cookieParser = require("cookie-parser");

const authRoute = require("./auth-services/routes/auth");
const userRoute = require("./auth-services/routes/user");
const productRoute = require("./admin-services/routes/product");
const uploadRoutes = require("./admin-services/routes/image");

dotenv.config();
connectDB();

const app = express();

// ✅ CORS: Duy nhất 1 lần, TRƯỚC routes
const allowlist = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/\[::1\]:\d+$/];
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // dev tools, curl…
    const ok = allowlist.some((re) => re.test(origin));
    return cb(null, ok);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "token"],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // handle preflight

app.use(cookieParser());
app.use(express.json());

// Log
app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Routes
app.use("/api/upload", uploadRoutes);
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/product", productRoute);

// 404 JSON để FE luôn nhận được message
app.use((req, res) => {
  res.status(404).json({ message: "Not Found", path: req.originalUrl });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
