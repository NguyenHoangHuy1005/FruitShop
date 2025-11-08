import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import { AiFillStar, AiOutlineStar } from "react-icons/ai";
import { BiLike, BiSolidLike } from "react-icons/bi";
import "./style.scss";

const ProductReviews = ({ productId }) => {
  const user = useSelector((state) => state.auth?.login?.currentUser);
  const [reviews, setReviews] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [userOrders, setUserOrders] = useState([]);
  const [editingReview, setEditingReview] = useState(null); // Review đang chỉnh sửa
  const [reviewForm, setReviewForm] = useState({
    orderId: "",
    rating: 5,
    comment: "",
    images: [],
  });

  useEffect(() => {
    fetchReviews();
    if (user?.accessToken) {
      checkCanReview();
    }
  }, [productId, user?.accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:3000/api/review/product/${productId}`
      );

      console.log("📊 Review Response:", response.data);

      if (response.data.success) {
        setReviews(response.data.reviews);
        setStatistics(response.data.statistics);
        console.log("✅ Statistics:", response.data.statistics);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkCanReview = async () => {
    if (!user?.accessToken) return;

    try {
      // Fetch user orders with this product
      const ordersResponse = await axios.get(
        `http://localhost:3000/api/order/me`,
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      // Lọc các đơn hàng đã thanh toán (paid) và có chứa sản phẩm này
      const paidOrders = ordersResponse.data.filter(
        (order) =>
          order.status === "paid" &&
          order.items?.some((item) => {
            const itemProductId = item.product?._id || item.product;
            return String(itemProductId) === String(productId);
          })
      );

      setUserOrders(paidOrders);
      setCanReview(paidOrders.length > 0);
    } catch (error) {
      console.error("Error checking review eligibility:", error);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();

    if (!reviewForm.orderId && !editingReview) {
      toast.error("Vui lòng chọn đơn hàng");
      return;
    }

    if (!user?.accessToken) {
      toast.error("Vui lòng đăng nhập để đánh giá");
      return;
    }

    try {
      let response;
      
      if (editingReview) {
        // Cập nhật review
        response = await axios.put(
          `http://localhost:3000/api/review/${editingReview._id}`,
          {
            rating: reviewForm.rating,
            comment: reviewForm.comment,
            images: reviewForm.images,
          },
          {
            headers: { Authorization: `Bearer ${user.accessToken}` },
          }
        );
      } else {
        // Tạo mới review
        response = await axios.post(
          `http://localhost:3000/api/review`,
          {
            productId,
            ...reviewForm,
          },
          {
            headers: { Authorization: `Bearer ${user.accessToken}` },
          }
        );
      }

      if (response.data.success) {
        toast.success(editingReview ? "Đã cập nhật đánh giá" : "Đánh giá của bạn đã được gửi");
        setShowReviewForm(false);
        setEditingReview(null);
        setReviewForm({
          orderId: "",
          rating: 5,
          comment: "",
          images: [],
        });
        
        console.log("✅ Review saved:", response.data.review);
        
        // Fetch lại reviews sau khi tạo thành công
        setTimeout(() => {
          fetchReviews();
          checkCanReview();
        }, 500);
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error(error.response?.data?.message || "Lỗi khi gửi đánh giá");
    }
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
    setReviewForm({
      orderId: review.order,
      rating: review.rating,
      comment: review.comment || "",
      images: review.images || [],
    });
    setShowReviewForm(true);
  };

  const handleCancelEdit = () => {
    setEditingReview(null);
    setShowReviewForm(false);
    setReviewForm({
      orderId: "",
      rating: 5,
      comment: "",
      images: [],
    });
  };

  const handleLikeReview = async (reviewId) => {
    if (!user?.accessToken) {
      toast.error("Vui lòng đăng nhập để thích đánh giá");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/review/${reviewId}/like`,
        {},
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      fetchReviews();
    } catch (error) {
      console.error("Error liking review:", error);
    }
  };

  const renderStars = (rating, interactive = false, onSelect = null) => {
    return (
      <div className={`stars ${interactive ? "interactive" : ""}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            onClick={() => interactive && onSelect && onSelect(star)}
            style={{ cursor: interactive ? "pointer" : "default" }}
          >
            {star <= rating ? (
              <AiFillStar className="star filled" />
            ) : (
              <AiOutlineStar className="star" />
            )}
          </span>
        ))}
      </div>
    );
  };

  const renderRatingBar = (count, total) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <div className="rating-bar">
        <div className="bar-fill" style={{ width: `${percentage}%` }}></div>
      </div>
    );
  };

  return (
    <div className="product-reviews">
      <h2>Đánh giá sản phẩm</h2>

      {statistics && (
        <div className="review-summary">
          <div className="average-rating">
            <div className="rating-number">{statistics.averageRating.toFixed(1)}</div>
            {renderStars(Math.round(statistics.averageRating))}
            <div className="total-reviews">{statistics.totalReviews} đánh giá</div>
          </div>

          <div className="rating-distribution">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="rating-row">
                <span className="star-label">{star} sao</span>
                {renderRatingBar(
                  statistics[`rating${star}`],
                  statistics.totalReviews
                )}
                <span className="count">{statistics[`rating${star}`]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canReview && !showReviewForm && (
        <button
          className="btn-write-review"
          onClick={() => setShowReviewForm(true)}
        >
          Viết đánh giá
        </button>
      )}

      {showReviewForm && (
        <form className="review-form" onSubmit={handleSubmitReview}>
          <h3>{editingReview ? "Chỉnh sửa đánh giá" : "Viết đánh giá của bạn"}</h3>

          {!editingReview && (
            <div className="form-group">
              <label>Chọn đơn hàng:</label>
              <select
                value={reviewForm.orderId}
                onChange={(e) =>
                  setReviewForm({ ...reviewForm, orderId: e.target.value })
                }
                required
              >
                <option value="">-- Chọn đơn hàng --</option>
                {userOrders.map((order) => (
                  <option key={order._id} value={order._id}>
                    Đơn hàng #{order._id.slice(-6)} - {new Date(order.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Đánh giá:</label>
            {renderStars(reviewForm.rating, true, (rating) =>
              setReviewForm({ ...reviewForm, rating })
            )}
          </div>

          <div className="form-group">
            <label>Nhận xét:</label>
            <textarea
              value={reviewForm.comment}
              onChange={(e) =>
                setReviewForm({ ...reviewForm, comment: e.target.value })
              }
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..."
              rows="4"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancelEdit}
            >
              Hủy
            </button>
            <button type="submit" className="btn-submit">
              {editingReview ? "Cập nhật" : "Gửi đánh giá"}
            </button>
          </div>
        </form>
      )}

      <div className="reviews-list">
        {loading ? (
          <div className="loading">Đang tải...</div>
        ) : reviews.length === 0 ? (
          <div className="empty-state">Chưa có đánh giá nào</div>
        ) : (
          reviews.map((review) => (
            <div key={review._id} className="review-item">
              <div className="review-header">
                <div className="user-info">
                  <strong>{review.user?.username || "Khách hàng"}</strong>
                  <div className="review-meta">
                    {renderStars(review.rating)}
                    <span className="date">
                      {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="review-content">
                <p>{review.comment}</p>

                {review.images && review.images.length > 0 && (
                  <div className="review-images">
                    {review.images.map((img, idx) => (
                      <img key={idx} src={img} alt={`Review ${idx + 1}`} />
                    ))}
                  </div>
                )}
              </div>

              <div className="review-actions">
                <button
                  className="btn-like"
                  onClick={() => handleLikeReview(review._id)}
                >
                  {review.likes?.length > 0 ? (
                    <BiSolidLike />
                  ) : (
                    <BiLike />
                  )}
                  <span>{review.likes?.length || 0}</span>
                </button>
                
                {user && review.user?._id === user._id && (
                  <button
                    className="btn-edit-review"
                    onClick={() => handleEditReview(review)}
                  >
                    ✏️ Chỉnh sửa
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProductReviews;
