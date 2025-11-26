const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const nsfwScanner = require("../utils/nsfwScanner");
const cloudinary = require("../config/cloudinaryConfig");

const router = express.Router();

const MAX_AVATAR_BYTES = Number(process.env.MAX_AVATAR_BYTES || 4 * 1024 * 1024);
const MAX_AVATAR_WIDTH = Number(process.env.MAX_AVATAR_WIDTH || 2048);
const MAX_AVATAR_HEIGHT = Number(process.env.MAX_AVATAR_HEIGHT || 2048);

const MAX_GENERAL_BYTES = Number(process.env.MAX_GENERAL_UPLOAD_BYTES || 20 * 1024 * 1024);
const MAX_GENERAL_WIDTH = Number(process.env.MAX_GENERAL_UPLOAD_WIDTH || 6000);
const MAX_GENERAL_HEIGHT = Number(process.env.MAX_GENERAL_UPLOAD_HEIGHT || 6000);

const PORN_THRESHOLD = Number(process.env.NSFW_STRICT_THRESHOLD || 0.55);
const SEXY_THRESHOLD = Number(process.env.NSFW_SOFT_THRESHOLD || 0.7);
const AGGREGATE_SENSITIVE_THRESHOLD = Number(process.env.NSFW_AGG_THRESHOLD || 0.45);
const SENSITIVE_LABELS = new Set(["porn", "hentai", "sexy"]);
const HARD_LABELS = new Set(["porn", "hentai"]);

const storage = multer.memoryStorage();
const upload = multer({ storage });

const ensureHttpUrl = (value = "") => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
};

const DATA_URL_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

const parseDataUrlImage = (input, maxBytes) => {
  const match = DATA_URL_REGEX.exec(input || "");
  if (!match) return null;
  const [, mime, b64] = match;
  if (!mime) throw new Error("Data URL thiếu MIME type hợp lệ");
  const buffer = Buffer.from(b64, "base64");
  if (!buffer.length) throw new Error("Data URL rỗng hoặc không hợp lệ");
  if (maxBytes && buffer.length > maxBytes) {
    throw new Error(`Ảnh data-url vượt dung lượng tối đa ${(maxBytes / (1024 * 1024)).toFixed(1)}MB`);
  }
  return {
    originalname: `inline-${Date.now()}${guessExtFromMime(mime)}`,
    buffer,
    size: buffer.length,
    mimetype: mime,
    remoteUrl: "data-url",
  };
};

const normalizeUrlInput = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter((v) => !!v);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((v) => v.trim())
      .filter((v) => !!v);
  }
  return [];
};

const collectRemoteUrls = (body = {}) => {
  const urls = [
    ...normalizeUrlInput(body.imageUrl),
    ...normalizeUrlInput(body.imageUrls),
    ...normalizeUrlInput(body.url),
    ...normalizeUrlInput(body.urls),
  ];
  const seen = new Set();
  const result = [];
  for (const url of urls) {
    const normalized = url.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result.slice(0, 10);
};

const guessExtFromMime = (mime = "") => {
  const lower = mime.toLowerCase();
  if (lower.includes("png")) return ".png";
  if (lower.includes("webp")) return ".webp";
  if (lower.includes("gif")) return ".gif";
  if (lower.includes("jpeg") || lower.includes("jpg")) return ".jpg";
  return ".jpg";
};

const deriveNameFromUrl = (inputUrl = "") => {
  try {
    const parsed = new URL(inputUrl);
    const base = path.basename(parsed.pathname) || "remote-image";
    return decodeURIComponent(base);
  } catch (_) {
    return "remote-image";
  }
};

const fetchRemoteImage = async (inputUrl, maxBytes) => {
  const dataImage = parseDataUrlImage(inputUrl, maxBytes);
  if (dataImage) return dataImage;

  const url = ensureHttpUrl(inputUrl);
  if (!/^https?:\/\//i.test(url || "")) {
    throw new Error(`URL "${inputUrl}" không hợp lệ. Hỗ trợ http(s) hoặc data:image;base64,...`);
  }
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 15000,
    maxContentLength: maxBytes || MAX_GENERAL_BYTES,
    validateStatus: (status) => status >= 200 && status < 400,
  });
  const contentType = res.headers["content-type"] || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`URL "${url}" khA'ng phA?i lA m?t t?p a?nh (Content-Type: ${contentType || "unknown"})`);
  }
  const buffer = Buffer.from(res.data);
  return {
    originalname: deriveNameFromUrl(url) + guessExtFromMime(contentType),
    buffer,
    size: buffer.length,
    mimetype: contentType,
    remoteUrl: url,
  };
};

