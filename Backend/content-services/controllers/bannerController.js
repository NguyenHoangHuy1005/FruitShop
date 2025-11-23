const mongoose = require("mongoose");
const Banner = require("../models/Banner");
const cloudinary = require("../../admin-services/config/cloudinaryConfig");

const BANNER_UPLOAD_FOLDER = "fruitshop/banners";
const DEFAULT_ACTIVE_HOURS = { from: "00:00", to: "23:59" };

const toBoolean = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "on"].includes(normalized);
  }
  return Boolean(value);
};

const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeSeason = (value) => {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  return Banner.SEASONS.includes(v) ? v : null;
};

const normalizeEventTag = (value) => {
  if (!value && value !== 0) return null;
  return String(value).trim().toUpperCase() || null;
};

const normalizePosition = (value) => {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  return Banner.POSITIONS.includes(v) ? v : null;
};

const normalizeRotationGroup = (value) => {
  if (!value) return null;
  return String(value).trim().toUpperCase();
};

const parseDaysOfWeek = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const arr = Array.isArray(value)
    ? value
    : String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const normalized = arr
    .map((item) => Number(item))
    .filter((item) => !Number.isNaN(item) && item >= 0 && item <= 6);
  return normalized.length ? normalized : [];
};

const parseActiveHours = (body) => {
  if (!body) return undefined;
  const from = body.from || body.start || body.startHour || body.activeFrom;
  const to = body.to || body.end || body.endHour || body.activeTo;
  if (!from && !to) return undefined;
  return {
    from: (from || DEFAULT_ACTIVE_HOURS.from).slice(0, 5),
    to: (to || DEFAULT_ACTIVE_HOURS.to).slice(0, 5),
  };
};

const minutesFromTime = (value) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const isWithinActiveHours = (banner, now) => {
  const { activeHours } = banner;
  if (!activeHours || (!activeHours.from && !activeHours.to)) return true;
  const target = now.getHours() * 60 + now.getMinutes();
  const fromMinutes = minutesFromTime(activeHours.from) ?? minutesFromTime(DEFAULT_ACTIVE_HOURS.from);
  const toMinutes = minutesFromTime(activeHours.to) ?? minutesFromTime(DEFAULT_ACTIVE_HOURS.to);
  if (fromMinutes === null || toMinutes === null) return true;
  if (fromMinutes === toMinutes) return true;
  if (fromMinutes < toMinutes) {
    return target >= fromMinutes && target <= toMinutes;
  }
  return target >= fromMinutes || target <= toMinutes;
};

const detectSeasonFromDate = (date = new Date()) => {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "SPRING";
  if (month >= 5 && month <= 7) return "SUMMER";
  if (month >= 8 && month <= 10) return "AUTUMN";
  return "WINTER";
};

const computeRuntimeStatus = (banner, now = new Date()) => {
  if (banner.isActive === false) return false;

  const startAt = banner.startAt ? new Date(banner.startAt) : null;
  const endAt = banner.endAt ? new Date(banner.endAt) : null;

  if (startAt && now < startAt) return false;
  if (endAt && now > endAt) return false;

  if (Array.isArray(banner.activeDaysOfWeek) && banner.activeDaysOfWeek.length) {
    if (!banner.activeDaysOfWeek.includes(now.getDay())) return false;
  }

  if (!isWithinActiveHours(banner, now)) return false;
  return true;
};

const serializeBanner = (banner, now = new Date(), extras = {}) => {
  if (!banner) return null;
  const plain = banner.toObject({ virtuals: true });
  plain.id = plain._id;
  plain.isCurrentlyActive = computeRuntimeStatus(banner, now);
  plain.resolvedSeason = extras.resolvedSeason || plain.season || null;
  plain.activityWindow = {
    startAt: plain.startAt,
    endAt: plain.endAt,
    days: plain.activeDaysOfWeek,
    hours: plain.activeHours,
  };
  return plain;
};

const enforceDefaultBanner = async (banner) => {
  if (!banner?.isDefault || !banner.position) return;
  await Banner.updateMany(
    { _id: { $ne: banner._id }, position: banner.position },
    { $set: { isDefault: false } }
  );
};

