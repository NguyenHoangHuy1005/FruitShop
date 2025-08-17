import { createSlice } from "@reduxjs/toolkit";

const productSlice = createSlice({
    name: "product",
    initialState: {
        products: {
            allProducts: [],
            isFetching: false,
            error: false,
        },
        create: {
            isFetching: false,
            error: false,
            success: false,
        },
        msg: null, // để lưu thông báo khi delete/update
    },
    reducers: {
        // CREATE product
        createProductStart: (state) => {
            state.create.isFetching = true;
            state.create.error = false;
            state.create.success = false;
        },
        createProductSuccess: (state) => {
            state.create.isFetching = false;
            state.create.error = false;
            state.create.success = true;
        },
        createProductFailure: (state) => {
            state.create.isFetching = false;
            state.create.error = true;
            state.create.success = false;
        },

        // GET all products
        getProductStart: (state) => {
            state.products.isFetching = true;
        },
        getProductSuccess: (state, action) => {
            state.products.isFetching = false;
            state.products.allProducts = action.payload;
        },
        getProductFailure: (state) => {
            state.products.isFetching = false;
            state.products.error = true;
        },

        // DELETE product
        deleteProductStart: (state) => {
            state.products.isFetching = true;
            state.products.error = false;
        },

        deleteProductSuccess: (state, action) => {
            state.products.isFetching = false;
            state.products.allProducts = state.products.allProducts.filter(
                (item) => item._id !== action.payload   // payload là id sản phẩm vừa xóa
            );
            state.msg = "Xóa sản phẩm thành công!";
        },

        deleteProductFailure: (state, action) => {
            state.products.isFetching = false;
            state.products.error = true;
            state.msg = action.payload || "Xóa sản phẩm thất bại!";
        },


        // UPDATE product
        updateProductStart: (state) => {
            state.products.isFetching = true;
        },
        updateProductSuccess: (state, action) => {
            state.products.isFetching = false;
            state.products.error = false;
            const index = state.products.allProducts.findIndex(
                (item) => item._id === action.payload._id
            );
            if (index !== -1) {
                // cập nhật sản phẩm trong danh sách
                state.products.allProducts[index] = action.payload;
            }
        },
        updateProductFailure: (state, action) => {
            state.products.isFetching = false;
            state.products.error = true;
            state.msg = action.payload;
        },
    },
});

export const {
    getProductStart,
    getProductSuccess,
    getProductFailure,
    deleteProductStart,
    deleteProductSuccess,
    deleteProductFailure,
    updateProductStart,
    updateProductSuccess,
    updateProductFailure,
    createProductStart,
    createProductSuccess,
    createProductFailure,
} = productSlice.actions;

export default productSlice.reducer;
