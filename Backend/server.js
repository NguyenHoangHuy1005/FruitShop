// BE/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./auth-services/config/db');

// Connect DB
connectDB();

// Create app
const app = express();

// === Global safety guards to avoid process exit during debugging ===
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION', err && err.stack ? err.stack : err);
  // NOTE: do not exit here while debugging to avoid 502 from ngrok immediately
});
process.on('unhandledRejection', (reason, p) => {
  console.error('UNHANDLED REJECTION', reason);
});

// === Raw body saver for webhooks (keeps original buffer) ===
const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) req.rawBody = Buffer.from(buf);
};

// === Body parsers (order matters) ===
app.use(express.json({
  limit: '15mb',
  verify: rawBodySaver,
  type: ['application/json', 'application/*+json']
}));
app.use(express.text({
  limit: '15mb',
  verify: rawBodySaver,
  type: ['text/*']
}));
app.use(express.urlencoded({ extended: true, limit: '15mb', verify: rawBodySaver }));

// Trust proxy (useful behind ngrok/nginx)
app.set('trust proxy', 1);

// ===== CORS configuration =====
const allowlist = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/\[::1\]:\d+$/
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow Postman / curl / server-to-server
    const ok = allowlist.some((re) => re.test(origin));
    return cb(null, ok ? true : false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'token'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// === Other middleware ===
app.use(cookieParser());

// Simple request logger
app.use((req, _res, next) => {
  if (req.method !== 'GET' || req.originalUrl.includes('/webhook')) {
    console.log(`[${req.method}] ${req.originalUrl}`);
  }
  next();
});

// ===== Mount routes =====
const authRoute = require('./auth-services/routes/auth');
const userRoute = require('./auth-services/routes/user');
// admin
const productRoute = require('./admin-services/routes/product');
const uploadRoutes = require('./admin-services/routes/image');
const supplierRoutes = require('./admin-services/routes/supplier');
// product
const cartRoutes = require('./product-services/routes/cart');
const orderRoutes = require('./product-services/routes/order');
const stockRoutes = require('./product-services/routes/stock');
const productRoutes = require('./product-services/routes/product');
const couponRoutes = require('./product-services/routes/coupon');
const paymentRoutes = require('./payment-services/routes/payment');
// content-services
const articleRoutes = require('./content-services/routes/article');
const reviewRoutes = require('./content-services/routes/review');
const commentRoutes = require('./content-services/routes/comment');
// auth-services
const notificationRoutes = require('./auth-services/routes/notification');

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- Auth & User ----
app.use('/api/auth', authRoute);
app.use('/api/user', userRoute);
app.use('/api/notification', notificationRoutes);

// ---- Admin ----
app.use('/api', uploadRoutes);
app.use('/api/product', productRoute); // admin CRUD
app.use('/api/supplier', supplierRoutes);
app.use('/api/stock', stockRoutes);

// ---- Public/User ----
app.use('/api/product', productRoutes); // user-facing product endpoints
app.use('/api/coupon', couponRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/article', articleRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/comment', commentRoutes);

// 404 JSON
app.use((req, res) => res.status(404).json({ message: 'Not Found', path: req.originalUrl }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR HANDLER', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, msg: 'server_error' });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