const buildBannerPayload = (body = {}) => {
  const payload = {};
  if (body.title !== undefined) payload.title = body.title;
  if (body.description !== undefined) payload.description = body.description;

  const normalizedPosition = normalizePosition(body.position);
  if (normalizedPosition) payload.position = normalizedPosition;

  if (body.imageDesktop !== undefined) payload.imageDesktop = body.imageDesktop;
  if (body.imageMobile !== undefined) payload.imageMobile = body.imageMobile || "";
  if (body.redirectUrl !== undefined) payload.redirectUrl = body.redirectUrl || "";

  if (body.startAt !== undefined) payload.startAt = toDateOrNull(body.startAt);
  if (body.endAt !== undefined) payload.endAt = toDateOrNull(body.endAt);

  if (body.activeDaysOfWeek !== undefined) {
    payload.activeDaysOfWeek = parseDaysOfWeek(body.activeDaysOfWeek);
  }

  const parsedHours = parseActiveHours(body.activeHours || body);
  if (parsedHours) payload.activeHours = parsedHours;

  if (body.season !== undefined) payload.season = normalizeSeason(body.season);
  if (body.eventTag !== undefined) payload.eventTag = normalizeEventTag(body.eventTag);

  if (body.priority !== undefined) payload.priority = toNumber(body.priority, 0);
  if (body.rotationGroup !== undefined) payload.rotationGroup = normalizeRotationGroup(body.rotationGroup);
  if (body.rotationInterval !== undefined) payload.rotationInterval = toNumber(body.rotationInterval, 0);

  if (body.isDefault !== undefined) payload.isDefault = toBoolean(body.isDefault);
  if (body.isActive !== undefined) payload.isActive = toBoolean(body.isActive);

  if (body.rotationGroup === "") payload.rotationGroup = null;
  if (body.eventTag === "") payload.eventTag = null;

  return payload;
};

const bufferToCloudinary = (fileBuffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(fileBuffer);
  });

const buildRotationGroupsMeta = (banners = []) => {
  const map = {};
  banners.forEach((banner) => {
    const key = banner.rotationGroup || banner.id || banner._id?.toString();
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        key,
        interval: banner.rotationInterval || 0,
        total: 0,
        priority: banner.priority || 0,
      };
    }
    map[key].total += 1;
  });
  return Object.values(map).sort((a, b) => b.priority - a.priority);
};

