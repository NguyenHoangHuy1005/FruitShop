const axios = require("axios");

const TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

async function verifyGoogleToken(idToken) {
    const token = String(idToken || "").trim();
    if (!token) {
        const err = new Error("missing credential");
        err.status = 400;
        throw err;
    }

    try {
        const res = await axios.get(TOKENINFO_ENDPOINT, {
        params: { id_token: token },
        timeout: 5000,
        });

        const data = res?.data || {};
        if (!data.email) {
        const err = new Error("email không đúng hoặc chưa đăng ký");
        err.status = 400;
        throw err;
        }

        if (process.env.GOOGLE_CLIENT_ID && data.aud && data.aud !== process.env.GOOGLE_CLIENT_ID) {
        const err = new Error("token không hợp lệ");
        err.status = 400;
        throw err;
        }

        if (String(data.email_verified) === "false") {
        const err = new Error("google chưa xác minh email");
        err.status = 400;
        throw err;
        }

        return {
        email: normalizeEmail(data.email),
        name: data.name || "",
        picture: data.picture || "",
        sub: data.sub || "",
        };
    } catch (error) {
        if (error?.response?.data?.error_description) {
        const err = new Error(error.response.data.error_description);
        err.status = 400;
        throw err;
        }
        if (error?.status) throw error;
        const err = new Error("xác minh google thất bại");
        err.status = 400;
        throw err;
    }
}

module.exports = {
    verifyGoogleToken,
};
