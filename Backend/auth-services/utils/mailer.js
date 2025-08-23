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

module.exports = { sendVerificationMail, sendResetMail };
