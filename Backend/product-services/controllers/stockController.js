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

// ✅ Tính toán số lượng tồn kho và trạng thái từ các lô hàng
async function upsertProductInventory(productId, onHand = null, session = null) {
  try {
    // Lấy tất cả lô hàng của sản phẩm
    const importItems = await ImportItem.find({ product: productId }).lean();
    
    if (importItems.length === 0) {
      // Nếu không có lô hàng, sử dụng giá trị onHand được truyền vào hoặc 0
      const qty = Math.max(0, Number(onHand) || 0);
      const status = qty > 0 ? "Còn hàng" : "Hết hàng";
      
      const opts = session ? { session, new: false } : { new: false };
      await Product.findByIdAndUpdate(productId, { $set: { onHand: qty, status } }, opts);
      return;
    }

    // Tính số lượng đã bán theo batchId từ orders (ưu tiên) hoặc FIFO
    const Order = require("../models/Order");
    const orders = await Order.find({ 
      'items.product': productId,
      status: { $in: ['paid', 'completed', 'shipped', 'delivered'] }
    }).select('items createdAt').lean();

    // Calculate sold quantities per batch
    const batchSoldMap = {};
    importItems.forEach(batch => {
      batchSoldMap[batch._id.toString()] = 0;
    });

    // First pass: allocate sales with explicit batchId
    const salesWithoutBatch = [];
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product.toString() === productId.toString()) {
          if (item.batchId) {
            const batchId = item.batchId.toString();
            if (batchSoldMap.hasOwnProperty(batchId)) {
              batchSoldMap[batchId] += item.quantity;
            } else {
              salesWithoutBatch.push({ quantity: item.quantity, date: order.createdAt });
            }
          } else {
            salesWithoutBatch.push({ quantity: item.quantity, date: order.createdAt });
          }
        }
      });
    });

    // Second pass: allocate remaining sales using FIFO
    const sortedBatches = [...importItems].sort((a, b) => 
      new Date(a.importDate) - new Date(b.importDate)
    );
    
    let remainingSold = salesWithoutBatch.reduce((sum, s) => sum + s.quantity, 0);
    
    // Allocate remaining sold quantities using FIFO
    for (const batch of sortedBatches) {
      if (remainingSold <= 0) break;
      
      const batchId = batch._id.toString();
      const alreadySold = batchSoldMap[batchId] || 0;
      const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
      const available = Math.max(0, effectiveQty - alreadySold);
      
      const toAllocate = Math.min(remainingSold, available);
      batchSoldMap[batchId] += toAllocate;
      remainingSold -= toAllocate;
    }
    
    // Now calculate total in stock
    let totalInStock = 0;
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    let earliestExpiryStatus = "Còn hàng"; // Mặc định là "Còn hàng"

    for (const batch of sortedBatches) {
      const batchId = batch._id.toString();
      const soldFromThisBatch = batchSoldMap[batchId] || 0;
      const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
      const remainingInThisBatch = Math.max(0, effectiveQty - soldFromThisBatch);
      
      // Kiểm tra xem lô có còn hiệu lực không
      let isValidBatch = true;
      if (batch.expiryDate) {
        const expiryDate = new Date(batch.expiryDate);
        isValidBatch = expiryDate > now; // Chỉ tính lô chưa hết hạn
      }

      // Chỉ cộng vào tổng tồn kho nếu lô còn hiệu lực
      if (isValidBatch) {
        totalInStock += remainingInThisBatch;
      }
      
      remainingSold -= soldFromThisBatch;

      // Kiểm tra trạng thái hết hạn của lô có số lượng còn lại và còn hiệu lực
      if (remainingInThisBatch > 0 && isValidBatch && batch.expiryDate) {
        const expiryDate = new Date(batch.expiryDate);
        
        if (expiryDate <= oneWeekFromNow && earliestExpiryStatus === "Còn hàng") {
          earliestExpiryStatus = "Sắp hết hạn";
        }
      }
    }

    // Xác định trạng thái cuối cùng
    let finalStatus = "Còn hàng";
    if (totalInStock <= 0) {
      finalStatus = "Hết hàng";
    } else {
      finalStatus = earliestExpiryStatus; // Có thể là "Còn hàng" hoặc "Sắp hết hạn"
    }

    // Cập nhật Product với số liệu tính toán từ lô hàng
    const opts = session ? { session, new: false } : { new: false };
    await Product.findByIdAndUpdate(productId, { 
      $set: { 
        onHand: totalInStock, 
        status: finalStatus 
      } 
    }, opts);

  } catch (err) {
    console.error("Error calculating inventory from batches:", err);
    // Fallback về logic cũ
    const qty = Math.max(0, Number(onHand) || 0);
    const status = qty > 0 ? "Còn hàng" : "Hết hàng";
    
    try {
      const opts = session ? { session, new: false } : { new: false };
      await Product.findByIdAndUpdate(productId, { $set: { onHand: qty, status } }, opts);
    } catch (_) {}
  }
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
    // Lookup product documents and drop stock rows whose product no longer exists.
    // This prevents deleted products from appearing in the stock overview.
    const rows = await Stock.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "p"
        }
      },
      // Unwind will remove documents with empty "p" array (no matching product)
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: false } },
      { $addFields: { productDoc: "$p" } },
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

