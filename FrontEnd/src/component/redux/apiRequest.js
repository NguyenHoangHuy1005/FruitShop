import axios from 'axios';
import { ROUTERS } from "../../utils/router";
import {
    loginFailure, loginStart, loginSuccess,
    registerFailure, registerStart, registerSuccess,
    logoutStart, logoutSuccess, logoutFailure,
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
export const ensureAccessToken = async (maybeToken) => {
    if (maybeToken) return maybeToken;
    try {
        const r = await API.post("/auth/refresh", null, { validateStatus: () => true });
        if (r.status === 200 && r.data?.accessToken) {
        const t = r.data.accessToken;
        API.defaults.headers.common.Authorization = `Bearer ${t}`;
        return t;
        }
    } catch (_) {}
    return null; // không có token
};
/* ======================= AUTH ======================= */

export const loginUser = async (user, dispatch, navigate) => {
    dispatch(loginStart());
    try {
        const res = await API.post("/auth/login", user);
        dispatch(loginSuccess(res.data));

        // ⚡ nếu BE trả về cart thì chuẩn hóa lại cho Redux
        if (res.data?.cart) {
            const { items = [], summary = { totalItems: 0, subtotal: 0 } } = res.data.cart;
            dispatch(cartSuccess({ items, summary }));
        } else {
            // ⚡ fallback: gọi API /cart để load lại từ BE
            await ensureCart(dispatch);
        }



        // Gắn Authorization cho mọi request tiếp theo
        if (res.data?.accessToken) {
            API.defaults.headers.common.Authorization = `Bearer ${res.data.accessToken}`;
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
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}
        try {
        delete API.defaults.headers.common.Authorization;
        delete API.defaults.headers.common.token;
        } catch {}

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
        dispatch(getUsersSuccess(res.data));
    } catch (error) {
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
    } catch (err) {
        console.error(err);
        dispatch(updateProductFailure());
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
        alert("Đã thêm vào giỏ!");
    } catch (e) {
        dispatch(cartFailure(e?.response?.data || e.message));
        alert(e?.response?.data?.message || "Thêm giỏ thất bại!");
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
export const placeOrder = async (payload, accessToken, dispatch, navigate) => {
    // payload: { fullName, address, phone, email, note }
    try {
        const res = await API.post("/order", payload, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        alert(res?.data?.message || "Đặt hàng thành công!");
        // BE thường clear cart sau khi tạo order → làm mới cart:
        await ensureCart(dispatch);
        navigate(ROUTERS.USER.ORDERS);
    } catch (e) {
        const msg = e?.response?.data?.message || "Đặt hàng thất bại!";
        alert(msg);
    }
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
