const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
    if (transporter) return transporter;

    const port = Number(process.env.MAIL_PORT || 587);
    const secure =
        String(process.env.MAIL_SECURE || "").toLowerCase() === "true" || port === 465;

    transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port,
        secure,
        auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
        },
    });

    transporter
        .verify()
        .then(() => {
        console.log("[mailer] SMTP ready:", process.env.MAIL_HOST, process.env.MAIL_USER);
        })
        .catch((err) => {
        console.error("[mailer] verify failed:", err && err.message ? err.message : err);
        });

    return transporter;
}

async function sendVerificationMail(email, name, token) {
    try {
        const t = getTransporter();
        const from = process.env.MAIL_FROM || process.env.MAIL_USER;
        const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Xin chào ${name || "bạn"},</h2>
            <p>Mã xác minh tài khoản của bạn:</p>
            <p style="font-size:24px;font-weight:bold;letter-spacing:2px">${token}</p>
            <p>Mã có hiệu lực <b>10 phút</b>. Nếu không phải bạn, hãy bỏ qua email.</p>
            <hr/><small>Hệ thống</small>
        </div>
        `;
        const info = await t.sendMail({
        from,
        to: email,
        subject: "Mã xác minh tài khoản",
        html,
        });
        console.log("[mailer] verify messageId:", info.messageId);
        return true;
    } catch (e) {
        console.error("sendVerificationMail error:", e && e.message ? e.message : e);
        return false;
    }
}

async function sendResetMail(toEmail, toName, token) {
    try {
        const t = getTransporter();
        const from = process.env.MAIL_FROM || process.env.MAIL_USER;
        const subject = "Đặt lại mật khẩu - Mã xác nhận";
        const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
            <p>Xin chào ${toName || ""},</p>
            <p>Mã đặt lại mật khẩu của bạn là: <b style="font-size:18px">${token}</b></p>
            <p>Mã sẽ hết hạn sau 10 phút.</p>
        </div>
        `;
        const info = await t.sendMail({ from, to: toEmail, subject, html });
        console.log("[mailer] reset messageId:", info.messageId);
        return true;
    } catch (e) {
        console.error("sendResetMail error:", e && e.message ? e.message : e);
        return false;
    }
}
// ==== Helpers ====
const formatVND = (n) =>
    (Number(n) || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

    const shortId = (id) => {
    try { return String(id).slice(-6).toUpperCase(); } catch { return ""; }
};

// ==== Gửi mail xác nhận đơn hàng ====
async function sendOrderConfirmationMail(toEmail, toName, orderPayload, opts = {}) {
    try {
        const t = getTransporter();
        const from = process.env.MAIL_FROM || process.env.MAIL_USER;

        const shopName = opts.shopName || process.env.SHOP_NAME || "FruitShop";
        const supportEmail = opts.supportEmail || process.env.SHOP_SUPPORT_EMAIL || from;
        const baseUrl = opts.baseUrl || process.env.APP_BASE_URL || "";

        const {
        id, // order._id
        createdAt,
        items = [],
        amount = {}, // { subtotal, shipping, discount, total, totalItems }
        couponCode = "",
        customer = {}, // { name, address, phone, email, note }
        } = orderPayload || {};

        const rows = items.map((it) => `
        <tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${it.name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatVND(it.price)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatVND(it.total)}</td>
        </tr>
        `).join("");

        const orderUrl = baseUrl ? `${baseUrl}/orders/${id}` : null;
        const subject = `[${shopName}] Xác nhận đơn hàng #${shortId(id)}`;

        const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2 style="margin:0 0 12px">${shopName} – Xác nhận đơn hàng</h2>
            <p>Xin chào ${toName || "bạn"}, cảm ơn bạn đã đặt hàng tại ${shopName}.</p>

            <p><b>Mã đơn:</b> #${shortId(id)}<br/>
            <b>Thời gian:</b> ${new Date(createdAt || Date.now()).toLocaleString("vi-VN")}<br/>
            ${orderUrl ? `<b>Chi tiết đơn:</b> <a href="${orderUrl}">${orderUrl}</a><br/>` : ""}
            </p>

            <h3 style="margin:16px 0 8px">Thông tin nhận hàng</h3>
            <p style="margin:0">
            <b>Người nhận:</b> ${customer?.name || toName || ""}<br/>
            <b>Điện thoại:</b> ${customer?.phone || ""}<br/>
            <b>Địa chỉ:</b> ${customer?.address || ""}<br/>
            ${customer?.note ? `<b>Ghi chú:</b> ${customer.note}<br/>` : ""}
            </p>

            <h3 style="margin:16px 0 8px">Sản phẩm</h3>
            <table style="width:100%;border-collapse:collapse">
            <thead>
                <tr style="background:#f7f7f7">
                <th style="padding:8px;text-align:left">Sản phẩm</th>
                <th style="padding:8px;text-align:center">SL</th>
                <th style="padding:8px;text-align:right">Đơn giá</th>
                <th style="padding:8px;text-align:right">Thành tiền</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr>
                <td colspan="3" style="padding:8px;text-align:right"><b>Tạm tính:</b></td>
                <td style="padding:8px;text-align:right">${formatVND(amount.subtotal)}</td>
                </tr>
                ${amount.discount ? `
                <tr>
                <td colspan="3" style="padding:8px;text-align:right">
                    <b>Giảm giá${couponCode ? ` (${couponCode})` : ""}:</b>
                </td>
                <td style="padding:8px;text-align:right">- ${formatVND(amount.discount)}</td>
                </tr>` : ""}
                <tr>
                <td colspan="3" style="padding:8px;text-align:right"><b>Phí vận chuyển:</b></td>
                <td style="padding:8px;text-align:right">${formatVND(amount.shipping)}</td>
                </tr>
                <tr>
                <td colspan="3" style="padding:8px;text-align:right;font-size:16px"><b>Tổng cộng:</b></td>
                <td style="padding:8px;text-align:right;font-size:16px"><b>${formatVND(amount.total)}</b></td>
                </tr>
            </tfoot>
            </table>

            <p style="margin-top:16px">Nếu cần hỗ trợ, vui lòng liên hệ: <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <small>Đây là email tự động, vui lòng không trả lời trực tiếp.</small>
        </div>
        `;

        const info = await t.sendMail({
        from,
        to: toEmail,
        subject,
        html,
        });
        console.log("[mailer] order confirmation messageId:", info.messageId);
        return true;
    } catch (e) {
        console.error("sendOrderConfirmationMail error:", e && e.message ? e.message : e);
        return false;
    }
}

module.exports = { getTransporter,sendVerificationMail, sendResetMail,sendOrderConfirmationMail, };
