import { createSlice } from "@reduxjs/toolkit";

//const storedAdmin = JSON.parse(localStorage.getItem("user")); luu user

const userSlice = createSlice({
    name: "user",
    initialState: {
        users: {
            allUsers:null,
            isFetching:false,
            error:false,
        },
        msg:"",
    },
    reducers: {
        //get all user
        getUserStart: (state) => {
            state.users.isFetching = true; 
        },

        getUsersSuccess: (state, action) => {
            state.users.isFetching = false;
            state.users.allUsers = action.payload;
        },

        getUserFailure: (state) => {
            state.users.isFetching = false;
            state.users.error = true;
        },
        //delete
        deleteUserStart: (state) => {
            state.users.isFetching = true; 
        },
        deleteUserSuccess: (state, action) => {
            state.users.isFetching = false;
            state.msg = action.payload;
        },
        deleteUserFailure: (state, action) => {
            state.users.isFetching = false;
            state.users.error = true;
            state.msg = action.payload;
        },
        //update
        updateUserStart: (state) => {
            state.users.isFetching = true; 
        },
        updateUserSuccess: (state, action) => {
            state.users.isFetching = false;
            state.msg = action.payload;
        },
        updateUserFailure: (state, action) => {
            state.users.isFetching = false;
            state.users.error = true;
            state.msg = action.payload;
        },
    }
})

export const { getUserStart, getUsersSuccess, getUserFailure, deleteUserStart, deleteUserSuccess, deleteUserFailure, updateUserStart, updateUserSuccess, updateUserFailure } = userSlice.actions;
export default userSlice.reducer;