// Xuất kho / Giảm tồn (accept positive qty to reduce)
exports.stockOut = async (req, res) => {
  try {
    const { productId, qty = 0 } = req.body || {};
    const dec = Math.max(0, parseInt(qty, 10) || 0);
    if (!productId || dec <= 0) return res.status(400).json({ message: "Thiếu productId hoặc qty > 0" });

    // Read current stock and compute new value (clamped to 0)
    const current = await Stock.findOne({ product: productId }).lean();
    const currentOnHand = current?.onHand || 0;
    const newOnHand = Math.max(0, currentOnHand - dec);

    const doc = await Stock.findOneAndUpdate(
      { product: productId },
      { $set: { onHand: newOnHand } },
      { new: true, upsert: true }
    );

    // Recompute product inventory from batches (authoritative)
    await upsertProductInventory(productId, doc.onHand);

    return res.json({ ok: true, data: doc });
  } catch (err) {
    console.error('Error in stockOut:', err);
    return res.status(500).json({ message: 'Lỗi giảm tồn kho', error: err.message });
  }
};

// Set cứng số tồn (DEPRECATED - không dùng nữa)
exports.setQuantity = async (req, res) => {
  return res.status(410).json({ 
    message: "Chức năng 'Đặt tồn' đã bị vô hiệu hóa. Vui lòng chỉ sử dụng 'Nhập kho' để tăng số lượng tồn." 
  });
  
  /* DEPRECATED CODE - kept for reference
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
  */
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
      // Validate importDate và expiryDate nếu có
      if (it.importDate && isNaN(new Date(it.importDate).getTime())) {
        return res.status(400).json({ message: "importDate không hợp lệ" });
      }
      if (it.expiryDate && isNaN(new Date(it.expiryDate).getTime())) {
        return res.status(400).json({ message: "expiryDate không hợp lệ" });
      }
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
      const p = await Product.findById(it.productId).select("name image").lean();
      if (!p) throw new Error(`Sản phẩm không tồn tại: ${it.productId}`);

      const lineTotal = Number(it.quantity) * Number(it.unitPrice);
      totalAmount += lineTotal;

      // Lưu snapshot thông tin sản phẩm để giữ lại khi product bị xóa
      const item = await ImportItem.create([{
        receipt: receiptDoc._id,
        product: it.productId,
        productName: p.name,
        productImage: Array.isArray(p.image) ? p.image[0] : p.image,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        total: lineTotal,
        importDate: it.importDate ? new Date(it.importDate) : new Date(),
        expiryDate: it.expiryDate ? new Date(it.expiryDate) : null
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
      const importDateStr = it.importDate ? new Date(it.importDate).toLocaleDateString('vi-VN') : 'Không có';
      const expiryDateStr = it.expiryDate ? new Date(it.expiryDate).toLocaleDateString('vi-VN') : 'Không có';
      docPDF.text(
        `${idx + 1}. ${it.productName} | SL: ${it.quantity} | Đơn giá: ${Number(it.unitPrice).toLocaleString()} VND | Thành tiền: ${Number(it.total).toLocaleString()} VND`
      );
      docPDF.text(`   Ngày nhập: ${importDateStr} | HSD: ${expiryDateStr}`);
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


// API endpoint để lấy các sản phẩm sắp hết hạn
exports.getExpiringItems = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysAhead = parseInt(days, 10) || 7;
    
    const currentDate = new Date();
    const futureDate = new Date();
    futureDate.setDate(currentDate.getDate() + daysAhead);
    
    // Tìm các ImportItem có expiryDate trong khoảng thời gian xác định
    const expiringItems = await ImportItem.find({
      expiryDate: { 
        $exists: true, 
        $ne: null,
        $lte: futureDate 
      }
    })
    .populate('product', 'name')
    .populate({
      path: 'receipt',
      populate: {
        path: 'supplier',
        select: 'name'
      }
    })
    .lean();
    
    // Format dữ liệu để gửi về frontend
    const formattedItems = expiringItems.map(item => ({
      _id: item._id,
      productName: item.product?.name || 'Unknown',
      supplierName: item.receipt?.supplier?.name || 'Unknown',
      quantity: item.quantity,
      expiryDate: item.expiryDate,
      importDate: item.importDate,
      receiptId: item.receipt?._id
    }));
    
    // Sắp xếp theo mức độ ưu tiên: Hết hạn -> Sắp hết hạn (ít ngày trước) -> Còn hạn
    formattedItems.sort((a, b) => {
      const now = new Date();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      
      const aExpiry = new Date(a.expiryDate);
      const bExpiry = new Date(b.expiryDate);
      
      const aDaysLeft = Math.ceil((aExpiry - now) / (24 * 60 * 60 * 1000));
      const bDaysLeft = Math.ceil((bExpiry - now) / (24 * 60 * 60 * 1000));
      
      // Xác định trạng thái
      const getStatus = (daysLeft) => {
        if (daysLeft <= 0) return 'expired';
        if (daysLeft <= 7) return 'expiring';
        return 'valid';
      };
      
      const aStatus = getStatus(aDaysLeft);
      const bStatus = getStatus(bDaysLeft);
      
      // Sắp xếp theo ưu tiên: còn hạn -> sắp hết hạn -> hết hạn (xuống cuối)
      const statusPriority = { 'valid': 0, 'expiring': 1, 'expired': 2 };
      
      if (aStatus !== bStatus) {
        return statusPriority[aStatus] - statusPriority[bStatus];
      }
      
      // Nếu cùng trạng thái, sắp xếp theo ngày hết hạn (gần nhất trước)
      return aExpiry - bExpiry;
    });
    
    res.json(formattedItems);
  } catch (error) {
    console.error('Error fetching expiring items:', error);
    res.status(500).json({ message: 'Lỗi lấy danh sách sản phẩm sắp hết hạn', error: error.message });
  }
};

// API để lấy chi tiết từng lô hàng theo sản phẩm
exports.getBatchesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({ message: 'Thiếu productId' });
    }

    // Lấy các ImportItem của sản phẩm cụ thể
    const importItems = await ImportItem.find({ product: productId })
      .populate('product', 'name image price')
      .populate({
        path: 'receipt',
        populate: {
          path: 'supplier',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    // Lấy thông tin đơn hàng để tính số lượng đã bán
    const Order = require("../models/Order");
    const orders = await Order.find({ 
      'items.product': productId,
      status: { $in: ['paid', 'completed', 'shipped', 'delivered'] } // Chỉ tính đơn hàng đã thanh toán/hoàn thành
    }).select('items createdAt').lean();

    // Format dữ liệu để gửi về frontend - sử dụng soldQuantity được lưu trong database
    const batchDetails = importItems.map(item => {
      const now = new Date();
      let status = 'valid';
      let daysLeft = null;
      
      if (item.expiryDate) {
        const expiryDate = new Date(item.expiryDate);
        daysLeft = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
        
        if (daysLeft <= 0) {
          status = 'expired';
        } else if (daysLeft <= 7) {
          status = 'expiring';
        }
      }

  // Sử dụng soldQuantity từ database thay vì tính toán
  const soldQuantity = item.soldQuantity || 0;
  const damaged = item.damagedQuantity || 0;
  const remainingQuantity = Math.max(0, (item.quantity || 0) - soldQuantity - damaged);

      return {
        _id: item._id,
        productId: item.product?._id,
        productName: item.product?.name || 'Unknown',
        productImage: item.product?.image?.[0] || null,
        productPrice: item.product?.price || 0,
        supplierName: item.receipt?.supplier?.name || 'Unknown',
        
        // Thông tin batch (đã tính chính xác)
  batchQuantity: item.quantity,           // Số lượng nhập ban đầu
  damagedQuantity: item.damagedQuantity || 0,
  remainingQuantity: remainingQuantity,   // Số lượng còn lại = nhập - đã bán - hư hỏng
        soldQuantity: soldQuantity,             // Số lượng đã bán (tính theo FIFO)
        unitPrice: item.unitPrice,             // Đơn giá nhập
        sellingPrice: item.sellingPrice || item.unitPrice, // Giá bán (mặc định = giá nhập)
        importDate: item.importDate,           // Ngày nhập
        expiryDate: item.expiryDate,          // Hạn sử dụng
        
        // Thông tin trạng thái
        status,
        daysLeft,
        
        // Thông tin receipt
        receiptId: item.receipt?._id,
        createdAt: item.createdAt
      };
    });

    // Tính tổng số lượng trong kho - chỉ tính lô còn hiệu lực
    const totalInStock = batchDetails.reduce((sum, batch) => {
        // Chỉ cộng số lượng của các lô còn hiệu lực (chưa hết hạn)
      return batch.status !== 'expired' ? sum + batch.remainingQuantity : sum;
    }, 0);
    const totalSoldFromAllBatches = batchDetails.reduce((sum, batch) => sum + batch.soldQuantity, 0);

    // Sắp xếp theo FEFO - First Expired First Out (gần hết hạn trước, hết hạn cuối)
    batchDetails.sort((a, b) => {
      // Ưu tiên 1: Lô hết hạn đẩy xuống cuối
      if (a.status === 'expired' && b.status !== 'expired') return 1;
      if (b.status === 'expired' && a.status !== 'expired') return -1;
      
      // Ưu tiên 2: Trong các lô chưa hết hạn, sắp xếp CHỈ theo ngày hết hạn (bỏ qua status valid/expiring)
      if (a.status !== 'expired' && b.status !== 'expired') {
        // Lô không có hạn sử dụng đẩy xuống cuối (nhưng vẫn trước lô hết hạn)
        if (!a.expiryDate && !b.expiryDate) {
          return new Date(a.importDate) - new Date(b.importDate); // FIFO cho lô không có hạn
        }
        if (!a.expiryDate) return 1; // a đặt sau
        if (!b.expiryDate) return -1; // b đặt sau
        
        // FEFO thuần túy: sắp xếp theo hạn sử dụng (gần hết hạn trước)
        const expiryDiff = new Date(a.expiryDate) - new Date(b.expiryDate);
        // Nếu cùng ngày hết hạn, áp dụng FIFO (lô nhập trước được bán trước)
        if (expiryDiff === 0) {
          return new Date(a.importDate) - new Date(b.importDate);
        }
        return expiryDiff;
      }
      
      // Ưu tiên 3: Trong các lô hết hạn, sắp xếp theo ngày hết hạn (hết hạn sớm trước), nếu cùng ngày thì FIFO
      if (a.status === 'expired' && b.status === 'expired') {
        if (a.expiryDate && b.expiryDate) {
          const expiryDiff = new Date(a.expiryDate) - new Date(b.expiryDate);
          if (expiryDiff === 0) {
            return new Date(a.importDate) - new Date(b.importDate);
          }
          return expiryDiff;
        }
      }
      
      return 0;
    });

    // Xác định lô đang được sử dụng (FEFO - lô gần hết hạn nhất còn hàng và chưa hết hạn)
    // Tìm lô đầu tiên trong danh sách đã sắp xếp theo FEFO có còn hàng
    const activeBatchIndex = batchDetails.findIndex(batch => 
      batch.remainingQuantity > 0 && batch.status !== 'expired'
    );
    
    // Đánh dấu lô đang hoạt động
    if (activeBatchIndex !== -1) {
      batchDetails[activeBatchIndex].isActive = true;
    }

    // Tính tổng hợp các giá trị
    const totalImported = batchDetails.reduce((sum, batch) => sum + batch.batchQuantity, 0);
    const totalDamaged = batchDetails.reduce((sum, batch) => sum + (batch.damagedQuantity || 0), 0);
    const totalExpired = batchDetails.reduce((sum, batch) => {
      // Chỉ tính số lượng còn lại của các lô đã hết hạn
      return batch.status === 'expired' ? sum + batch.remainingQuantity : sum;
    }, 0);
    const totalRemaining = batchDetails.reduce((sum, batch) => {
      // Chỉ tính số lượng còn lại của các lô chưa hết hạn
      return batch.status !== 'expired' ? sum + batch.remainingQuantity : sum;
    }, 0);

    // Trả về dữ liệu với thông tin tổng hợp
    res.json({
      batches: batchDetails,
      summary: {
        totalBatches: batchDetails.length,
        totalImported: totalImported,
        totalSold: totalSoldFromAllBatches,
        totalDamaged: totalDamaged,
        totalExpired: totalExpired,
        totalRemaining: totalRemaining,
        totalInStock: totalInStock  // Deprecated, use totalRemaining instead
      }
    });
  } catch (error) {
    console.error('Error fetching batches by product:', error);
    res.status(500).json({ message: 'Lỗi lấy thông tin lô hàng theo sản phẩm', error: error.message });
  }
};

// API để lấy chi tiết từng lô hàng
exports.getBatchDetails = async (req, res) => {
  try {
    // Lấy tất cả ImportItem với thông tin chi tiết
    const importItems = await ImportItem.find({})
      .populate('product', 'name image')
      .populate({
        path: 'receipt',
        populate: {
          path: 'supplier',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    // Lấy tất cả đơn hàng đã hoàn thành
    const Order = require("../models/Order");
    const orders = await Order.find({ 
      status: { $in: ['completed', 'shipped', 'delivered'] }
    }).select('items createdAt').lean();

    // Format dữ liệu để gửi về frontend - sử dụng soldQuantity được lưu trong database
    const batchDetails = importItems.map(item => {
      // Sử dụng soldQuantity từ database thay vì tính toán
      const soldQuantity = item.soldQuantity || 0;
      const damaged = Number(item.damagedQuantity || 0);
      // remaining = original quantity - sold - damaged
      const remainingQuantity = Math.max(0, item.quantity - soldQuantity - damaged);

      // Ưu tiên thông tin đã lưu (snapshot) nếu product bị xóa
      const productName = item.product?.name || item.productName || 'Unknown';
      const productImage = item.product?.image?.[0] || item.productImage || null;
      const isProductDeleted = !item.product; // Product đã bị xóa

      return {
        _id: item._id,
        productId: item.product?._id || null,
        productName: productName,
        productImage: productImage,
        isProductDeleted: isProductDeleted, // Đánh dấu để frontend disable chỉnh sửa
        supplierName: item.receipt?.supplier?.name || 'Unknown',

        // Thông tin batch (đã tính chính xác)
        batchQuantity: item.quantity,                  // Số lượng nhập ban đầu
        remainingQuantity: remainingQuantity,          // Số lượng còn lại (trừ hư hỏng)
        damagedQuantity: damaged,                      // Số lượng đã bị ghi nhận hư hỏng
        soldQuantity: soldQuantity,                    // Số lượng đã bán
        unitPrice: item.unitPrice,                     // Đơn giá nhập
        sellingPrice: item.sellingPrice || item.unitPrice, // Giá bán
        importDate: item.importDate,                   // Ngày nhập
        expiryDate: item.expiryDate,                   // Hạn sử dụng

        // Thông tin receipt
        receiptId: item.receipt?._id,
        createdAt: item.createdAt
      };
    });

    // Sắp xếp theo FEFO + FIFO - Lô gần hết hạn trước, nếu cùng ngày hết hạn thì lô nhập trước được ưu tiên
    batchDetails.sort((a, b) => {
      const now = new Date();
      
      // Nếu không có ngày hết hạn, xếp cuối và áp dụng FIFO
      if (!a.expiryDate && !b.expiryDate) {
        return new Date(a.importDate) - new Date(b.importDate);
      }
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      
      const aExpiry = new Date(a.expiryDate);
      const bExpiry = new Date(b.expiryDate);
      
      const aDaysLeft = Math.ceil((aExpiry - now) / (24 * 60 * 60 * 1000));
      const bDaysLeft = Math.ceil((bExpiry - now) / (24 * 60 * 60 * 1000));
      
      // Xác định trạng thái
      const getStatus = (daysLeft) => {
        if (daysLeft <= 0) return 'expired';
        if (daysLeft <= 7) return 'expiring';
        return 'valid';
      };
      
      const aStatus = getStatus(aDaysLeft);
      const bStatus = getStatus(bDaysLeft);
      
      // Sắp xếp theo ưu tiên: Lô hết hạn xuống cuối
      if (aStatus === 'expired' && bStatus !== 'expired') return 1;
      if (bStatus === 'expired' && aStatus !== 'expired') return -1;
      
      // Trong các lô chưa hết hạn: sắp xếp theo ngày hết hạn (FEFO), nếu cùng ngày thì FIFO
      if (aStatus !== 'expired' && bStatus !== 'expired') {
        const expiryDiff = aExpiry - bExpiry;
        if (expiryDiff === 0) {
          return new Date(a.importDate) - new Date(b.importDate);
        }
        return expiryDiff;
      }
      
      // Trong các lô đã hết hạn: sắp xếp theo ngày hết hạn, nếu cùng ngày thì FIFO
      if (aStatus === 'expired' && bStatus === 'expired') {
        const expiryDiff = aExpiry - bExpiry;
        if (expiryDiff === 0) {
          return new Date(a.importDate) - new Date(b.importDate);
        }
        return expiryDiff;
      }
      
      return 0;
    });

    res.json(batchDetails);
  } catch (error) {
    console.error('Error fetching batch details:', error);
    res.status(500).json({ message: 'Lỗi lấy thông tin chi tiết lô hàng', error: error.message });
  }
};

// API để cập nhật giá bán cho lô hàng
exports.updateBatchSellingPrice = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { sellingPrice } = req.body;
    
    if (!batchId) {
      return res.status(400).json({ message: 'Thiếu batchId' });
    }
    
    if (sellingPrice === undefined || sellingPrice < 0) {
      return res.status(400).json({ message: 'Giá bán không hợp lệ' });
    }
    
    const updatedItem = await ImportItem.findByIdAndUpdate(
      batchId,
      { sellingPrice: Number(sellingPrice) },
      { new: true }
    );
    
    if (!updatedItem) {
      return res.status(404).json({ message: 'Không tìm thấy lô hàng' });
    }
    
    res.json({ 
      message: 'Cập nhật giá bán thành công',
      batchId,
      sellingPrice: Number(sellingPrice)
    });
  } catch (error) {
    console.error('Error updating batch selling price:', error);
    res.status(500).json({ message: 'Lỗi cập nhật giá bán', error: error.message });
  }
};

// API để cập nhật số lượng (quantity) cho một lô hàng (ImportItem)
exports.updateBatchQuantity = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { quantity } = req.body || {};

    if (!batchId) return res.status(400).json({ message: 'Thiếu batchId' });
    const newQty = Math.max(0, parseInt(quantity, 10));
    if (Number.isNaN(newQty)) return res.status(400).json({ message: 'quantity không hợp lệ' });

    const batch = await ImportItem.findById(batchId).lean();
    if (!batch) return res.status(404).json({ message: 'Không tìm thấy lô hàng' });

    // Sử dụng soldQuantity được lưu trong database
    const soldForThisBatch = batch.soldQuantity || 0;
    const currentDamaged = batch.damagedQuantity || 0;

    // newQty là số lượng hiện còn mà admin muốn đặt (không bao gồm đã bán và hư hỏng)
    // remainingQuantity = quantity - soldQuantity - damagedQuantity
    // => damagedQuantity = quantity - soldQuantity - newQty

    if (newQty > (batch.quantity - soldForThisBatch)) {
      return res.status(400).json({ message: 'Không thể đặt số lượng còn lại lớn hơn số lượng nhập trừ đi đã bán.' });
    }

    const currentRemaining = batch.quantity - soldForThisBatch - currentDamaged;
    if (newQty === currentRemaining) {
      return res.status(400).json({ message: 'Số lượng không thay đổi.' });
    }

    if (newQty < 0) {
      return res.status(400).json({ message: 'Số lượng còn lại không thể âm.' });
    }

    // Tính số lượng hư hỏng mới
    const newDamagedQuantity = batch.quantity - soldForThisBatch - newQty;
    
    if (newDamagedQuantity < 0) {
      return res.status(400).json({ message: 'Số lượng không hợp lệ.' });
    }

    // Update damagedQuantity, giữ nguyên quantity (số lượng nhập ban đầu)
    const updated = await ImportItem.findByIdAndUpdate(
      batchId,
      { $set: { damagedQuantity: newDamagedQuantity } },
      { new: true }
    );

    // Recompute stock and product inventory
    await upsertProductInventory(String(batch.product));

    const delta = newDamagedQuantity - currentDamaged;
    return res.json({ ok: true, batch: updated, damagedAdded: delta, newDamagedTotal: newDamagedQuantity });
  } catch (error) {
    console.error('Error updating batch quantity:', error);
    return res.status(500).json({ message: 'Lỗi cập nhật số lượng lô', error: error.message });
  }
};

// API để đồng bộ tất cả số lượng tồn kho từ lô hàng
exports.syncAllInventoryFromBatches = async (req, res) => {
  try {
    // Lấy tất cả sản phẩm có lô hàng
    const productIds = await ImportItem.distinct('product');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const productId of productIds) {
      try {
        await upsertProductInventory(productId);
        successCount++;
      } catch (error) {
        console.error(`Error syncing product ${productId}:`, error);
        errorCount++;
      }
    }
    
    res.json({
      message: 'Đồng bộ số lượng tồn kho hoàn tất',
      successCount,
      errorCount,
      totalProducts: productIds.length
    });
  } catch (error) {
    console.error('Error syncing all inventory:', error);
    res.status(500).json({ message: 'Lỗi đồng bộ số lượng tồn kho', error: error.message });
  }
};