const validateImageBuffer = async (file, limits) => {
  const {
    label = "ảnh",
    maxBytes = MAX_GENERAL_BYTES,
    maxWidth = MAX_GENERAL_WIDTH,
    maxHeight = MAX_GENERAL_HEIGHT,
  } = limits || {};

  if (file.size > maxBytes) {
    throw new Error(
      `Ảnh "${file.originalname}" vượt dung lượng tối đa ${(maxBytes / (1024 * 1024)).toFixed(1)}MB (${label})`
    );
  }

  const metadata = await sharp(file.buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Không đọc được kích thước ảnh "${file.originalname}"`);
  }

  if (metadata.width > maxWidth || metadata.height > maxHeight) {
    throw new Error(
      `Ảnh "${file.originalname}" vượt kích thước cho phép (${maxWidth}x${maxHeight}px) cho ${label}`
    );
  }

  const predictions = await nsfwScanner.classifyImage(file.buffer, {
    fileName: file?.originalname,
  });

  if (Array.isArray(predictions) && predictions.length > 0) {
    const topHit = predictions[0];
    const aggregateSensitive = predictions.reduce((acc, p) => {
      const labelName = String(p.label || "").toLowerCase();
      if (SENSITIVE_LABELS.has(labelName)) return acc + (Number(p.probability) || 0);
      return acc;
    }, 0);

    const topLabel = String(topHit?.label || "").toLowerCase();
    const topProb = Number(topHit?.probability) || 0;

    const violatesHardThreshold =
      (HARD_LABELS.has(topLabel) && topProb >= PORN_THRESHOLD) ||
      (topLabel === "sexy" && topProb >= SEXY_THRESHOLD);

    if (violatesHardThreshold || aggregateSensitive >= AGGREGATE_SENSITIVE_THRESHOLD) {
      console.warn(
        `[upload] sensitive image blocked "${file.originalname}" (top=${topLabel}:${topProb.toFixed(
          2
        )}, agg=${aggregateSensitive.toFixed(2)})`
      );
      throw new Error(`Ảnh "${file.originalname}" bị từ chối do chứa nội dung không phù hợp`);
    }
  } else {
    console.warn(`[upload] NSFW model unavailable. Skipping sensitive check for ${file.originalname}`);
  }
};

router.get("/nsfw/health", async (req, res) => {
  try {
    if ((req.query?.warmup || "").toString() === "1") {
      await nsfwScanner.warmupModel("health_endpoint");
    } else {
      await nsfwScanner.ensureModelLoaded();
    }

    return res.json({
      ok: true,
      status: nsfwScanner.getStatusSnapshot(),
    });
  } catch (err) {
    console.error("[upload] NSFW health failed:", err?.message || err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "NSFW health check failed",
      status: nsfwScanner.getStatusSnapshot(),
    });
  }
});

router.post("/upload", upload.array("images", 10), async (req, res) => {
  try {
    const purposeRaw = (req.body?.purpose || req.query?.purpose || "").toString().toLowerCase();
    const isAvatarUpload = purposeRaw === "avatar";
    const limits = isAvatarUpload
      ? {
          label: "ảnh đại diện",
          maxBytes: MAX_AVATAR_BYTES,
          maxWidth: MAX_AVATAR_WIDTH,
          maxHeight: MAX_AVATAR_HEIGHT,
        }
      : {
          label: "ảnh tải lên",
          maxBytes: MAX_GENERAL_BYTES,
          maxWidth: MAX_GENERAL_WIDTH,
          maxHeight: MAX_GENERAL_HEIGHT,
        };

    const remoteUrls = collectRemoteUrls(req.body);
    let remoteFiles = [];
    if (remoteUrls.length) {
      try {
        remoteFiles = await Promise.all(
          remoteUrls.map((url) => fetchRemoteImage(url, limits.maxBytes || MAX_GENERAL_BYTES))
        );
      } catch (err) {
        console.error("[upload] Remote fetch failed:", err?.message || err);
        return res.status(400).json({ message: err?.message || "T��?i �`a ���nh t��? URL th���t b���i" });
      }
    }

    const inboundFiles = [...(req.files || []), ...remoteFiles];

    if (!inboundFiles.length) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    for (const file of inboundFiles) {
      await validateImageBuffer(file, limits);
    }

    const uploadPromises = inboundFiles.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "uploads" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );
        stream.end(file.buffer);
      });
    });

    const urls = await Promise.all(uploadPromises);

    res.json({
      message: "Upload thành công!",
      urls,
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message || "Lỗi xử lý ảnh" });
  }
});

module.exports = router;
