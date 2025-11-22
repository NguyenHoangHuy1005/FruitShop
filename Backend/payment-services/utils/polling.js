/**
 * GIẢI PHÁP THAY THẾ: POLLING
 * Nếu không có webhook, dùng polling để check giao dịch ngân hàng
 */

const axios = require('axios');
const Order = require('../../product-services/models/Order');
const { createNotification } = require('../../auth-services/controllers/notificationController');

// Giả sử bạn có API để check giao dịch ngân hàng
// (SEPAY, Casso, hoặc bank API)
const BANK_API_URL = 'https://api.your-banking-service.com/transactions';
const BANK_API_KEY = process.env.SEPAY_API_KEY;

let lastCheckTime = Date.now();

async function checkBankTransactions() {
  try {
    console.log('[POLLING] Checking bank transactions...');
    
    // Gọi API lấy giao dịch mới
    const response = await axios.get(BANK_API_URL, {
      headers: {
        'Authorization': `Bearer ${BANK_API_KEY}`
      },
      params: {
        account_number: process.env.SEPAY_ACCOUNT_NO,
        from_date: new Date(lastCheckTime).toISOString(),
        transaction_type: 'in'
      }
    });

    const transactions = response.data.transactions || [];
    console.log(`[POLLING] Found ${transactions.length} new transactions`);

    for (const tx of transactions) {
      // Parse thông tin giao dịch
      const amount = tx.amount || tx.value || 0;
      const content = tx.description || tx.content || '';
      
      // Tìm order code trong content (VD: DH12345678)
      const codeMatch = content.match(/DH([A-F0-9]{8})/i);
      
      if (codeMatch) {
        const code = `DH${codeMatch[1].toUpperCase()}`;
        console.log(`[POLLING] Found code in transaction: ${code}`);
        
        // Tìm order
        const order = await Order.findOne({
          'paymentMeta.sepay.code': code,
          status: 'pending'
        });
        
        if (order) {
          // Kiểm tra amount
          const orderAmount = order.amount?.total || order.amount || 0;
          
          if (Math.abs(orderAmount - amount) <= 1) {
            // Cap nhat order thanh processing
            order.status = 'processing';
            order.paymentCompletedAt = new Date(tx.transaction_date || Date.now());
            order.paymentDeadline = null;
            order.autoConfirmAt = null;
            order.payment = {
              sepayId: tx.id || tx.transaction_id,
              gateway: tx.bank || 'MB',
              accountNumber: tx.account_number
            };
            
            await order.save();
            
            console.log(`[POLLING] Order ${order._id} moved to processing`);
            
            // Gửi thông báo cho user
            if (order.user) {
              const orderIdShort = String(order._id).slice(-8).toUpperCase();
              const totalAmount = (order.amount?.total || 0).toLocaleString('vi-VN');
              
              createNotification(
                order.user,
                "order_processing",
                "Thanh toán thành công",
                `Đơn hàng #${orderIdShort} đã xác nhận thanh toán. Tổng tiền: ${totalAmount}đ. Bạn có thể đánh giá sản phẩm sau khi nhận hàng!`,
                order._id,
                "/orders"
              ).catch(err => console.error("[notification] Failed to create order_processing notification:", err));
            }
            
            // TODO: Gửi email thông báo
          } else {
            console.log(`[POLLING] Amount mismatch: order=${orderAmount}, tx=${amount}`);
          }
        } else {
          console.log(`[POLLING] No matching order for code: ${code}`);
        }
      }
    }
    
    lastCheckTime = Date.now();
    
  } catch (error) {
    console.error('[POLLING] Error:', error.message);
  }
}

// Chạy mỗi 30 giây
const POLLING_INTERVAL = 30000; // 30 seconds

function startPolling() {
  console.log('[POLLING] Starting bank transaction polling...');
  console.log(`[POLLING] Interval: ${POLLING_INTERVAL / 1000} seconds`);
  
  // Chạy ngay lần đầu
  checkBankTransactions();
  
  // Sau đó chạy định kỳ
  setInterval(checkBankTransactions, POLLING_INTERVAL);
}

// Export để sử dụng trong server.js
module.exports = {
  startPolling,
  checkBankTransactions
};

/**
 * SỬ DỤNG:
 * 
 * Trong server.js, thêm:
 * 
 * const polling = require('./payment-services/utils/polling');
 * 
 * // Start polling khi server khởi động
 * polling.startPolling();
 */
