const router = require("express").Router();
const multer = require("multer");
const bannerController = require("../controllers/bannerController");
const {
  verifyTokenAndAdmin,
} = require("../../auth-services/controllers/middlewareController");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const parseUpload = upload.fields([
  { name: "imageDesktop", maxCount: 1 },
  { name: "imageMobile", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

router.post(
  "/upload",
  verifyTokenAndAdmin,
  parseUpload,
  bannerController.uploadBannerImage
);

router.get("/active", bannerController.getActiveBanners);

router.post("/", verifyTokenAndAdmin, bannerController.createBanner);
router.get("/", verifyTokenAndAdmin, bannerController.getBanners);
router.get("/:id", verifyTokenAndAdmin, bannerController.getBannerById);
router.put("/:id", verifyTokenAndAdmin, bannerController.updateBanner);
router.patch(
  "/:id/status",
  verifyTokenAndAdmin,
  bannerController.updateBannerStatus
);
router.delete("/:id", verifyTokenAndAdmin, bannerController.deleteBanner);

router.post("/:id/view", bannerController.trackBannerView);
router.post("/:id/click", bannerController.trackBannerClick);

module.exports = router;
