import axios from 'axios';
import { ROUTERS } from "../../utils/router";
import { toast } from "react-toastify";
import {
    loginFailure, loginStart, loginSuccess,
    registerFailure, registerStart, registerSuccess,
    logoutStart, logoutSuccess,
    verifyStart, verifySuccess, verifyFailure,
    setPendingEmail
} from './authSlice';
import {
    updateUserSuccess, updateUserStart, updateUserFailure,
    deleteUserFailure, deleteUserStart, deleteUserSuccess,
    getUserFailure, getUsersSuccess, getUserStart
} from './userSlice';
import {
    createProductStart, createProductSuccess, createProductFailure,
    getProductStart, getProductSuccess, getProductFailure,
    deleteProductStart, deleteProductSuccess, deleteProductFailure,
    updateProductStart, updateProductSuccess, updateProductFailure
} from './productSlice';

import { cartStart, cartSuccess, cartFailure } from "./cartSlice";
// Tạo axios instance để dễ đổi baseURL / bật cookie
const API = axios.create({
    baseURL: import.meta?.env?.VITE_API_BASE || "http://localhost:3000/api",
    withCredentials: true,
});

// Export nếu nơi khác cần dùng trực tiếp
export { API };


const getPendingEmail = () =>
    (localStorage.getItem("PENDING_EMAIL") || "").trim().toLowerCase();
/* ========= AUTH HELPERS (silent refresh) ========= */
// Cố gắng lấy/đảm bảo accessToken: nếu có sẵn thì dùng, nếu chưa có thì gọi /auth/refresh
// apiRequest.js (trước ensureAccessToken)
const HAS_REFRESH_KEY = "HAS_REFRESH";

const markHasRefresh = () => { try { localStorage.setItem(HAS_REFRESH_KEY, "1"); } catch {} };
const clearHasRefresh = () => { try { localStorage.removeItem(HAS_REFRESH_KEY); } catch {} };
const maybeHasRefresh = () => (localStorage.getItem(HAS_REFRESH_KEY) === "1");

// ensureAccessToken
export const ensureAccessToken = async (maybeToken, dispatch, navigate, isAdmin = false) => {
    if (maybeToken) return maybeToken;

    // ⛳️ Không thử refresh nếu ta biết chắc chưa đăng nhập
    if (!maybeHasRefresh()) return null;

    try {
        const r = await API.post("/auth/refresh", null, {
        validateStatus: () => true,
        withCredentials: true,
        });
        if (r.status === 200 && r.data?.accessToken) {
        const t = r.data.accessToken;
        API.defaults.headers.common.Authorization = `Bearer ${t}`;
        markHasRefresh();
        return t;
        }
    } catch (e) {
        console.error("ensureAccessToken refresh fail:", e.message);
    }

    // ❌ refresh fail → đừng điều hướng khi gọi “âm thầm”
    dispatch?.({ type: "auth/logoutSuccess" });
    clearHasRefresh();
    return null;
};



/* ======================= AUTH ======================= */

export const loginUser = async (user, dispatch, navigate) => {
    dispatch(loginStart());
    try {
        const res = await API.post("/auth/login", user);
        dispatch(loginSuccess(res.data));

        // Gắn Authorization cho mọi request tiếp theo
        if (res.data?.accessToken) {
            API.defaults.headers.common.Authorization = `Bearer ${res.data.accessToken}`;
        }
        markHasRefresh();

        //  sync giỏ
        if (res.data?.cart) {
            const { items = [], summary = { totalItems: 0, subtotal: 0 } } = res.data.cart;
            dispatch(cartSuccess({ items, summary }));
        } else {
            await ensureCart(dispatch); // fallback
        }


        const msg = res?.data?.message || "Đăng nhập thành công!";
        alert(msg);

        if (res.data.admin === true) {
            navigate(ROUTERS.ADMIN?.DASHBOARD || "/admin/dashboard");
        } else {
            navigate("/");
        }
    } catch (error) {
        if (error?.response?.status === 403 && error?.response?.data?.pendingEmail) {
            const pending = error.response.data.pendingEmail;
            localStorage.setItem("PENDING_EMAIL", pending);
            dispatch(setPendingEmail(pending));
            alert("Tài khoản chưa xác minh. Vui lòng nhập mã OTP.");
            navigate(ROUTERS.ADMIN?.AUTH || "/admin/auth");
            return;
        }
        const errMsg = error?.response?.data?.message || "Đăng nhập thất bại!";
        alert(errMsg);
        dispatch(loginFailure());
    }
};

