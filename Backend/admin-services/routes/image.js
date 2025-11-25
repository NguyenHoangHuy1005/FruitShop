const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const tf = require("@tensorflow/tfjs-node");
const nsfw = require("nsfwjs");
const cloudinary = require("../config/cloudinaryConfig");

const router = express.Router();

const MAX_AVATAR_BYTES = Number(process.env.MAX_AVATAR_BYTES || 4 * 1024 * 1024);
const MAX_AVATAR_WIDTH = Number(process.env.MAX_AVATAR_WIDTH || 2048);
const MAX_AVATAR_HEIGHT = Number(process.env.MAX_AVATAR_HEIGHT || 2048);

const MAX_GENERAL_BYTES = Number(process.env.MAX_GENERAL_UPLOAD_BYTES || 20 * 1024 * 1024);
const MAX_GENERAL_WIDTH = Number(process.env.MAX_GENERAL_UPLOAD_WIDTH || 6000);
const MAX_GENERAL_HEIGHT = Number(process.env.MAX_GENERAL_UPLOAD_HEIGHT || 6000);

const PORN_THRESHOLD = Number(process.env.NSFW_STRICT_THRESHOLD || 0.6);
const SEXY_THRESHOLD = Number(process.env.NSFW_SOFT_THRESHOLD || 0.8);

const storage = multer.memoryStorage();
const upload = multer({ storage });

let nsfwModelPromise = null;
const getNsfwModel = () => {
  if (!nsfwModelPromise) {
    nsfwModelPromise = nsfw.load();
  }
  return nsfwModelPromise;
};

const validateImageBuffer = async (file, model, limits) => {
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

  const imageTensor = tf.node.decodeImage(file.buffer, 3);
  const predictions = await model.classify(imageTensor);
  imageTensor.dispose();

  const sensitive = predictions.some((p) => {
    const label = p.className.toLowerCase();
    if ((label === "porn" || label === "hentai") && p.probability >= PORN_THRESHOLD) return true;
    if (label === "sexy" && p.probability >= SEXY_THRESHOLD) return true;
    return false;
  });

  if (sensitive) {
    throw new Error(`Ảnh "${file.originalname}" bị từ chối do chứa nội dung không phù hợp`);
  }
};

router.post("/upload", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const model = await getNsfwModel();
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

    for (const file of req.files) {
      await validateImageBuffer(file, model, limits);
    }

    const uploadPromises = req.files.map((file) => {
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
