import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    data: { items: [], summary: { totalItems: 0, subtotal: 0 } },
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
    },
});

// ====== Exports gốc (giữ nguyên) ======
export const {
    cartRequestStart,
    cartRequestFailure,
    setCart,
    clearLocalCart,
} = cartSlice.actions;

// ====== Alias để apiRequest.js không phải sửa ======
export const cartStart = cartRequestStart;    // alias cho cartStart
export const cartFailure = cartRequestFailure; // alias cho cartFailure
export const cartSuccess = setCart;            // alias cho cartSuccess

export default cartSlice.reducer;
