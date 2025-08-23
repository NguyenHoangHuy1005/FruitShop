const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./auth-services/config/db");
const cookieParser = require("cookie-parser");
const authRoute = require("./auth-services/routes/auth");
const userRoute = require("./auth-services/routes/user");
const productRoute = require("./admin-services/routes/product");
const uploadRoutes = require("./admin-services/routes/image");
// session
const session = require("express-session");

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: "http://localhost:5173", // Đúng domain FE
  credentials: true                // Cho phép cookie
}));
app.use(cookieParser());
app.use(express.json());
//
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

//session
app.use(session({
  secret: "your_secret_key",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // để true nếu chạy HTTPS
}));

//upload ảnh lên cloudinary
app.use("/api", uploadRoutes);

//routes
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/product", productRoute);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});

