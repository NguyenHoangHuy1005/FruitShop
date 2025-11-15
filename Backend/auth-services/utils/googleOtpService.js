const crypto = require("crypto");
const { sendGoogleOtpMail } = require("./mailer");

const generateOtp = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp).trim()).digest("hex");

async function sendOtpEmail(email, otp) {
    return sendGoogleOtpMail(email, otp);
}

module.exports = {
    generateOtp,
    hashOtp,
    sendOtpEmail,
};