export const registerUser = async (user, dispatch, navigate) => {
    dispatch(registerStart());
    try {
        // BẮT BUỘC gửi kèm password_confirm để backend validate
        const payload = {
            email: user.email,
            username: user.username,
            password: user.password,
            password_confirm: user.password_confirm ?? user.password, // fallback nếu bạn chưa set ở FE
            phone: user.phone,
        };

        const res = await API.post("/auth/register", payload);
        console.log("REGISTER RES:", res.data);
        dispatch(registerSuccess());

        const pending = res.data?.pendingEmail;
        if (pending) {
            localStorage.setItem("PENDING_EMAIL", pending);
            dispatch(setPendingEmail(pending));
            alert(res.data?.message || "Đăng ký thành công! Vui lòng kiểm tra email để lấy mã xác minh.");
            navigate(ROUTERS.ADMIN?.AUTH || "/admin/auth");
        } else {
            alert("Đăng ký thành công!");
            navigate(ROUTERS.ADMIN?.LOGIN || "/admin/login");
        }
    } catch (error) {
        const msg = error?.response?.data?.message || "Đăng ký thất bại!";
        alert(msg);
        dispatch(registerFailure());
    }
};

// Xác minh OTP
// Xác minh OTP (luôn dùng email đã lưu)
export const verifyAccount = async ({ token }, dispatch) => {
    dispatch(verifyStart());
    try {
        const email = getPendingEmail();
        const code = String(token || "").trim(); // giữ '0' đầu
        if (!email) {
            dispatch(verifyFailure());
            return { ok: false, message: "Thiếu email cần xác minh." };
        }
        if (!/^\d{6}$/.test(code)) {
            dispatch(verifyFailure());
            return { ok: false, message: "Mã OTP phải gồm 6 chữ số." };
        }

        // debug nhẹ (có thể bỏ sau)
        console.log("[VERIFY] payload:", { email, token: code });

        await API.post("/auth/verify", { email, token: code });
        dispatch(verifySuccess());
        return { ok: true };
    } catch (error) {
        const message = error?.response?.data?.message || "Xác minh thất bại!";
        dispatch(verifyFailure());
        return { ok: false, message };
    }
};


// Gửi lại mã
// Gửi lại mã (đọc email từ localStorage nếu param trống)
export const resendCode = async (email, dispatch) => {
    try {
        const mail = (email || getPendingEmail());
        if (!mail) { alert("Thiếu email để gửi lại mã."); return false; }

        const res = await API.post("/auth/verify/resend", { email: mail });
        const pending = res.data?.pendingEmail;
        if (pending) {
            localStorage.setItem("PENDING_EMAIL", pending);
            dispatch(setPendingEmail(pending));
        }
        alert(res.data?.message || "Đã gửi lại mã.");
        return true;
    } catch (error) {
        const msg = error?.response?.data?.message || "Gửi lại mã thất bại!";
        alert(msg);
        return false;
    }
};

// LOGOUT
export const logout = async (dispatch, navigate, accessToken, id) => {
    dispatch(logoutStart());
    let ok = true;

    try {
        await API.post(
            "/auth/logout",
            { id },
            {
                headers: { Authorization: `Bearer ${accessToken}` }, // dùng Authorization thay vì token
                withCredentials: true,
            }
        );
    } catch (error) {
        ok = false;
        console.error("Logout error:", error?.response?.data || error?.message);
    } finally {
        // Dọn client triệt để
        try { localStorage.clear(); } catch (error) { console.warn("Clear localStorage fail:", error); }
        try { sessionStorage.clear(); } catch (error) { console.warn("Clear sessionStorage fail:", error); }
        clearHasRefresh();
        try {
            delete API.defaults.headers.common.Authorization;
            delete API.defaults.headers.common.token;
        } catch (error) { console.warn("Clear API headers fail:", error); }

        dispatch(logoutSuccess());
        await ensureCart(dispatch);  // gọi lại API /cart → Redux.cart sẽ về giỏ guest (trống)

        alert(ok ? "Đăng xuất thành công!" : "Đăng xuất cục bộ (server có thể chưa thu hồi token).");
        navigate("/", { replace: true });
    }
};