// API để lấy thông tin giá và số lượng từ lô hàng còn hiệu lực gần nhất
exports.getLatestBatchInfo = async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({ message: 'Thiếu productId' });
    }

    // Lấy lô hàng còn hiệu lực theo FEFO (First Expired First Out)
    const now = new Date();
    const validBatches = await ImportItem.find({ 
      product: productId,
      $or: [
        { expiryDate: null }, // Không có hạn sử dụng
        { expiryDate: { $gt: now } } // Còn hạn
      ]
    })
    .populate('product', 'name image price')
    .populate({
      path: 'receipt',
      populate: {
        path: 'supplier',
        select: 'name'
      }
    })
    .lean();

    // Sắp xếp theo FEFO - lô gần hết hạn trước (giống logic ở getBatchesByProduct)
    validBatches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) {
        return new Date(a.importDate) - new Date(b.importDate); // FIFO cho lô không có hạn
      }
      if (!a.expiryDate) return 1; // Lô không có hạn đặt sau
      if (!b.expiryDate) return -1; // Lô không có hạn đặt sau
      
      // FEFO: sắp xếp theo hạn sử dụng (gần hết hạn trước), nếu cùng ngày thì FIFO
      const expiryDiff = new Date(a.expiryDate) - new Date(b.expiryDate);
      if (expiryDiff === 0) {
        return new Date(a.importDate) - new Date(b.importDate);
      }
      return expiryDiff;
    });

    // Tính toán số lượng đã bán cho từng lô để tìm lô có hàng
    // (cần tính trước khi chọn lô active)
    const Order = require("../models/Order");
    const orders = await Order.find({ 
      'items.product': productId,
      status: { $in: ['completed', 'shipped', 'delivered'] }
    }).select('items createdAt').lean();

    const totalSold = orders.reduce((sum, order) => {
      const productItems = order.items.filter(item => item.product.toString() === productId);
      return sum + productItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    // Tìm lô đầu tiên có còn hàng sau khi áp dụng FEFO
    let activeBatch = null;
    let remainingSold = totalSold;
    
    for (const batch of validBatches) {
      const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
      const soldFromThisBatch = Math.min(remainingSold, effectiveQty);
      const remainingInBatch = Math.max(0, effectiveQty - soldFromThisBatch);
      
      if (remainingInBatch > 0) {
        activeBatch = batch;
        break;
      }
      
      remainingSold -= soldFromThisBatch;
    }

    if (!activeBatch) {
      return res.status(404).json({ 
        message: 'Không tìm thấy lô hàng nào cho sản phẩm này' 
      });
    }

    // Tính số lượng đã bán và còn lại của lô active
    let soldFromActiveBatch = 0;
    let remainingSoldCalc = totalSold;
    
    // Lấy tất cả lô để tính FEFO (bao gồm cả expired để tính đúng)
    const allBatches = await ImportItem.find({ product: productId }).lean();
    allBatches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) {
        return new Date(a.importDate) - new Date(b.importDate);
      }
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      const expiryDiff = new Date(a.expiryDate) - new Date(b.expiryDate);
      if (expiryDiff === 0) {
        return new Date(a.importDate) - new Date(b.importDate);
      }
      return expiryDiff;
    });
    
    for (const batch of allBatches) {
      if (remainingSoldCalc <= 0) break;
      const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
      const soldFromThisBatch = Math.min(remainingSoldCalc, effectiveQty);
      remainingSoldCalc -= soldFromThisBatch;
      
      if (batch._id.toString() === activeBatch._id.toString()) {
        soldFromActiveBatch = soldFromThisBatch;
        break;
      }
    }

  const remainingInActiveBatch = Math.max(0, Math.max(0, (activeBatch.quantity || 0) - (activeBatch.damagedQuantity || 0)) - soldFromActiveBatch);

    // Tính tổng số lượng tồn kho của tất cả lô (chỉ tính lô chưa hết hạn)
    let totalInStock = 0;
    let remainingSoldForTotal = totalSold;
    for (const batch of validBatches) {
      const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
      if (remainingSoldForTotal <= 0) {
        totalInStock += effectiveQty;
      } else {
        const soldFromThisBatch = Math.min(remainingSoldForTotal, effectiveQty);
        const remainingInThisBatch = Math.max(0, effectiveQty - soldFromThisBatch);
        totalInStock += remainingInThisBatch;
        remainingSoldForTotal -= soldFromThisBatch;
      }
    }

    // Kiểm tra trạng thái hết hạn
    let status = 'valid';
    let daysLeft = null;
    
    if (activeBatch.expiryDate) {
      const expiryDate = new Date(activeBatch.expiryDate);
      daysLeft = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
      
      if (daysLeft <= 0) {
        status = 'expired';
      } else if (daysLeft <= 7) {
        status = 'expiring';
      }
    }

    res.json({
      // Thông tin từ lô đang hoạt động (FEFO - First Expired First Out)
      latestBatch: {
        _id: activeBatch._id,
        productId: activeBatch.product?._id,
        productName: activeBatch.product?.name || 'Unknown',
        supplierName: activeBatch.receipt?.supplier?.name || 'Unknown',
        
        // Giá và số lượng từ lô đang hoạt động
        unitPrice: activeBatch.unitPrice,
        sellingPrice: activeBatch.sellingPrice || activeBatch.unitPrice,
  batchQuantity: activeBatch.quantity,
  damagedQuantity: activeBatch.damagedQuantity || 0,
  remainingInThisBatch: remainingInActiveBatch,
  soldFromThisBatch: soldFromActiveBatch,
        
        // Thông tin ngày tháng
        importDate: activeBatch.importDate,
        expiryDate: activeBatch.expiryDate,
        
        // Trạng thái
        status,
        daysLeft
      },
      
      // Thông tin tổng hợp của tất cả lô
      summary: {
        totalInStock: totalInStock,
        totalSold: totalSold,
        totalBatches: allBatches.length
      }
    });

  } catch (error) {
    console.error('Error fetching latest batch info:', error);
    res.status(500).json({ 
      message: 'Lỗi lấy thông tin lô hàng mới nhất', 
      error: error.message 
    });
  }
};