const bannerController = {
  createBanner: async (req, res) => {
    try {
      const payload = buildBannerPayload(req.body);
      if (!payload.title || !payload.position || !payload.imageDesktop) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields (title, position, imageDesktop)",
        });
      }

      payload.startAt = payload.startAt || null;
      payload.endAt = payload.endAt || null;
      payload.activeHours = payload.activeHours || { ...DEFAULT_ACTIVE_HOURS };

      const banner = await Banner.create(payload);
      await enforceDefaultBanner(banner);

      res.status(201).json({ success: true, banner: serializeBanner(banner) });
    } catch (error) {
      console.error("Error creating banner", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getBanners: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        position,
        season,
        eventTag,
        search,
        isActive,
        isDefault,
        rotationGroup,
      } = req.query;

      const query = {};
      if (position) {
        const normalized = normalizePosition(position);
        if (normalized) query.position = normalized;
      }
      if (season) {
        const normalized = normalizeSeason(season);
        if (normalized) query.season = normalized;
      }
      if (eventTag) query.eventTag = normalizeEventTag(eventTag);
      if (rotationGroup) query.rotationGroup = normalizeRotationGroup(rotationGroup);

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      if (isActive !== undefined) query.isActive = toBoolean(isActive);
      if (isDefault !== undefined) query.isDefault = toBoolean(isDefault);

      const skip = (Math.max(Number(page), 1) - 1) * Math.max(Number(limit), 1);

      const [banners, total] = await Promise.all([
        Banner.find(query)
          .sort({ priority: -1, updatedAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        Banner.countDocuments(query),
      ]);

      const now = new Date();
      const payload = banners.map((banner) => serializeBanner(banner, now));

      res.json({
        success: true,
        data: payload,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (error) {
      console.error("Error fetching banners", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getBannerById: async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await Banner.findById(id);
      if (!banner) {
        return res.status(404).json({ success: false, message: "Banner not found" });
      }
      res.json({ success: true, banner: serializeBanner(banner) });
    } catch (error) {
      console.error("Error fetching banner", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  updateBanner: async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await Banner.findById(id);
      if (!banner) {
        return res.status(404).json({ success: false, message: "Banner not found" });
      }

      const payload = buildBannerPayload(req.body);
      Object.assign(banner, payload);

      await banner.save();
      await enforceDefaultBanner(banner);

      res.json({ success: true, banner: serializeBanner(banner) });
    } catch (error) {
      console.error("Error updating banner", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  updateBannerStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await Banner.findById(id);
      if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });

      if (req.body.isActive !== undefined) banner.isActive = toBoolean(req.body.isActive);
      if (req.body.isDefault !== undefined) banner.isDefault = toBoolean(req.body.isDefault);

      await banner.save();
      await enforceDefaultBanner(banner);

      res.json({ success: true, banner: serializeBanner(banner) });
    } catch (error) {
      console.error("Error updating banner status", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  deleteBanner: async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await Banner.findByIdAndDelete(id);
      if (!banner) {
        return res.status(404).json({ success: false, message: "Banner not found" });
      }
      res.json({ success: true, message: "Banner deleted" });
    } catch (error) {
      console.error("Error deleting banner", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  uploadBannerImage: async (req, res) => {
    try {
      const { imageUrl, folder = "", type = "image" } = req.body;
      const files = req.files || {};
      const normalizedType = type || "image";
      const file =
        (files[normalizedType] && files[normalizedType][0]) ||
        (files.image && files.image[0]) ||
        (files.imageDesktop && files.imageDesktop[0]) ||
        (files.imageMobile && files.imageMobile[0]);

      let uploadResult = null;
      const folderPath = folder
        ? `${BANNER_UPLOAD_FOLDER}/${folder}`
        : `${BANNER_UPLOAD_FOLDER}/${normalizedType}`;

      if (imageUrl) {
        uploadResult = await cloudinary.uploader.upload(imageUrl, {
          folder: folderPath,
        });
      } else if (file) {
        uploadResult = await bufferToCloudinary(file.buffer, {
          folder: folderPath,
        });
      } else {
        return res.status(400).json({ success: false, message: "No image payload provided" });
      }

      res.status(201).json({
        success: true,
        url: uploadResult.secure_url,
        type: normalizedType,
      });
    } catch (error) {
      console.error("Error uploading banner image", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getActiveBanners: async (req, res) => {
    try {
      const { position, eventTag, rotationGroup, limit, season } = req.query;
      if (!position) {
        return res.status(400).json({ success: false, message: "Missing position parameter" });
      }

      const normalizedPosition = normalizePosition(position);
      if (!normalizedPosition) {
        return res.status(400).json({ success: false, message: "Invalid position value" });
      }

      const now = new Date();
      const resolvedSeason = normalizeSeason(season) || detectSeasonFromDate(now);

      const query = { position: normalizedPosition };
      if (rotationGroup) query.rotationGroup = normalizeRotationGroup(rotationGroup);

      const candidates = await Banner.find(query).sort({ priority: -1, updatedAt: -1 });

      const matched = [];
      const defaults = [];

      const normalizedEvent = eventTag ? normalizeEventTag(eventTag) : null;

      candidates.forEach((banner) => {
        if (banner.season && resolvedSeason && banner.season !== resolvedSeason) {
          return;
        }
        if (normalizedEvent && banner.eventTag && banner.eventTag !== normalizedEvent) {
          return;
        }

        const serialized = serializeBanner(banner, now, { resolvedSeason });
        if (computeRuntimeStatus(banner, now)) {
          matched.push(serialized);
        } else if (banner.isDefault) {
          defaults.push(serialized);
        }
      });

      const items = matched.length ? matched : defaults;
      const limitedItems = limit ? items.slice(0, Number(limit)) : items;

      res.json({
        success: true,
        meta: {
          position: normalizedPosition,
          season: resolvedSeason,
          eventTag: normalizedEvent,
          rotationGroups: buildRotationGroupsMeta(limitedItems),
          total: limitedItems.length,
          generatedAt: now.toISOString(),
        },
        banners: limitedItems,
      });
    } catch (error) {
      console.error("Error fetching active banners", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  trackBannerView: async (req, res) => {
    await bannerController._incrementStat(req, res, "views");
  },

  trackBannerClick: async (req, res) => {
    await bannerController._incrementStat(req, res, "clicks");
  },

  _incrementStat: async (req, res, field) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid banner id" });
      }
      const banner = await Banner.findByIdAndUpdate(
        id,
        { $inc: { [`stats.${field}`]: 1 } },
        { new: true }
      );
      if (!banner) {
        return res.status(404).json({ success: false, message: "Banner not found" });
      }
      res.json({ success: true, banner: serializeBanner(banner) });
    } catch (error) {
      console.error(`Error tracking banner ${field}`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = bannerController;