// === FORGOT PASSWORD: gửi mã (OTP) ===
export const requestPasswordReset = async (email) => {
    try {
        const res = await API.post("/auth/password/forgot", { email });
        return { ok: true, data: res.data };
    } catch (e) {
        const err = e?.response?.data || { message: e.message };
        return { ok: false, error: err };
    }
};

// === RESET PASSWORD ===
export const resetPassword = async (payload) => {
    try {
        const res = await API.post("/auth/password/reset", payload);
        const data = res.data;
        // ✅ Trả error khi BE trả ok:false (vẫn HTTP 200)
        if (!data?.ok) {
            return { ok: false, error: data || { code: "UNKNOWN", message: "Đổi mật khẩu thất bại." } };
        }
        return { ok: true, data };
    } catch (e) {
        const d = e?.response?.data;
        const err = typeof d === "string"
            ? { code: "HTTP_ERROR", message: d }
            : (d || { code: "HTTP_ERROR", message: e.message });
        return { ok: false, error: err };
    }
};



/* ======================= USER ======================= */

export const getAllUsers = async (accessToken, dispatch) => {
    dispatch(getUserStart());
    try {
        const res = await API.get("/user", {
            headers: { token: `Bearer ${accessToken}` },
        });

        // Lọc bỏ user có admin = true
        const filteredUsers = Array.isArray(res.data)
            ? res.data.filter((u) => u.admin !== true)
            : [];

        dispatch(getUsersSuccess(filteredUsers));
    } catch (error) {
        console.error("Get all users error:", error?.response?.data || error.message);
        dispatch(getUserFailure());
    }
};


export const deleteUser = async (accessToken, dispatch, id) => {
    dispatch(deleteUserStart());
    try {
        const res = await API.delete(`/user/${id}`, {
            headers: { token: `Bearer ${accessToken}` },
        });
        dispatch(deleteUserSuccess(res.data));
        alert("Xóa người dùng thành công!");
        await getAllUsers(accessToken, dispatch);
    } catch (err) {
        dispatch(deleteUserFailure(err?.response?.data));
        alert("Xóa người dùng thất bại!");
    }
};

export const updateUser = async (id, updatedUser, accessToken, dispatch) => {
    dispatch(updateUserStart());
    try {
        const res = await API.put(`/user/${id}`, updatedUser, {
            headers: { token: `Bearer ${accessToken}` },
        });
        dispatch(updateUserSuccess(res.data));
        alert("Cập nhật thành công!");
        await getAllUsers(accessToken, dispatch);
    } catch (err) {
        dispatch(updateUserFailure(err?.response?.data));
        alert("Cập nhật thất bại!");
    }
};

/* ======================= PRODUCT ======================= */

export const createProduct = async (product, dispatch) => {
    dispatch(createProductStart());
    try {
        const res = await API.post("/product/create", product);
        dispatch(createProductSuccess(res.data));
        await getAllProduct(dispatch);
        alert("Tạo sản phẩm thành công!");
    } catch (error) {
        console.error("Create product error:", error?.response?.data || error);
        dispatch(createProductFailure());
        alert("Tạo sản phẩm thất bại!");
    }
};

export const getAllProduct = async (dispatch) => {
    dispatch(getProductStart());
    try {
        const res = await API.get("/product");
        dispatch(getProductSuccess(res.data));
    } catch (error) {
        console.error("Get product error:", error?.response?.data || error);
        dispatch(getProductFailure());
    }
};

