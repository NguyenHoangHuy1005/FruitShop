const router = require("express").Router();
const reservation = require("../controllers/reservationController");
const { verifyToken } = require("../../auth-services/middlewares/auth");

// Reserve cho cart (10 phút) - không cần auth, dùng sessionKey
router.post("/reserve-cart", reservation.reserveForCart);

// Chuyển sang checkout (10 phút) - không bắt buộc auth, dùng sessionKey hoặc userId
router.post("/confirm-checkout", reservation.confirmForCheckout);

// Confirm khi payment success - không bắt buộc auth
router.post("/confirm-payment", reservation.confirmPayment);

// Release khi payment fail hoặc cancel - không bắt buộc auth
router.post("/release", reservation.releaseReservation);

// Lấy reservation hiện tại - cần auth nếu có user
router.get("/my-reservations", reservation.getMyReservation);

module.exports = router;
