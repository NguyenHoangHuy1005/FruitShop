const mongoose = require("mongoose");

const BANNER_POSITIONS = [
  "HOME_SLIDER",
  "HOME_BOTTOM_BANNER",
  "FEATURED_TOP_BANNER",
];

const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    position: {
      type: String,
      required: true,
      enum: BANNER_POSITIONS,
      uppercase: true,
    },
    imageDesktop: { type: String, required: true },
    imageMobile: { type: String, default: "" },
    redirectUrl: { type: String, default: "" },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    activeDaysOfWeek: {
      type: [Number],
      default: undefined,
      validate: {
        validator: function (value) {
          if (!Array.isArray(value)) return true;
          return value.every((day) => day >= 0 && day <= 6);
        },
        message: "activeDaysOfWeek must only contain values from 0 to 6",
      },
    },
    activeHours: {
      from: {
        type: String,
        default: "00:00",
        match: /^([01]?\d|2[0-3]):[0-5]\d$/,
      },
      to: {
        type: String,
        default: "23:59",
        match: /^([01]?\d|2[0-3]):[0-5]\d$/,
      },
    },
    season: {
      type: String,
      enum: [...SEASONS, null],
      default: null,
      uppercase: true,
    },
    eventTag: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    priority: { type: Number, default: 0 },
    rotationGroup: { type: String, default: null, uppercase: true, trim: true },
    rotationInterval: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    stats: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

bannerSchema.index({ position: 1, priority: -1, updatedAt: -1 });
bannerSchema.index({ season: 1 });
bannerSchema.index({ eventTag: 1 });
bannerSchema.index({ rotationGroup: 1 });

const Banner = mongoose.model("Banner", bannerSchema);
Banner.POSITIONS = BANNER_POSITIONS;
Banner.SEASONS = SEASONS;

module.exports = Banner;
