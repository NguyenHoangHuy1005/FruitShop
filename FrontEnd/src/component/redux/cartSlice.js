import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    data: {
        items: [],
        summary: { totalItems: 0, subtotal: 0 },
        coupon: null   // ✅ thêm field để lưu coupon
    },
    isFetching: false,
    error: null,
};

const cartSlice = createSlice({
    name: "cart",
    initialState,
    reducers: {
        cartRequestStart: (state) => {
            state.isFetching = true;
            state.error = null;
        },
        cartRequestFailure: (state, action) => {
            state.isFetching = false;
            state.error = action.payload || "Lỗi giỏ hàng";
        },
        setCart: (state, action) => {
            state.isFetching = false;
            state.error = null;
            state.data = action.payload || initialState.data;
        },
        clearLocalCart: (state) => {
            state.data = initialState.data;
        },
        //  thêm reducer mới
        setCoupon: (state, action) => {
            state.data.coupon = action.payload; // { code, discount }
        },
    },
});

// ====== Exports gốc (giữ nguyên) ======
export const {
    cartRequestStart,
    cartRequestFailure,
    setCart,
    clearLocalCart,
    setCoupon, //  export reducer mới
} = cartSlice.actions;

// ====== Alias để apiRequest.js không phải sửa ======
export const cartStart = cartRequestStart;
export const cartFailure = cartRequestFailure;
export const cartSuccess = setCart;

export default cartSlice.reducer;
