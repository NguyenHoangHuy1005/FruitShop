const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Stock = require("../models/Stock");
const Product = require("../../admin-services/models/Product");
const Supplier = require("../../admin-services/models/Supplier");
const ImportReceipt = require("../../admin-services/models/ImportReceipt");
const ImportItem = require("../../admin-services/models/ImportItem");
const User = require("../../auth-services/models/User");

const invoicesDir = path.join(__dirname, "../../admin-services/uploads/invoices");
fs.mkdirSync(invoicesDir, { recursive: true });

// ✅ cho phép dùng session
async function upsertProductInventory(productId, onHand, session = null) {
  const qty = Math.max(0, Number(onHand) || 0);
  const status = qty > 0 ? "Còn hàng" : "Hết hàng";
  try {
    const opts = session ? { session, new: false } : { new: false };
    await Product.findByIdAndUpdate(productId, { $set: { onHand: qty, status } }, opts);
  } catch (_) {}
}
async function updateProductStatus(productId, onHand, session = null) {
  return upsertProductInventory(productId, onHand, session);
}

// Lấy tồn kho 1 sản phẩm
exports.getOne = async (req, res) => {
  const { productId } = req.params;
  const doc = await Stock.findOne({ product: productId }).lean();
  return res.json(doc || { product: productId, onHand: 0 });
};

// Danh sách tồn kho (kèm product)
exports.list = async (_req, res) => {
  try {
    const rows = await Stock.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "p"
        }
      },
      { $addFields: { productDoc: { $arrayElemAt: ["$p", 0] } } },
      { $project: { p: 0 } }
    ]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Lỗi lấy danh sách tồn kho", error: err.message });
  }
};

// Nhập kho đơn giản (+)
exports.stockIn = async (req, res) => {
  const { productId, qty = 0 } = req.body || {};
  const inc = Math.max(0, parseInt(qty, 10) || 0);
  if (!productId || inc <= 0) return res.status(400).json({ message: "Thiếu productId hoặc qty > 0" });

  const doc = await Stock.findOneAndUpdate(
    { product: productId },
    { $inc: { onHand: inc } },
    { new: true, upsert: true }
  );

  await upsertProductInventory(productId, doc.onHand);
  return res.json({ ok: true, data: doc });
};

// Set cứng số tồn
exports.setQuantity = async (req, res) => {
  const { productId, qty = 0 } = req.body || {};
  const val = Math.max(0, parseInt(qty, 10) || 0);
  if (!productId) return res.status(400).json({ message: "Thiếu productId" });

  const doc = await Stock.findOneAndUpdate(
    { product: productId },
    { $set: { onHand: val } },
    { new: true, upsert: true }
  );

  await upsertProductInventory(productId, doc.onHand);
  return res.json({ ok: true, data: doc });
};

