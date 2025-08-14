import axios from 'axios';
import { ROUTERS } from "../../utils/router";
import {
    loginFailure, loginStart, loginSuccess,
    registerFailure, registerStart, registerSuccess,
    logoutStart, logoutSuccess, logoutFailure
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

export const loginUser = async (user, dispatch, navigate) => {
    dispatch(loginStart());
    try {
        const res = await axios.post("http://localhost:3000/api/auth/login", user);
        dispatch(loginSuccess(res.data));

        const msg = res?.data?.message || "Đăng nhập thành công!";
        alert(msg);

        if (res.data.admin === true) {
            navigate(ROUTERS.ADMIN.USERMANAGER); // lam 1 trang dashbroad cho admin chua tat ca cac page
        } else {
            navigate("/"); // về trang người dùng thường
        }
    } catch (error) {
        const errMsg = error.response?.data?.message || "Đăng nhập thất bại!";
        alert(errMsg);
        dispatch(loginFailure());
    }
};

export const registerUser = async (user, dispatch, navigate) => {
    dispatch(registerStart());
    try {
        await axios.post("http://localhost:3000/api/auth/register", user);
        dispatch(registerSuccess());
        //localStorage.setItem("user", JSON.stringify(res.data)); luu user
        alert("Đăng ký thành công!");
        navigate("/admin/login");
    } catch (error) {
        dispatch(registerFailure());
        alert("Đăng ký thất bại!");

    }
};

export const getAllUsers = async (accessToken, dispatch) => {
    dispatch(getUserStart());
    try {
        const res = await axios.get("http://localhost:3000/api/user", {
            headers: { token: `Bearer ${accessToken}` },
        })
        dispatch(getUsersSuccess(res.data));
    } catch (error) {
        dispatch(getUserFailure());
    }
};

export const deleteUser = async (accessToken, dispatch, id) => {
    dispatch(deleteUserStart());
    try {
        const res = await axios.delete("http://localhost:3000/api/user/" + id, {
            headers: { token: `Bearer ${accessToken}` },
        });
        dispatch(deleteUserSuccess(res.data));
        alert("Xóa người dùng thành công!");
        //lay danh sach sau khi xoa
        await getAllUsers(accessToken, dispatch);
    } catch (err) {
        dispatch(deleteUserFailure(err.response.data));
        alert("Xóa người dùng thất bại!");

    }
};

export const logout = async (dispatch, navigate, accessToken, id) => {
    dispatch(logoutStart());
    try {
        await axios.post("http://localhost:3000/api/auth/logout", { id }, {
            headers: { token: `Bearer ${accessToken}` },
        });
        dispatch(logoutSuccess());
        alert("Đăng xuất thành công!");
        navigate("/admin/login");
    } catch (error) {
        console.error("Logout error:", error.response?.data || error.message);
        dispatch(logoutFailure());
        alert("Đăng xuất thất bại!");
    }
};

export const updateUser = async (id, updatedUser, accessToken, dispatch) => {
    dispatch(updateUserStart());
    try {
        const res = await axios.put(
            `http://localhost:3000/api/user/${id}`,
            updatedUser,
            {
                headers: { token: `Bearer ${accessToken}` },
            }
        );
        dispatch(updateUserSuccess(res.data));
        alert("Cập nhật thành công!");

        // Cập nhật lại danh sách người dùng sau khi sửa
        await getAllUsers(accessToken, dispatch);
    } catch (err) {
        dispatch(updateUserFailure(err.response?.data));
        alert("Cập nhật thất bại!");
    }
};

/////product//////
export const createProduct = async (product, dispatch) => {
    dispatch(createProductStart());
    try {
        const res = await axios.post(
            "http://localhost:3000/api/product/create", product);
        dispatch(createProductSuccess(res.data));
        await getAllProduct(dispatch);
        alert("Tạo sản phẩm thành công!");
    } catch (error) {
        console.error("Create product error:", error.response?.data || error);
        dispatch(createProductFailure());
        alert("Tạo sản phẩm thất bại!");

    }
};



export const getAllProduct = async (dispatch) => {
    dispatch(getProductStart());
    try {
        const res = await axios.get("http://localhost:3000/api/product");
        dispatch(getProductSuccess(res.data));
    } catch (error) {
        console.error("Create product error:", err.response?.data);
        dispatch(getProductFailure());
    }
};

// export const updateProduct = async (id, products, dispatch) => {
//   dispatch(updateProductStart());
//   try {
//     const res = await axios.put(`http://localhost:3000/api/product/${id}`, products);
//     dispatch(updateProductSuccess(res.data));
//   } catch (err) {
//     dispatch(updateProductFailure());
//   }
// };