export const updateProduct = async (id, product, dispatch) => {
    dispatch(updateProductStart());
    try {
        const res = await API.put(`/product/${id}`, product);
        dispatch(updateProductSuccess(res.data));
        // 🔥 đảm bảo UI đồng bộ với DB
        await getAllProduct(dispatch);
        alert("Cập nhật sản phẩm thành công!");
    } catch (err) {
        console.error(err);
        dispatch(updateProductFailure());
        alert("Cập nhật thất bại!");
    }
};


export const deleteProduct = async (id, dispatch) => {
    dispatch(deleteProductStart());
    try {
        await API.delete(`/product/${id}`);
        dispatch(deleteProductSuccess(id));
        await getAllProduct(dispatch);
        alert("Xóa sản phẩm thành công!");
    } catch (err) {
        console.error(err);
        dispatch(deleteProductFailure());
    }
};


/* ======================= CART (AJAX) ======================= */
// Tạo/lấy giỏ theo cookie CART_ID
export const ensureCart = async (dispatch) => {
    dispatch(cartStart());
    try {
        const res = await API.get("/cart"); // BE: app.use("/api/cart", cartRoutes)
        dispatch(cartSuccess(res.data));
    } catch (e) {
        dispatch(cartFailure(e?.response?.data || e.message));
    }
};

// Thêm SP vào giỏ
export const addToCart = async (productId, quantity = 1, dispatch) => {
    dispatch(cartStart());
    try {
        const res = await API.post("/cart/add", { productId, quantity });
        dispatch(cartSuccess(res.data));
        toast.success("🛒 Đã thêm sản phẩm vào giỏ!", {
            position: "top-right",
            style: { background: "#008874", color: "#fff", fontWeight: "600" },
        });
    } catch (e) {
        dispatch(cartFailure(e?.response?.data || e.message));
        toast.error(e?.response?.data?.message || "❌ Thêm giỏ thất bại!", {
            position: "top-right",
            style: { background: "#ff4d4f", color: "#fff", fontWeight: "600" },
        });
    }
};


// Cập nhật số lượng 1 item (theo productId)
// CHO PHÉP qty = 0 (BE của bạn xóa item khi qty = 0)
export const updateCartItem = async (productId, quantity, dispatch) => {
    dispatch(cartStart());
    try {
        if (!productId) throw new Error("Thiếu productId");

        // Chuẩn hoá số lượng: số nguyên, không âm
        const qty = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;

        // Lấy URL cuối cùng để debug (không gửi request)
        const url = API.getUri({ url: `/cart/item/${productId}` });
        // Log trước khi bắn request để bạn thấy URL/Body
        console.log("PUT", url, { quantity: qty });

        // Dùng validateStatus để tự xử lý 4xx, tránh Axios ném lỗi mù
        const res = await API.put(
            `/cart/item/${productId}`,
            { quantity: qty },
            { validateStatus: () => true }
        );

        if (res.status >= 200 && res.status < 300) {
            dispatch(cartSuccess(res.data));
            return;
        }

        // 4xx/5xx: hiện thông điệp rõ ràng
        const msg = res?.data?.message || `HTTP ${res.status} tại ${url}`;
        console.error("updateCartItem FAIL ->", { status: res.status, data: res.data, url });
        dispatch(cartFailure(msg));
        alert(msg);
    } catch (e) {
        const url = API.getUri({ url: `/cart/item/${productId}` });
        console.error("updateCartItem NETWORK ERROR ->", { url, error: e });
        const msg = e?.response?.data?.message || e?.message || "Lỗi mạng khi cập nhật giỏ!";
        dispatch(cartFailure(msg));
        alert(msg);
    }
};



// Xóa 1 item khỏi giỏ
export const removeCartItem = async (productId, dispatch) => {
    dispatch(cartStart());
    try {
        const res = await API.delete(`/cart/item/${productId}`);
        dispatch(cartSuccess(res.data));
    } catch (e) {
        dispatch(cartFailure(e?.response?.data || e.message));
        alert(e?.response?.data?.message || "Xóa sản phẩm thất bại!");
    }
};

// Xóa toàn bộ giỏ
export const clearCart = async (dispatch) => {
    dispatch(cartStart());
    try {
        const res = await API.delete("/cart");
        dispatch(cartSuccess(res.data));
    } catch (e) {
        dispatch(cartFailure(e?.response?.data || e.message));
    }
};