// API để lấy range giá từ tất cả các lô còn hàng
exports.getPriceRange = async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({ message: 'Thiếu productId' });
    }

    // Lấy tất cả lô hàng còn hiệu lực
    const now = new Date();
    const validBatches = await ImportItem.find({ 
      product: productId,
      $or: [
        { expiryDate: null }, // Không có hạn sử dụng
        { expiryDate: { $gt: now } } // Còn hạn
      ]
    })
    .select('quantity damagedQuantity sellingPrice unitPrice importDate expiryDate')
    .lean();

    if (validBatches.length === 0) {
      // Trả về giá mặc định từ product thay vì 404
      const Product = require("../models/Product");
      const product = await Product.findById(productId).select('price').lean();
      
      if (product && product.price) {
        return res.json({
          minPrice: product.price,
          maxPrice: product.price,
          hasRange: false
        });
      }
      
      return res.json({ 
        minPrice: 0,
        maxPrice: 0,
        hasRange: false,
        message: 'Sản phẩm chưa có lô hàng'
      });
    }

    // Tính toán số lượng đã bán
    const Order = require("../models/Order");
  const orders = await Order.find({
    'items.product': productId,
    status: { $in: ['paid', 'completed', 'shipped', 'delivered'] }
  }).select('items').lean();    const totalSold = orders.reduce((sum, order) => {
      const productItems = order.items.filter(item => item.product.toString() === productId);
      return sum + productItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    // Sắp xếp theo FEFO
    validBatches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) {
        return new Date(a.importDate) - new Date(b.importDate);
      }
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

    // Tìm tất cả lô còn hàng và lấy giá
    const availablePrices = [];
    let remainingSold = totalSold;
    
    for (const batch of validBatches) {
      const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
      const soldFromThisBatch = Math.min(remainingSold, effectiveQty);
      const remainingInBatch = Math.max(0, effectiveQty - soldFromThisBatch);
      
      if (remainingInBatch > 0) {
        const price = batch.sellingPrice || batch.unitPrice;
        availablePrices.push(price);
      }
      
      remainingSold -= soldFromThisBatch;
    }

    if (availablePrices.length === 0) {
      // Không có lô nào còn hàng → trả về giá 0 để frontend ẩn giá và hiển thị "Tạm hết hàng"
      return res.json({ 
        minPrice: 0,
        maxPrice: 0,
        hasRange: false,
        message: 'Tạm hết hàng'
      });
    }

    // Tính min/max giá
    const minPrice = Math.min(...availablePrices);
    const maxPrice = Math.max(...availablePrices);
    
    res.json({
      minPrice: minPrice,
      maxPrice: maxPrice,
      hasRange: minPrice !== maxPrice,
      availablePrices: availablePrices.sort((a, b) => a - b)
    });
    
  } catch (error) {
    console.error('Error getting price range:', error);
    res.status(500).json({ message: 'Lỗi lấy thông tin giá', error: error.message });
  }
};

