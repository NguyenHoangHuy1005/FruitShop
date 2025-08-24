import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "../redux/authSlice";
import userReducer from "../redux/userSlice";
import productReducer from "../redux/productSlice";
import cartReducer from "./cartSlice";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['auth', 'cart'], // chỉ lưu những slice cần 
};
const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  product: productReducer,
  cart: cartReducer,
});
const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export let persistor = persistStore(store);