/* ======================= ORDER (Checkout) ======================= */
// Lưu đơn hàng (MongoDB) từ giỏ hiện tại  thông tin form
export const placeOrder = async (payload, accessToken, dispatch) => {
    // payload: { fullName, address, phone, email, note }
    try {
        const res = await API.post("/order", payload, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        // Nếu đơn yêu cầu thanh toán online, không hiển thị thông báo "Đặt hàng thành công"
        // vì khách hàng cần hoàn tất thanh toán trên trang thanh toán.
        const msg = res?.data?.message || "Đặt hàng thành công!";
        if (!res?.data?.requiresPayment) {
            alert(msg);
        }
        // BE thường clear cart sau khi tạo order → làm mới cart:
        await ensureCart(dispatch);
        return res.data;
    } catch (e) {
        const msg = e?.response?.data?.message || "Đặt hàng thất bại!";
        alert(msg);
        return null;
    }
};

const buildAuthError = () => {
    const err = new Error("AUTH_REQUIRED");
    err.code = "AUTH_REQUIRED";
    return err;
};

export const fetchPaymentSession = async (orderId, token, dispatch) => {
    let accessToken = await ensureAccessToken(token, dispatch);
    if (!accessToken) throw buildAuthError();

    let res = await API.get(`/payment/${orderId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true,
    });

    if (res.status === 401) {
        accessToken = await ensureAccessToken(null, dispatch);
        if (!accessToken) throw buildAuthError();
        res = await API.get(`/payment/${orderId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            validateStatus: () => true,
        });
    }

    if (res.status !== 200) {
        const message = res?.data?.message || `Không lấy được thông tin thanh toán (HTTP ${res.status}).`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }

    return res.data;
};

export const confirmPaymentSession = async (orderId, payload, token, dispatch) => {
    let accessToken = await ensureAccessToken(token, dispatch);
    if (!accessToken) throw buildAuthError();

    let res = await API.post(`/payment/${orderId}/confirm`, payload || {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true,
    });

    if (res.status === 401) {
        accessToken = await ensureAccessToken(null, dispatch);
        if (!accessToken) throw buildAuthError();
        res = await API.post(`/payment/${orderId}/confirm`, payload || {}, {
            headers: { Authorization: `Bearer ${accessToken}` },
            validateStatus: () => true,
        });
    }

    if (res.status !== 200) {
        const message = res?.data?.message || `Thanh toán thất bại (HTTP ${res.status}).`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }

    return res.data;
};

