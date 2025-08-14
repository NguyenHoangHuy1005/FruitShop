const express = require("express");
const multer = require("multer");
const cloudinary = require("../config/cloudinaryConfig");

const router = express.Router();

// Cấu hình multer để lưu file tạm thời trong bộ nhớ
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload nhiều ảnh
router.post("/upload", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Map qua tất cả file và upload lên Cloudinary
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
      urls, // Mảng các link ảnh
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;