// Public API to get batch info for product detail page (no admin auth required)
exports.getPublicBatchesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({ message: 'Thiếu productId' });
    }

    // Lấy các ImportItem của sản phẩm cụ thể, chỉ lấy lô còn hiệu lực
    const now = new Date();
    const importItems = await ImportItem.find({ 
      product: productId,
      $or: [
        { expiryDate: null }, // Không có hạn sử dụng
        { expiryDate: { $gt: now } } // Còn hạn
      ]
    })
      .select('quantity damagedQuantity sellingPrice unitPrice importDate expiryDate')
      .sort({ createdAt: -1 })
      .lean();

    if (importItems.length === 0) {
      return res.json({
        batches: [],
        summary: {
          totalBatches: 0,
          totalInStock: 0,
          activeBatchId: null
        }
      });
    }

    // Lấy thông tin đơn hàng để tính số lượng đã bán (THỰC TẾ từ orders, không dùng soldQuantity cũ)
    const Order = require("../models/Order");
    const orders = await Order.find({ 
      'items.product': productId,
      status: { $in: ['paid', 'completed', 'shipped', 'delivered'] }
    }).select('items createdAt').lean();

    // Tính số lượng đã bán cho từng lô theo FEFO
    const batchSoldMap = {};
    importItems.forEach(batch => {
      batchSoldMap[batch._id.toString()] = 0;
    });

    // Tính tổng số lượng đã bán
    const totalSold = orders.reduce((sum, order) => {
      const productItems = order.items.filter(item => item.product.toString() === productId);
      return sum + productItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    // Sắp xếp lô theo FEFO để phân bổ số lượng đã bán
    const sortedForSoldCalc = [...importItems].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) {
        return new Date(a.importDate) - new Date(b.importDate);
      }
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      const expiryDiff = new Date(a.expiryDate) - new Date(b.expiryDate);
      if (expiryDiff === 0) {
        return new Date(a.importDate) - new Date(b.importDate);
      }
      return expiryDiff;
    });

    // Phân bổ số lượng đã bán theo FEFO
    let remainingSold = totalSold;
    for (const batch of sortedForSoldCalc) {
      if (remainingSold <= 0) break;
      const batchId = batch._id.toString();
      const effectiveQty = Math.max(0, (batch.quantity || 0) - (batch.damagedQuantity || 0));
      const soldFromThisBatch = Math.min(remainingSold, effectiveQty);
      batchSoldMap[batchId] = soldFromThisBatch;
      remainingSold -= soldFromThisBatch;
    }

    // Format dữ liệu để gửi về frontend - tính toán THỰC TẾ từ orders
    const batchDetails = importItems.map(item => {
      const batchId = item._id.toString();
      const soldQuantity = batchSoldMap[batchId] || 0;
      const damaged = item.damagedQuantity || 0;
      const remainingQuantity = Math.max(0, (item.quantity || 0) - soldQuantity - damaged);

      let daysLeft = null;
      if (item.expiryDate) {
        const expiryDate = new Date(item.expiryDate);
        daysLeft = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
      }

      return {
        _id: item._id,
        remainingQuantity: remainingQuantity,
        sellingPrice: item.sellingPrice || item.unitPrice,
        expiryDate: item.expiryDate,
        daysLeft: daysLeft
      };
    });

    // Sắp xếp theo FEFO
    batchDetails.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

    // Tính tổng số lượng trong kho
    const totalInStock = batchDetails.reduce((sum, batch) => sum + batch.remainingQuantity, 0);

    // Xác định lô đang được sử dụng (lô đầu tiên còn hàng)
    const activeBatch = batchDetails.find(batch => batch.remainingQuantity > 0);

    // Chỉ đếm các lô còn hàng (remainingQuantity > 0)
    const batchesWithStock = batchDetails.filter(batch => batch.remainingQuantity > 0);

    res.json({
      batches: batchDetails,
      summary: {
        totalBatches: batchesWithStock.length, // Chỉ đếm lô còn hàng
        totalInStock: totalInStock,
        activeBatchId: activeBatch ? activeBatch._id : null
      }
    });
  } catch (error) {
    console.error('Error fetching public batches by product:', error);
    res.status(500).json({ message: 'Lỗi lấy thông tin lô hàng', error: error.message });
  }
};

exports._updateProductStatus = updateProductStatus;
exports._upsertProductInventory = upsertProductInventory;