// ===== nhập kho kèm phiếu + hóa đơn (đã sửa) =====
exports.stockInWithInvoice = async (req, res) => {
  let session = null;
  try {
    const { supplierId, items, note } = req.body || {};
    const adminId = req.user?.id || req.userId;

    // ---- Validate cơ bản
    if (!supplierId) return res.status(400).json({ message: "Thiếu supplierId" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Thiếu items" });
    }
    for (const it of items) {
      if (!it?.productId) return res.status(400).json({ message: "Thiếu productId trong items" });
      if (!(Number(it?.quantity) > 0)) return res.status(400).json({ message: "quantity phải > 0" });
      if (!(Number(it?.unitPrice) >= 0)) return res.status(400).json({ message: "unitPrice phải >= 0" });
    }

    const [supplier, adminUser] = await Promise.all([
      Supplier.findById(supplierId),
      User.findById(adminId),
    ]);
    if (!supplier) return res.status(404).json({ message: "Không tìm thấy nhà cung cấp" });

    // ---- Bắt đầu (có) transaction nếu hỗ trợ
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null; // fallback không transaction
    }

    // Tạo phiếu
    const receipt = await ImportReceipt.create([{ supplier: supplierId, admin: adminId, note }], { session });
    const receiptDoc = Array.isArray(receipt) ? receipt[0] : receipt; // do create([]) với session trả mảng

    let totalAmount = 0;
    const savedItems = [];

    // Xử lý từng dòng + cập nhật tồn
    for (const it of items) {
      const p = await Product.findById(it.productId).select("name").lean();
      if (!p) throw new Error(`Sản phẩm không tồn tại: ${it.productId}`);

      const lineTotal = Number(it.quantity) * Number(it.unitPrice);
      totalAmount += lineTotal;

      const item = await ImportItem.create([{
        receipt: receiptDoc._id,
        product: it.productId,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        total: lineTotal
      }], { session });
      savedItems.push({ ...item[0].toObject(), productName: p.name });

      // cập nhật stock
      const stockDoc = await Stock.findOneAndUpdate(
        { product: it.productId },
        { $inc: { onHand: Number(it.quantity) } },
        { new: true, upsert: true, session }
      );

      await upsertProductInventory(it.productId, stockDoc.onHand, session);
    }

    // Cập nhật tổng tiền trước khi xuất PDF
    await ImportReceipt.updateOne(
      { _id: receiptDoc._id },
      { $set: { totalAmount } },
      { session }
    );

    // ---- Xuất PDF (chờ ghi file xong)
    const filePath = path.join(invoicesDir, `receipt_${receiptDoc._id}.pdf`);
    const docPDF = new PDFDocument({ margin: 30 });
    const writeStream = fs.createWriteStream(filePath);
    docPDF.pipe(writeStream);

    // thêm font tiếng Việt
    const fontPath = path.join(__dirname, "../../fronts/Roboto-Regular.ttf");
    docPDF.font(fontPath);
    // Header
    docPDF.fontSize(18).text(`HÓA ĐƠN NHẬP KHO #${receiptDoc._id}`, { align: "center" });
    docPDF.moveDown();

    // NCC
    docPDF.fontSize(12).text(`Nhà cung cấp: ${supplier.name}`);
    docPDF.text(`Liên hệ: ${supplier.contact_name || ""} - ${supplier.phone || ""}`);
    docPDF.text(`Email: ${supplier.email || ""}`);
    docPDF.text(`Địa chỉ: ${supplier.address || ""}`);
    docPDF.moveDown();

    // Người nhập
    docPDF.text(`Người nhập: ${adminUser.fullname || adminUser.username || adminUser.email}`);
    docPDF.text(`Ngày nhập: ${new Date().toLocaleString()}`);
    docPDF.text(`Ghi chú: ${note || "-"}`);
    docPDF.moveDown();

    // Bảng chi tiết
    docPDF.fontSize(12).text("Chi tiết nhập hàng:", { underline: true });
    savedItems.forEach((it, idx) => {
      docPDF.text(
        `${idx + 1}. ${it.productName} | SL: ${it.quantity} | Đơn giá: ${Number(it.unitPrice).toLocaleString()} VND | Thành tiền: ${Number(it.total).toLocaleString()} VND`
      );
    });

    docPDF.moveDown();
    docPDF.fontSize(14).text(`TỔNG CỘNG: ${Number(totalAmount).toLocaleString()} VND`, { align: "right" });
    docPDF.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Lưu đường dẫn file
    await ImportReceipt.updateOne(
      { _id: receiptDoc._id },
      { $set: { invoicePath: filePath } },
      { session }
    );

    // Commit (nếu có)
    if (session) await session.commitTransaction();

    return res.json({
      ok: true,
      message: "Nhập kho thành công",
      receiptId: String(receiptDoc._id),                    // ✅ trả về id
      invoiceUrl: `/stock/invoice/${receiptDoc._id}`        // ✅ vẫn giữ route download
    });
  } catch (err) {
    if (session) {
      try { await session.abortTransaction(); } catch {}
    }
    console.error("stockInWithInvoice error:", err);
    return res.status(500).json({ message: "Lỗi nhập kho", error: err.message });
  } finally {
    if (session) session.endSession();
  }
};

// tải PDF
exports.downloadInvoice = async (req, res) => {
  try {
    const receipt = await ImportReceipt.findById(req.params.id);
    if (!receipt || !receipt.invoicePath) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    res.download(receipt.invoicePath, `invoice_${receipt._id}.pdf`);
  } catch (e) {
    res.status(500).json({ message: "Lỗi tải hóa đơn" });
  }
};

exports.listReceipts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const receipts = await ImportReceipt.find()
      .populate("supplier", "name")
      .populate("admin", "fullname username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    const total = await ImportReceipt.countDocuments();

    res.json({ data: receipts, total });
  } catch (e) {
    res.status(500).json({ message: "Lỗi lấy danh sách hóa đơn", error: e.message });
  }
};

exports.getReceiptOne = async (req, res) => {
  try {
    const receipt = await ImportReceipt.findById(req.params.id)
      .populate("supplier")
      .populate("admin", "fullname username email")
      .lean();

    if (!receipt) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });

    const items = await ImportItem.find({ receipt: receipt._id })
      .populate("product", "name")
      .lean();

    res.json({ ...receipt, items });
  } catch (e) {
    res.status(500).json({ message: "Lỗi lấy chi tiết hóa đơn", error: e.message });
  }
};


exports._updateProductStatus = updateProductStatus;
exports._upsertProductInventory = upsertProductInventory;
