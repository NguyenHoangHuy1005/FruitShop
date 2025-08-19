const nodemailer = require("nodemailer");

let transporter;
function getTransporter() {
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT || 587),
        secure: false,
        auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
        },
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
        await t.sendMail({ from, to: email, subject: "Mã xác minh tài khoản", html });
        return true;
    } catch (e) {
        console.error("sendVerificationMail error:", e.message);
        return false;
    }
}

module.exports = { sendVerificationMail };
