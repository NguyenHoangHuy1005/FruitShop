import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  admin: {
    items: [],
    isFetching: false,
    error: null,
    pagination: { total: 0, page: 1, limit: 10 },
  },
  mutation: {
    isSaving: false,
    error: null,
    lastAction: null,
  },
  active: {
    items: [],
    meta: {},
    isFetching: false,
    error: null,
    byPosition: {},
  },
};

const bannerSlice = createSlice({
  name: "banner",
  initialState,
  reducers: {
    fetchBannerStart: (state) => {
      state.admin.isFetching = true;
      state.admin.error = null;
    },
    fetchBannerSuccess: (state, action) => {
      state.admin.isFetching = false;
      state.admin.items = action.payload?.data || [];
      state.admin.pagination = action.payload?.pagination || state.admin.pagination;
      state.admin.error = null;
    },
    fetchBannerFailure: (state, action) => {
      state.admin.isFetching = false;
      state.admin.error = action.payload || "Unable to load banners";
    },
    mutateBannerStart: (state, action) => {
      state.mutation.isSaving = true;
      state.mutation.error = null;
      state.mutation.lastAction = action.payload || null;
    },
    mutateBannerSuccess: (state) => {
      state.mutation.isSaving = false;
      state.mutation.error = null;
    },
    mutateBannerFailure: (state, action) => {
      state.mutation.isSaving = false;
      state.mutation.error = action.payload || "Banner mutation failed";
    },
    deleteBannerStart: (state) => {
      state.mutation.isSaving = true;
      state.mutation.error = null;
      state.mutation.lastAction = "delete";
    },
    deleteBannerSuccess: (state) => {
      state.mutation.isSaving = false;
      state.mutation.error = null;
    },
    deleteBannerFailure: (state, action) => {
      state.mutation.isSaving = false;
      state.mutation.error = action.payload || "Delete banner failed";
    },
    fetchActiveBannerStart: (state) => {
      state.active.isFetching = true;
      state.active.error = null;
    },
    fetchActiveBannerSuccess: (state, action) => {
      state.active.isFetching = false;
      state.active.error = null;
      const raw = action.payload?.data && !Array.isArray(action.payload.data)
        ? action.payload.data
        : action.payload;
      const banners = raw?.banners || raw?.items || [];
      const meta = raw?.meta || {};
      const positionKey = action.payload?.position || raw?.position || meta?.position || "default";
      state.active.items = banners;
      state.active.meta = meta;
      state.active.byPosition = state.active.byPosition || {};
      state.active.byPosition[positionKey] = {
        items: banners,
        meta,
      };
    },
    fetchActiveBannerFailure: (state, action) => {
      state.active.isFetching = false;
      state.active.error = action.payload || "Unable to load active banners";
    },
    clearBannerErrors: (state) => {
      state.admin.error = null;
      state.mutation.error = null;
      state.active.error = null;
    },
  },
});

export const {
  fetchBannerStart,
  fetchBannerSuccess,
  fetchBannerFailure,
  mutateBannerStart,
  mutateBannerSuccess,
  mutateBannerFailure,
  deleteBannerStart,
  deleteBannerSuccess,
  deleteBannerFailure,
  fetchActiveBannerStart,
  fetchActiveBannerSuccess,
  fetchActiveBannerFailure,
  clearBannerErrors,
} = bannerSlice.actions;

export default bannerSlice.reducer;