export const cancelPaymentSession = async (orderId, token, dispatch) => {
    let accessToken = await ensureAccessToken(token, dispatch);
    if (!accessToken) throw buildAuthError();

    let res = await API.post(`/payment/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true,
    });

    if (res.status === 401) {
        accessToken = await ensureAccessToken(null, dispatch);
        if (!accessToken) throw buildAuthError();
        res = await API.post(`/payment/${orderId}/cancel`, {}, {
            headers: { Authorization: `Bearer ${accessToken}` },
            validateStatus: () => true,
        });
    }

    if (res.status !== 200) {
        const message = res?.data?.message || `Không thể hủy thanh toán (HTTP ${res.status}).`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }

    return res.data;
};

export const createSePayQr = async (orderId, token, dispatch) => {
    let accessToken = await ensureAccessToken(token, dispatch);
    if (!accessToken) throw buildAuthError();

    let res = await API.post(`/payment/${orderId}/create-qr`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
        validateStatus: () => true,
    });

    if (res.status === 401) {
        accessToken = await ensureAccessToken(null, dispatch);
        if (!accessToken) throw buildAuthError();
        res = await API.post(`/payment/${orderId}/create-qr`, {}, {
            headers: { Authorization: `Bearer ${accessToken}` },
            validateStatus: () => true,
        });
    }

    if (res.status !== 200) {
        const message = res?.data?.message || `Không tạo được mã QR thanh toán (HTTP ${res.status}).`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
    }

    return res.data;
};


export const fetchMyOrders = async (accessToken) => {
    // B1: đảm bảo token (nếu FE bị mất sau reload, sẽ refresh tại đây)
    let token = await ensureAccessToken(accessToken);
    if (!token) {
        // chưa lấy được token từ refresh => báo cần đăng nhập
        const err = new Error("AUTH_REQUIRED");
        err.code = "AUTH_REQUIRED";
        throw err;
    }

    // B2: gọi API; nếu 401 thì thử refresh lần cuối rồi retry
    let res = await API.get("/order/me", {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });

    if (res.status === 401) {
        // refresh lần nữa (phòng khi token vừa hết hạn)
        token = await ensureAccessToken(null);
        if (!token) {
            const err = new Error("AUTH_REQUIRED");
            err.code = "AUTH_REQUIRED";
            throw err;
        }
        res = await API.get("/order/me", {
            headers: { Authorization: `Bearer ${token}` },
            validateStatus: () => true,
        });
    }

    if (res.status !== 200) {
        const msg = res?.data?.message || `Không tải được đơn hàng (HTTP ${res.status}).`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
    }
    return res.data;
};
// user hủy đơn hàng của mình
export const cancelOrder = async (orderId, token) => {
    const res = await API.put(
        `/order/${orderId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data;
};

// ===== Profile helpers (NEW) =====
export const refreshCurrentUser = async (dispatch) => {
    const token = await ensureAccessToken(null);
    if (!token) {
        console.warn("⚠️ No token available for refresh");
        return null;
    }
    const res = await API.get('/user/me', { headers: { Authorization: `Bearer ${token}` } });
    console.log("📥 Fetched user data from /user/me:", res.data);
    dispatch(loginSuccess({ ...res.data, accessToken: token }));
    return res.data;
};

export const updateProfile = async (payload, dispatch) => {
    const token = await ensureAccessToken(null);
    const res = await API.put('/user/me', payload, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true });
    if (res.status === 200) { await refreshCurrentUser(dispatch); return { ok: true, data: res.data }; }
    return { ok: false, error: res.data || { message: 'Cập nhật thất bại' } };
};

export const uploadAvatar = async (file, dispatch) => {
    const token = await ensureAccessToken(null);
    
    // Bước 1: Upload ảnh lên Cloudinary
    const form = new FormData();
    form.append("images", file); // API endpoint /upload nhận field "images"
    
    const uploadRes = await API.post("/upload", form, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
        },
        validateStatus: () => true,
    });
    
    if (uploadRes.status !== 200 || !uploadRes.data?.urls?.[0]) {
        console.error("Upload to Cloudinary failed:", uploadRes.data);
        throw new Error(uploadRes.data?.message || `Upload to Cloudinary failed (${uploadRes.status})`);
    }
    
    const cloudinaryUrl = uploadRes.data.urls[0]; // Lấy URL đầu tiên từ mảng
    console.log("✅ Uploaded to Cloudinary:", cloudinaryUrl);
    
    // Bước 2: Cập nhật avatar URL vào user profile
    const updateRes = await API.put("/user/me", 
        { avatar: cloudinaryUrl }, 
        {
            headers: { Authorization: `Bearer ${token}` },
            validateStatus: () => true,
        }
    );
    
    if (updateRes.status !== 200) {
        console.error("Update avatar failed:", updateRes.data);
        throw new Error(updateRes.data?.message || `Update avatar failed (${updateRes.status})`);
    }
    
    console.log("✅ Avatar updated in database. Response:", updateRes.data);
    
    // Bước 3: Refresh user data để cập nhật Redux store
    const refreshedUser = await refreshCurrentUser(dispatch);
    console.log("✅ User data refreshed. Avatar:", refreshedUser?.avatar);
    
    return { avatar: cloudinaryUrl, message: "Upload avatar thành công" };
};


export const requestEmailChange = async (newEmail) => {
    const token = await ensureAccessToken(null);
    return API.post('/auth/email/change/request', { newEmail }, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true });
};

