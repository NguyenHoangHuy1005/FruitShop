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

// Tạo axios instance để dễ đổi baseURL / bật cookie
const API = axios.create({
    baseURL: import.meta?.env?.VITE_API_BASE || "http://localhost:3000/api",
    withCredentials: true,
});

// Export nếu nơi khác cần dùng trực tiếp
export { API };
/* ======================= AUTH ======================= */

export const loginUser = async (user, dispatch, navigate) => {
    dispatch(loginStart());
    try {
        const res = await API.post("/auth/login", user);
        dispatch(loginSuccess(res.data));

        const msg = res?.data?.message || "Đăng nhập thành công!";
        alert(msg);

        if (res.data.admin === true) {
        navigate(ROUTERS.ADMIN?.USERMANAGER || "/admin/users");
        } else {
        navigate("/");
        }
    } catch (error) {
        // Nếu chưa verify: backend trả 403 + pendingEmail
        if (error?.response?.status === 403 && error?.response?.data?.pendingEmail) {
        const pending = error.response.data.pendingEmail;
        localStorage.setItem("PENDING_EMAIL", pending);
        dispatch(setPendingEmail(pending));
        alert("Tài khoản chưa xác minh. Vui lòng nhập mã OTP.");
        navigate(ROUTERS.ADMIN?.AUTH     || "/admin/auth");
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
export const verifyAccount = async ({ email, token }, dispatch) => {
    dispatch(verifyStart());
    try {
        await API.post("/auth/verify", { email, token });
        dispatch(verifySuccess());
        return { ok: true };
    } catch (error) {
        const message = error?.response?.data?.message || "Xác minh thất bại!";
        dispatch(verifyFailure());
        return { ok: false, message };
    }
};


// Gửi lại mã
export const resendCode = async (email, dispatch) => {
    try {
        const res = await API.post("/auth/verify/resend", { email });
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
        { id }, // server không dùng id cũng không sao
        {
            headers: { token: `Bearer ${accessToken}` },
            withCredentials: true, // QUAN TRỌNG: để clearCookie hoạt động
        }
        );
    } catch (error) {
        ok = false;
        console.error("Logout error:", error?.response?.data || error?.message);
    } finally {
        // === Dọn toàn bộ session phía client (an toàn, idempotent) ===
        try { localStorage.removeItem("persist:root"); } catch {}
        try { sessionStorage.clear(); } catch {}
        try { if (API?.defaults?.headers?.common?.token) delete API.defaults.headers.common.token; } catch {}

        dispatch(logoutSuccess());

        if (ok) {
        alert("Đăng xuất thành công!");
        } else {
        // Server có thể chưa thu hồi token cũ, nhưng phiên phía client đã được xóa.
        alert("Đã xóa phiên trên trình duyệt. (Máy chủ có thể chưa thu hồi token)");
        }

        // Về TRANG CHỦ
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
