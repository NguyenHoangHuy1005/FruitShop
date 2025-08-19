import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
    name: "auth",
    initialState: {
        login: {
        currentUser: null,
        isFetching: false,
        error: false,
        },
        register: {
        isFetching: false,
        error: false,
        success: false,
        },
        verify: {
        isFetching: false,
        error: false,
        success: false,
        },
        // lưu email đang chờ xác minh (đồng bộ với localStorage.PENDING_EMAIL)
        pendingEmail: localStorage.getItem("PENDING_EMAIL") || null,
    },
    reducers: {
        /* ===== Login ===== */
    loginStart: (state) => { state.login.isFetching = true; },
    loginSuccess: (state, action) => {
        state.login.isFetching = false;
        state.login.currentUser = action.payload;
        state.login.error = false;
        },
        loginFailure: (state) => {
        state.login.isFetching = false;
        state.login.error = true;
        },

        /* ===== Register ===== */
        registerStart: (state) => { state.register.isFetching = true; },
        registerSuccess: (state) => {
        state.register.isFetching = false;
        state.register.error = false;
        state.register.success = true;
        },
        registerFailure: (state) => {
        state.register.isFetching = false;
        state.register.error = true;
        state.register.success = false;
        },

        /* ===== Verify (OTP) ===== */
        verifyStart: (state) => { state.verify.isFetching = true; },
        verifySuccess: (state) => {
        state.verify.isFetching = false;
        state.verify.error = false;
        state.verify.success = true;
        },
        verifyFailure: (state) => {
        state.verify.isFetching = false;
        state.verify.error = true;
        state.verify.success = false;
        },

        /* ===== Pending email ===== */
        setPendingEmail: (state, action) => {
        state.pendingEmail = action.payload;
        },

        /* ===== Logout ===== */
        logoutStart: (state) => { state.login.isFetching = true; },
        logoutSuccess: (state) => {
        state.login.isFetching = false;
        state.login.currentUser = null;
        state.login.error = false;
        },
        logoutFailure: (state) => {
        state.login.isFetching = false;
        state.login.error = true;
        },
    }
});

export const {
    loginStart, loginSuccess, loginFailure,
    registerStart, registerSuccess, registerFailure,
    verifyStart, verifySuccess, verifyFailure,
    setPendingEmail,
    logoutStart, logoutSuccess, logoutFailure
} = authSlice.actions;

export default authSlice.reducer;
