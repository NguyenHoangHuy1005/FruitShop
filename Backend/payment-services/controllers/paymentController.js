// payment-controller.js
const axios = require("axios");
const Order = require("../../product-services/models/Order");
const Stock = require("../../product-services/models/Stock");
const Product = require("../../admin-services/models/Product");
const { sendPaymentSuccessMail } = require("../../auth-services/utils/mailer");
const { _updateProductStatus } = require("../../product-services/controllers/stockController");

const SEPAY_API_KEY = process.env.SEPAY_API_KEY;
const SEPAY_BASE_URL = 'https://my.sepay.vn/userapi';

const sanitizeOrder = (orderDoc) => {
  if (!orderDoc) return null;
  const obj = typeof orderDoc.toObject === "function" ? orderDoc.toObject() : orderDoc;
  return {
    id: obj._id,
    status: obj.status,
    payment: obj.payment,
    amount: obj.amount,
    items: obj.items,
    customer: obj.customer,
    paymentDeadline: obj.paymentDeadline,
    paymentCompletedAt: obj.paymentCompletedAt,
    paymentMeta: obj.paymentMeta || {},
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

const restoreInventory = async (orderDoc) => {
  for (const it of orderDoc.items || []) {
    await Stock.findOneAndUpdate(
      { product: it.product },
      { $inc: { onHand: it.quantity } }
    );

    const stock = await Stock.findOne({ product: it.product }).lean();
    const newQty = Math.max(0, Number(stock?.onHand) || 0);
    
    // Sử dụng hàm cập nhật trạng thái mới với logic hết hạn
    await _updateProductStatus(it.product, newQty);
  }
};

const ensureNotExpired = async (orderDoc) => {
  if (!orderDoc || orderDoc.status !== "pending" || !orderDoc.paymentDeadline) {
    return { order: orderDoc, expired: false };
  }

  const deadline = new Date(orderDoc.paymentDeadline).getTime();
  if (Number.isNaN(deadline) || deadline > Date.now()) {
    return { order: orderDoc, expired: false };
  }

  await restoreInventory(orderDoc);
  orderDoc.status = "cancelled";
  orderDoc.paymentDeadline = null;
  orderDoc.paymentMeta = {
    ...(orderDoc.paymentMeta || {}),
    autoCancelledAt: new Date(),
    cancelReason: "timeout",
  };
  await orderDoc.save();
  return { order: orderDoc, expired: true };
};

async function registerWebhookWithSePay(webhookUrl) {
  try {
    const response = await axios.post(
      `${SEPAY_BASE_URL}/webhook/register`,
      { webhook_url: webhookUrl },
      {
        headers: {
          'Authorization': `Bearer ${SEPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('[SEPAY] Webhook registered:', response.data);
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error('[SEPAY] Webhook registration failed:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

async function createSePayQr(order) {
  const bankId = process.env.SEPAY_BANK_ID;
  const accountNo = process.env.SEPAY_ACCOUNT_NO; 
  const accountName = process.env.SEPAY_ACCOUNT_NAME;
  const template = process.env.SEPAY_QR_TEMPLATE || "compact2";

  const orderAmount = order.amount?.total || order.amount || 0;
  const transferContent = `DH${String(order._id).slice(-8).toUpperCase()}`;

  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${orderAmount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;

  return {
    qrUrl,
    qrCode: transferContent,
    code: transferContent,
    bankId,
    accountNo,
    accountName,
    amount: orderAmount,
    reference: transferContent,
  };
}
exports.createPaymentQr = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const orderDoc = await Order.findOne({ _id: id, user: userId });
    if (!orderDoc) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    const { order, expired } = await ensureNotExpired(orderDoc);
    if (expired) {
      return res.status(410).json({ message: "Đơn hàng đã hết hạn thanh toán.", order: sanitizeOrder(order) });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ message: "Đơn hàng không ở trạng thái chờ thanh toán." });
    }

    // Return existing QR if already created
    if (order.paymentMeta?.sepay?.qrUrl || order.paymentMeta?.sepay?.qrImage) {
      return res.json({
        ok: true,
        qr: order.paymentMeta.sepay.qrUrl || order.paymentMeta.sepay.qrImage,
        order: sanitizeOrder(order)
      });
    }

    // Create new QR
    let sepayResp;
    try {
      sepayResp = await createSePayQr(order);
    } catch (err) {
      console.error("[createPaymentQr] Error:", err.message);
      return res.status(502).json({ message: "Tạo QR thất bại." });
    }

    // Save QR info to order
    order.paymentMeta = {
      ...(order.paymentMeta || {}),
      sepay: {
        createdAt: new Date(),
        qrUrl: sepayResp.qrUrl,
        code: sepayResp.code,
        reference: sepayResp.reference,
        bankId: sepayResp.bankId,
        accountNo: sepayResp.accountNo,
        accountName: sepayResp.accountName,
        amount: sepayResp.amount,
      }
    };
    
    order.markModified("paymentMeta");
    await order.save();

    return res.json({
      ok: true,
      qr: sepayResp.qrUrl,
      order: sanitizeOrder(order)
    });
  } catch (err) {
    console.error("[createPaymentQr] Error:", err.message);
    return res.status(500).json({ message: "Không tạo được QR thanh toán." });
  }
};

/*---------- Webhook: SePay gọi tới đây ----------
//Quy trình thanh toán bằng QR Sepay + Ngrok:
Khách nhấn Thanh toán → Frontend gọi API tạo đơn.
Backend tạo đơn hàng với trạng thái pending, trừ tồn kho, tạo mã thanh
 toán kiểu DHxxxxxxx, sau đó sinh QR code theo số tiền và mã này.
Frontend hiển thị QR để khách hàng quét và chuyển khoản.
Đồng thời gửi kèm email xác nhận đơn hàng(Thông tin đơn hàng và QR code).
Khi ngân hàng nhận tiền, SePay tự phát hiện giao dịch, đọc nội dung
 chuyển khoản chứa mã DHxxxxxxx, và gửi webhook về server của mình.
Backend nhận webhook, tìm đơn theo mã DHxxxxxxx, kiểm tra:
Đơn còn pending không? Tiền chuyển vào hay chuyển ra?
Số tiền có đúng với đơn không?
Nếu hợp lệ → Cập nhật đơn thành Paid, lưu thông tin giao dịch, và gửi 
email xác nhận thanh toán thành công cho khách.
Backend trả lại SePay 200 OK để báo xử lý thành công.
*/
exports.handleSePayWebhook = async (req, res) => {
  try {
    console.log('[SEPAY WEBHOOK] Received webhook request');

    // === Parse payload ===
    let payload = null;
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      payload = req.body;
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      try {
        payload = JSON.parse(req.body);
      } catch (e) {
        console.error('[SEPAY WEBHOOK] Invalid JSON:', e.message);
        return res.status(400).json({ ok: false, msg: 'invalid_json', error: e.message });
      }
    } else {
      console.error('[SEPAY WEBHOOK] Empty body');
      return res.status(400).json({ ok: false, msg: 'empty_body' });
    }

    // === Authorization (Optional - SEPAY may not send header) ===
    const authHeader = (req.header('Authorization') || '').toString();
    
    if (authHeader && authHeader.startsWith('Apikey ')) {
      const apikey = authHeader.replace('Apikey ', '').trim();
      const expectedKey = process.env.SEPAY_WEBHOOK_APIKEY;
      
      if (expectedKey && apikey !== expectedKey) {
        console.error('[SEPAY WEBHOOK] Invalid apikey');
        return res.status(403).json({ ok: false, msg: 'invalid_apikey' });
      }
    } else {
      // Validate payload structure if no Authorization header
      if (!payload.id && !payload.transferAmount && !payload.description) {
        console.error('[SEPAY WEBHOOK] Invalid payload structure');
        return res.status(400).json({ ok: false, msg: 'invalid_payload' });
      }
    }

    // === Normalize payload fields ===
    const sepayId = payload.id || payload.transactionId || payload.txId || null;

    let transferAmount = null;
    if (payload.transferAmount != null) {
      transferAmount = payload.transferAmount;
    } else if (payload.amount != null && typeof payload.amount === 'number') {
      transferAmount = payload.amount;
    } else if (payload.amount != null && typeof payload.amount === 'object') {
      transferAmount = payload.amount.subtotal ?? payload.amount.total ?? payload.amount.value ?? null;
    } else if (payload.value != null) {
      transferAmount = payload.value;
    }

    transferAmount = Number(transferAmount ?? 0);
    const transferType = (payload.transferType || payload.type || 'in').toString().toLowerCase();
    
    // Extract code from payload
    let code = payload.code || null;
    const content = payload.content || payload.description || payload.note || '';
    
    if (!code && content) {
      // Pattern: DH + 8 hex characters (e.g., DH350410F6)
      const codeMatch = content.match(/DH([A-F0-9]{8})/i);
      if (codeMatch) {
        code = `DH${codeMatch[1].toUpperCase()}`;
      }
    }
    
    const referenceCode = payload.referenceCode || payload.reference || payload.ref || null;

    console.log('[SEPAY WEBHOOK] Processed:', { code, transferAmount, transferType });

    // === Find order ===
    let order = null;
    
    if (code) {
      order = await Order.findOne({ 'paymentMeta.sepay.code': code });
    }
    
    if (!order && referenceCode) {
      order = await Order.findOne({ 'paymentMeta.sepay.reference': referenceCode });
    }
    
    if (!order && content) {
      const pendings = await Order.find({ status: 'pending' }).select('_id').lean();
      for (const p of pendings) {
        const orderId = p._id.toString();
        if (content.includes(orderId) || content.toUpperCase().includes(orderId.slice(-8).toUpperCase())) {
          order = await Order.findById(p._id);
          break;
        }
      }
    }
    
    if (!order && transferAmount > 0) {
      order = await Order.findOne({
        status: 'pending',
        $or: [
          { 'amount.total': transferAmount },
          { 'amount.subtotal': transferAmount },
          { 'amount': transferAmount }
        ]
      }).sort({ createdAt: 1 });
    }

    if (!order) {
      console.log('[SEPAY WEBHOOK] No matching order found');
      return res.status(200).json({ ok: false, msg: 'no_matching_order' });
    }

    console.log('[SEPAY WEBHOOK] Order found:', order._id);

    // === Validate order status and transfer type ===
    if (order.status === 'paid') {
      console.log('[SEPAY WEBHOOK] Order already paid:', order._id);
      return res.status(200).json({ ok: true, msg: 'already_paid' });
    }
    
    if (transferType !== 'in') {
      console.log('[SEPAY WEBHOOK] Not an incoming transfer');
      return res.status(200).json({ ok: false, msg: 'not_incoming' });
    }

    // === Validate amount ===
    const orderAmountRaw = (order.amount && typeof order.amount === 'object')
      ? (order.amount.total ?? order.amount.subtotal ?? order.amount.value ?? 0)
      : (order.amount ?? 0);
    const orderTotal = Number(orderAmountRaw);

    if (Math.abs(orderTotal - transferAmount) > 1) {
      console.log('[SEPAY WEBHOOK] Amount mismatch - Expected:', orderTotal, 'Received:', transferAmount);
      return res.status(200).json({ ok: false, msg: 'amount_mismatch', orderTotal, transferAmount });
    }

        // === Mark order as paid ===
    order.status = 'paid';
    order.paymentCompletedAt = new Date();
    order.payment = {
      sepayId,
      gateway: payload.bank || payload.gateway || 'SEPAY',
      accountNumber: payload.accountNumber || payload.acc || null
    };
    order.paymentMeta = order.paymentMeta || {};
    order.paymentMeta.sepay = {
      ...(order.paymentMeta.sepay || {}),
      code: code || order.paymentMeta.sepay?.code,
      reference: referenceCode || order.paymentMeta.sepay?.reference,
      transferAmount,
      lastWebhook: payload,
      processedAt: new Date()
    };
    order.paymentMeta.transactionId = sepayId || order.paymentMeta.transactionId;

    try {
      order.markModified('paymentMeta');
      order.markModified('payment');
      await order.save();
      console.log('[SEPAY WEBHOOK] Order saved successfully');
    } catch (saveErr) {
      console.error('[SEPAY WEBHOOK] Failed to save order:', saveErr.message);
      return res.status(500).json({ ok: false, msg: 'save_failed', error: saveErr.message });
    }

    console.log('[SEPAY WEBHOOK] Order marked as paid:', order._id);

    // Gửi thông báo cho user về thanh toán thành công
    if (order.user) {
      const orderIdShort = String(order._id).slice(-8).toUpperCase();
      const totalAmount = (order.amount?.total || 0).toLocaleString('vi-VN');
      
      createNotification(
        order.user,
        "order_paid",
        "Thanh toán thành công",
        `Đơn hàng #${orderIdShort} đã được thanh toán thành công. Tổng tiền: ${totalAmount}đ. Bạn có thể đánh giá sản phẩm sau khi nhận hàng!`,
        order._id,
        "/orders"
      ).catch(err => console.error("[notification] Failed to create order_paid notification:", err));
    }

    // Send email notification
    try {
      const customerEmail = order.customer?.email;
      
      if (customerEmail) {
        const orderPayload = {
          id: order._id,
          paymentCompletedAt: order.paymentCompletedAt,
          items: order.items || [],
          amount: order.amount || {},
          couponCode: order.couponCode || "",
          customer: order.customer || {},
          payment: {
            ...order.payment,
            qrCode: order.paymentMeta?.sepay?.qrUrl || order.payment?.qrCode,
          },
        };

        await sendPaymentSuccessMail(
          customerEmail,
          order.customer?.name || "Khách hàng",
          orderPayload
        );
        
        console.log('[SEPAY WEBHOOK] Email sent successfully to:', customerEmail);
      }
    } catch (mailErr) {
      console.error('[SEPAY WEBHOOK] Failed to send email:', mailErr.message);
    }

    return res.status(200).json({ ok: true, msg: 'success', orderId: order._id });

  } catch (err) {
    console.error('[SEPAY WEBHOOK] Error:', err);
    return res.status(500).json({ ok: false, msg: 'internal_error', error: err.message });
  }
};

// ---------- existing endpoints (kept and minimally adjusted) ----------
exports.getPaymentSession = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const orderDoc = await Order.findOne({ _id: id, user: userId });
    if (!orderDoc) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng cần thanh toán." });
    }

    const { order, expired } = await ensureNotExpired(orderDoc);
    const now = Date.now();
    const deadline = order.paymentDeadline ? new Date(order.paymentDeadline).getTime() : null;
    const remainingMs = order.status === "pending" && deadline
      ? Math.max(0, deadline - now)
      : 0;

    return res.json({
      ok: true,
      order: sanitizeOrder(order),
      remainingMs,
      expired,
    });
  } catch (err) {
    console.error("[payment] getPaymentSession error:", err);
    return res.status(500).json({ message: "Không lấy được thông tin thanh toán." });
  }
};

exports.cancelPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const orderDoc = await Order.findOne({ _id: id, user: userId });
    if (!orderDoc) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng cần hủy." });
    }

    if (orderDoc.status === "cancelled") {
      return res.json({ ok: true, order: sanitizeOrder(orderDoc) });
    }

    const { order, expired } = await ensureNotExpired(orderDoc);
    if (expired) {
      return res.json({ ok: true, order: sanitizeOrder(order) });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ message: "Đơn hàng không thể hủy ở trạng thái hiện tại." });
    }

    await restoreInventory(order);
    order.status = "cancelled";
    order.paymentDeadline = null;
    order.paymentMeta = {
      ...(order.paymentMeta || {}),
      cancelledAt: new Date(),
      cancelReason: req.body?.reason || "user_cancelled",
    };
    await order.save();

    return res.json({ ok: true, order: sanitizeOrder(order) });
  } catch (err) {
    console.error("[payment] cancelPayment error:", err);
    return res.status(500).json({ message: "Không thể hủy thanh toán." });
  }
};