export const confirmEmailChange = async (otp, dispatch) => {
    const token = await ensureAccessToken(null);
    const res = await API.post('/auth/email/change/confirm', { token: String(otp || '') }, { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true });
    if (res.status === 200) await refreshCurrentUser(dispatch);
    return res;
};


/* ======================= STOCK (Admin) ======================= */

// Danh sách tồn kho (kèm product)
export const listStock = async () => {
    const token = await ensureAccessToken(null);
    const res = await API.get("/stock", {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // [{ _id, product, onHand, productDoc, ... }]
};

// Lấy tồn 1 sản phẩm
export const getStockOne = async (productId) => {
    const token = await ensureAccessToken(null);
    const res = await API.get(`/stock/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // { product, onHand } hoặc null
};

// Nhập kho (tăng)
export const stockIn = async (productId, qty) => {
    const token = await ensureAccessToken(null);
    const res = await API.post(
        "/stock/in",
        { productId, qty },
        { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data;
};

// Set cứng số tồn
export const stockSet = async (productId, qty) => {
    const token = await ensureAccessToken(null);
    const res = await API.post(
        "/stock/set",
        { productId, qty },
        { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data;
};

// Nhập kho có nhà cung cấp + xuất hóa đơn
export const stockInWithInvoice = async ({ supplierId, items, note }) => {
    const token = await ensureAccessToken(null);
    const res = await API.post(
        "/stock/in-with-invoice",
        { supplierId, items, note },
        { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // { ok, message, receiptId, invoiceUrl }
};

// Lấy tất cả nhà cung cấp (admin)
export const getAllSuppliers = async () => {
    const token = await ensureAccessToken(null);
    const res = await API.get("/supplier", {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // [{_id, name, ...}]
};

// Tải file hoá đơn (blob)
export const downloadInvoiceBlob = async (receiptId) => {
    const token = await ensureAccessToken(null);
    const res = await API.get(`/stock/invoice/${receiptId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // Blob
};

// Thêm mới nhà cung cấp
export const addSupplier = async (payload) => {
    const token = await ensureAccessToken(null);
    const res = await API.post("/supplier", payload, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 201) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // { _id, name, ... }
};

// Lấy danh sách hóa đơn
export const listReceipts = async () => {
    const token = await ensureAccessToken(null);
    const res = await API.get("/stock/receipts", {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data;
};

// Lấy chi tiết 1 hóa đơn
export const getReceiptDetail = async (id) => {
    const token = await ensureAccessToken(null);
    const res = await API.get(`/stock/receipt/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data;
};

// tóm tắt thống kê đơn hàng (admin)
export const getOrderStats = async () => {
    const token = await ensureAccessToken(null);
    const res = await API.get("/order/stats", {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data;
};

/* ======================= COUPON (Admin + User) ======================= */

// Admin: tạo coupon
export const createCoupon = async (payload) => {
    const token = await ensureAccessToken(null);
    const res = await API.post("/coupon", payload, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 201) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // { ok, coupon }
};

// Admin: lấy danh sách coupon
export const getAllCoupons = async () => {
    const token = await ensureAccessToken(null);
    const res = await API.get("/coupon", {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // [{ _id, code, value, ... }]
};

// Admin: xóa coupon
export const deleteCoupon = async (id) => {
    const token = await ensureAccessToken(null);
    const res = await API.delete(`/coupon/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data;
};

// Admin: bật/tắt coupon
export const toggleCoupon = async (id) => {
    const token = await ensureAccessToken(null);
    const res = await API.patch(`/coupon/${id}/toggle`, null, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // { ok, coupon }
};

// Admin: gia hạn coupon
export const extendCoupon = async (id, payload) => {
    const token = await ensureAccessToken(null);
    const res = await API.patch(`/coupon/${id}/extend`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
    });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // { ok, coupon }
};

// User: kiểm tra coupon trước khi đặt hàng
export const validateCoupon = async (code, subtotal, cartItems = []) => {
    const res = await API.post("/coupon/validate", { code, subtotal, cartItems }, { validateStatus: () => true });
    if (res.status !== 200) throw new Error(res?.data?.message || `HTTP ${res.status}`);
    return res.data; // { ok:true, discount, applicableProductCount, message }
};
