import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import { AiFillStar, AiOutlineStar } from "react-icons/ai";
import { BiLike, BiSolidLike, BiDislike, BiSolidDislike } from "react-icons/bi";
import { MdOutlineEmojiEmotions } from "react-icons/md";
import ReactionModal from "../reactionModal";
import ReactionBar from "../reactionBar";
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
  const [replyingTo, setReplyingTo] = useState(null); // Review đang trả lời
  const [replyText, setReplyText] = useState(""); // Nội dung trả lời
  const [replyingToReply, setReplyingToReply] = useState(null); // Reply đang được trả lời (nested)
  const [showReactionModal, setShowReactionModal] = useState(null); // {type: 'review'|'reply', id: string}
  const [sortBy, setSortBy] = useState("createdAt"); // Sắp xếp
  const [reviewForm, setReviewForm] = useState({
    orderId: "",
    rating: 5,
    comment: "",
    images: [],
  });
  const reviewFormRef = useRef(null);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingReplyText, setEditingReplyText] = useState("");

  useEffect(() => {
    fetchReviews();
    if (user?.accessToken) {
      checkCanReview();
    }
  }, [productId, user?.accessToken, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user opens a reply box for a review, scroll it into view and focus the textarea.
  useEffect(() => {
    if (!replyingTo) return;

    // If replying to a nested reply, target that reply's input. Otherwise target the review-level input.
    const targetId = replyingToReply ? `reply-input-${replyingToReply._id}` : `reply-input-${replyingTo}`;
    // small timeout to allow DOM to render the reply form
    const t = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        if (typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        el.focus();
      }
    }, 80);

    return () => clearTimeout(t);
  }, [replyingTo, replyingToReply]);

  // If navigation provided a highlightTarget (from notifications), scroll to it and highlight briefly.
  const { state } = useLocation();
  useEffect(() => {
    const target = state?.highlightTarget;
    if (!target) return;

    // Retry loop: try to find the element several times (useful when data loads async)
    let attempts = 0;
    const maxAttempts = 8; // ~8 * 300ms = 2400ms max wait
    const intervalMs = 300;

    const tryScroll = () => {
      attempts += 1;
      const el = document.getElementById(`${target.type}-${target.id}`);
      if (el) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          // ignore
        }
        el.classList.add("highlight-target");
        setTimeout(() => el.classList.remove("highlight-target"), 2200);
        return true;
      }
      return false;
    };

    // first immediate attempt
    if (tryScroll()) return;

    const id = setInterval(() => {
      if (tryScroll() || attempts >= maxAttempts) {
        clearInterval(id);
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [state?.highlightTarget, reviews]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:3000/api/review/product/${productId}?sortBy=${sortBy}&order=desc`
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

      // Lọc đơn hoàn tất có sản phẩm này
      const eligibleOrders = ordersResponse.data.filter(
        (order) =>
          order.status === "completed" &&
          order.items?.some((item) => {
            const itemProductId = item.product?._id || item.product;
            return String(itemProductId) === String(productId);
          })
      );

      setUserOrders(eligibleOrders);
      setCanReview(eligibleOrders.length > 0);
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
    setTimeout(() => {
      if (reviewFormRef.current) {
        reviewFormRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
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

  const handleDislikeReview = async (reviewId) => {
    if (!user?.accessToken) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/review/${reviewId}/dislike`,
        {},
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      fetchReviews();
    } catch (error) {
      console.error("Error disliking review:", error);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!user?.accessToken) return;
    if (!window.confirm("Bạn có chắc muốn xóa đánh giá này? Toàn bộ phản hồi cũng sẽ bị xóa.")) return;
    try {
      await axios.delete(`http://localhost:3000/api/review/${reviewId}`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      toast.success("Đã xóa đánh giá");
      setEditingReview(null);
      fetchReviews();
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa đánh giá");
    }
  };

  const handleAddReaction = async (reviewId, reactionData) => {
    if (!user?.accessToken) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/review/${reviewId}/reaction`,
        reactionData,
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      setShowReactionModal(null);
      fetchReviews();
      toast.success(`Đã phản ứng ${reactionData.icon}`);
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const handleDeleteReaction = async (reviewId, targetUserId) => {
    if (!user?.accessToken) return;

    const isOwnReaction = targetUserId === user._id;
    const confirmMessage = isOwnReaction 
      ? "Bạn có chắc muốn xóa reaction của mình?"
      : "Bạn có chắc muốn xóa reaction này? (Quyền Admin)";

    if (!window.confirm(confirmMessage)) return;

    try {
      const url = user.admin && targetUserId !== user._id
        ? `http://localhost:3000/api/review/${reviewId}/reaction?targetUserId=${targetUserId}`
        : `http://localhost:3000/api/review/${reviewId}/reaction`;

      await axios.delete(url, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });

      toast.success("Đã xóa reaction");
      fetchReviews();
    } catch (error) {
      console.error("Error deleting reaction:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa reaction");
    }
  };

  const handleDeleteReactionFromReply = async (reviewId, replyId, targetUserId) => {
    if (!user?.accessToken) return;

    const isOwnReaction = targetUserId === user._id;
    const confirmMessage = isOwnReaction 
      ? "Bạn có chắc muốn xóa reaction của mình?"
      : "Bạn có chắc muốn xóa reaction này? (Quyền Admin)";

    if (!window.confirm(confirmMessage)) return;

    try {
      const url = user.admin && targetUserId !== user._id
        ? `http://localhost:3000/api/review/${reviewId}/reply/${replyId}/reaction?targetUserId=${targetUserId}`
        : `http://localhost:3000/api/review/${reviewId}/reply/${replyId}/reaction`;

      await axios.delete(url, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });

      toast.success("Đã xóa reaction");
      fetchReviews();
    } catch (error) {
      console.error("Error deleting reaction:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa reaction");
    }
  };

  const handleReplySubmit = async (reviewId) => {
    if (!user?.accessToken) {
      toast.error("Vui lòng đăng nhập để trả lời");
      return;
    }

    if (!replyText.trim()) {
      toast.error("Vui lòng nhập nội dung trả lời");
      return;
    }

    try {
      const payload = { comment: replyText };
      
      // Nếu đang reply vào một reply khác (nested reply)
      if (replyingToReply) {
        payload.parentReplyId = replyingToReply._id;
        const mentionId = replyingToReply.user?._id || replyingToReply.user;
        if (mentionId) {
          payload.mentionedUserId = mentionId;
        }
      }

      const response = await axios.post(
        `http://localhost:3000/api/review/${reviewId}/reply`,
        payload,
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      if (response.data.success) {
        toast.success("Đã trả lời đánh giá");
        setReplyingTo(null);
        setReplyingToReply(null);
        setReplyText("");
        setEditingReplyId(null);
        setEditingReplyText("");
        fetchReviews();
      }
    } catch (error) {
      console.error("Error replying:", error);
      toast.error(error.response?.data?.message || "Lỗi khi trả lời");
    }
  };

  const handleLikeReply = async (reviewId, replyId) => {
    if (!user?.accessToken) {
      toast.error("Vui lòng đăng nhập để thích");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/review/${reviewId}/reply/${replyId}/like`,
        {},
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      fetchReviews();
    } catch (error) {
      console.error("Error liking reply:", error);
    }
  };

  const handleDislikeReply = async (reviewId, replyId) => {
    if (!user?.accessToken) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/review/${reviewId}/reply/${replyId}/dislike`,
        {},
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      fetchReviews();
    } catch (error) {
      console.error("Error disliking reply:", error);
    }
  };

  const handleAddReactionToReply = async (reviewId, replyId, reactionData) => {
    if (!user?.accessToken) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/review/${reviewId}/reply/${replyId}/reaction`,
        reactionData,
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      setShowReactionModal(null);
      fetchReviews();
      toast.success(`Đã phản ứng ${reactionData.icon}`);
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const handleHideReply = async (reviewId, replyId) => {
    if (!user?.accessToken || !user.admin) return;

    try {
      await axios.patch(
        `http://localhost:3000/api/review/${reviewId}/reply/${replyId}/hide`,
        {},
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      toast.success("Đã ẩn câu trả lời");
      fetchReviews();
    } catch (error) {
      console.error("Error hiding reply:", error);
      toast.error("Lỗi khi ẩn câu trả lời");
    }
  };

  const handleShowReply = async (reviewId, replyId) => {
    if (!user?.accessToken || !user.admin) return;

    try {
      await axios.patch(
        `http://localhost:3000/api/review/${reviewId}/reply/${replyId}/show`,
        {},
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      toast.success("Đã hiển thị câu trả lời");
      fetchReviews();
    } catch (error) {
      console.error("Error showing reply:", error);
      toast.error("Lỗi khi hiển thị câu trả lời");
    }
  };

  const handleDeleteReply = async (reviewId, replyId) => {
    if (!user?.accessToken) return;

    if (!window.confirm("Bạn có chắc muốn xóa câu trả lời này?")) return;

    try {
      const response = await axios.delete(
        `http://localhost:3000/api/review/${reviewId}/reply/${replyId}`,
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );

      if (response.data.success) {
        toast.success("Đã xóa câu trả lời");
        setReplyingTo(null);
        setReplyingToReply(null);
        setEditingReplyId(null);
        fetchReviews();
      }
    } catch (error) {
      console.error("Error deleting reply:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa");
    }
  };

  const startEditReply = (reply) => {
    setEditingReplyId(reply._id);
    setEditingReplyText(reply.comment || "");
    setReplyingTo(null);
    setReplyingToReply(null);
    setReplyText("");
    setTimeout(() => {
      const el = document.getElementById(`edit-reply-${reply._id}`);
      if (el?.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
    }, 50);
  };

  const handleUpdateReply = async (reviewId, replyId) => {
    if (!user?.accessToken) return;
    const trimmed = (editingReplyText || "").trim();
    if (!trimmed) {
      toast.error("Nội dung không được để trống");
      return;
    }
    try {
      await axios.patch(
        `http://localhost:3000/api/review/${reviewId}/reply/${replyId}`,
        { comment: trimmed },
        { headers: { Authorization: `Bearer ${user.accessToken}` } }
      );
      toast.success("Đã cập nhật trả lời");
      setEditingReplyId(null);
      setEditingReplyText("");
      fetchReviews();
    } catch (error) {
      console.error("Error updating reply:", error);
      toast.error(error.response?.data?.message || "Lỗi khi cập nhật trả lời");
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

  const renderReply = (reply, reviewId, allReplies, depth = 0) => {
    const nestedReplies = allReplies.filter(r => r.parentReply === reply._id);
    const isNested = depth > 0;
    const isLiked = reply.likes?.includes(user?._id);
    const isDisliked = reply.dislikes?.includes(user?._id);
    const currentUserReaction = reply.reactions?.find(r => 
      r.user._id === user?._id || r.user === user?._id
    );
    const isHidden = reply.status === 'hidden';
    const authorName = reply.user?.username || reply.userName || reply.user?.email || "Người dùng";
    const mentionedName = reply.mentionedUser?.username || reply.mentionedUserName || reply.mentionedUser?.email || "";
    const isEditing = editingReplyId === reply._id;
    const canManageReply = !!user && (reply.user?._id === user._id || reply.user === user._id || user?.admin);
    const isReplyingHere = replyingTo === reviewId && replyingToReply && replyingToReply._id === reply._id;

    return (
      <div 
        id={`reply-${reply._id}`}
        key={reply._id} 
        className={`reply-item ${isNested ? 'nested-reply' : ''} ${isHidden ? 'hidden-reply' : ''}`}
        style={{ marginLeft: isNested ? '32px' : '0' }}
      >
        <div className="reply-header">
          <strong>{authorName}</strong>
          <span className="reply-date">
            {new Date(reply.createdAt).toLocaleDateString("vi-VN")}
          </span>
          {isHidden && <span className="hidden-badge">Đã ẩn</span>}
          {depth === 0 && (
            <span className="replying-to-badge">
              💬 Đang trả lời đánh giá
            </span>
          )}
        </div>
        <p className="reply-content">
          {reply.mentionedUser && (
            <span className="mention-tag">
              @{mentionedName}{" "}
            </span>
          )}
          {reply.comment}
        </p>
        
        <ReactionBar 
          reactions={reply.reactions || []} 
          currentUserId={user?._id}
          isAdmin={user?.admin}
          onDeleteReaction={(targetUserId) => handleDeleteReactionFromReply(reviewId, reply._id, targetUserId)}
        />
        
        <div className="reply-actions">
          <button
            className={`btn-like-reply ${isLiked ? 'active' : ''}`}
            onClick={() => handleLikeReply(reviewId, reply._id)}
          >
            {isLiked ? <BiSolidLike /> : <BiLike />}
            <span>{reply.likes?.length || 0}</span>
          </button>

          <button
            className={`btn-dislike-reply ${isDisliked ? 'active' : ''}`}
            onClick={() => handleDislikeReply(reviewId, reply._id)}
          >
            {isDisliked ? <BiSolidDislike /> : <BiDislike />}
            <span>{reply.dislikes?.length || 0}</span>
          </button>

          <div className="emoji-action">
            <button
              className={`btn-emoji ${currentUserReaction ? 'has-reaction' : ''}`}
              onClick={() => setShowReactionModal(`reply-${reply._id}`)}
            >
              <div className="emoji-with-badge">
                {currentUserReaction ? currentUserReaction.icon : <MdOutlineEmojiEmotions />}
                {currentUserReaction?.comment && <span className="has-comment-dot"></span>}
              </div>
            </button>
          </div>

          {user && (
            <button
              className="btn-reply-to-reply"
              onClick={() => {
                setReplyingTo(reviewId);
                setReplyingToReply(reply);
                setReplyText("");
                setEditingReplyId(null);
              }}
            >
              💬 Trả lời
            </button>
          )}

          {canManageReply && (
            <button
              className={`btn-edit-reply ${isEditing ? 'active' : ''}`}
              onClick={() => {
                if (isEditing) {
                  setEditingReplyId(null);
                  setEditingReplyText("");
                } else {
                  startEditReply(reply);
                }
              }}
            >
              ✏️ {isEditing ? "Đang sửa" : "Chỉnh sửa"}
            </button>
          )}

          {canManageReply && (
            <button
              className="btn-delete-reply"
              onClick={() => handleDeleteReply(reviewId, reply._id)}
            >
              🗑️ Xóa
            </button>
          )}

          {user?.admin && (
            <>
              {isHidden ? (
                <button
                  className="btn-admin-action btn-show"
                  onClick={() => handleShowReply(reviewId, reply._id)}
                >
                  👁️ Hiện
                </button>
              ) : (
                <button
                  className="btn-admin-action btn-hide"
                  onClick={() => handleHideReply(reviewId, reply._id)}
                >
                  🚫 Ẩn
                </button>
              )}
            </>
          )}
        </div>

        {isEditing && (
          <div className="edit-reply-form">
            <textarea
              id={`edit-reply-${reply._id}`}
              value={editingReplyText}
              onChange={(e) => setEditingReplyText(e.target.value)}
              placeholder="Cập nhật nội dung trả lời..."
              rows="3"
            />
            <div className="edit-reply-actions">
              <button
                type="button"
                className="btn-cancel-edit"
                onClick={() => {
                  setEditingReplyId(null);
                  setEditingReplyText("");
                }}
              >
                Hủy
              </button>
              <button
                className="btn-save-edit"
                onClick={() => handleUpdateReply(reviewId, reply._id)}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        )}

        {/* If the user is replying specifically to this reply, show the inline reply form here */}
        {isReplyingHere && (
          <div className="reply-form" style={{ marginTop: 12 }}>
            <div className="replying-to-info">
              Đang trả lời <strong>@{authorName}</strong>
              <button
                className="btn-clear-mention"
                onClick={() => setReplyingToReply(null)}
              >
                ✕
              </button>
            </div>
            <textarea
              id={`reply-input-${reply._id}`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Trả lời @${authorName}...`}
              rows="3"
            />
            <div className="reply-actions">
              <button
                type="button"
                className="btn-cancel-reply"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyingToReply(null);
                  setReplyText("");
                }}
              >
                Hủy
              </button>

              <button
                className="btn-submit-reply"
                onClick={() => handleReplySubmit(reviewId)}
              >
                Gửi
              </button>
            </div>
          </div>
        )}

        {/* Render nested replies recursively */}
        {nestedReplies.length > 0 && (
          <div className="nested-replies">
            {nestedReplies.map(nestedReply => 
              renderReply(nestedReply, reviewId, allReplies, depth + 1)
            )}
          </div>
        )}

        {/* Reaction Modal for this reply */}
        <ReactionModal
          show={showReactionModal === `reply-${reply._id}`}
          currentReaction={currentUserReaction}
          onClose={() => setShowReactionModal(null)}
          onSubmit={(data) => handleAddReactionToReply(reviewId, reply._id, data)}
        />
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
        <form className="review-form" ref={reviewFormRef} onSubmit={handleSubmitReview}>
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
        <div className="reviews-header">
          <h3>Tất cả đánh giá ({reviews.length})</h3>
          <select 
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="createdAt">Mới nhất</option>
            <option value="rating">Đánh giá cao nhất</option>
            <option value="likes">Nhiều thích nhất</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Đang tải...</div>
        ) : reviews.length === 0 ? (
          <div className="empty-state">Chưa có đánh giá nào</div>
        ) : (
          reviews.map((review, reviewIndex) => {
            const isLiked = review.likes?.includes(user?._id);
            const isDisliked = review.dislikes?.includes(user?._id);
            const currentUserReaction = review.reactions?.find(r => 
              r.user._id === user?._id || r.user === user?._id
            );

            return (
            <div id={`review-${review._id}`} key={review._id} className="review-item">
              <div className="review-header">
                <div className="user-info">
                  <span className="review-number">#{reviewIndex + 1}</span>
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

              <ReactionBar 
                reactions={review.reactions || []} 
                currentUserId={user?._id}
                isAdmin={user?.admin}
                onDeleteReaction={(targetUserId) => handleDeleteReaction(review._id, targetUserId)}
              />

              <div className="review-actions">
                <button
                  className={`btn-like ${isLiked ? 'active' : ''}`}
                  onClick={() => handleLikeReview(review._id)}
                >
                  {isLiked ? <BiSolidLike /> : <BiLike />}
                  <span>{review.likes?.length || 0}</span>
                </button>

                <button
                  className={`btn-dislike ${isDisliked ? 'active' : ''}`}
                  onClick={() => handleDislikeReview(review._id)}
                >
                  {isDisliked ? <BiSolidDislike /> : <BiDislike />}
                  <span>{review.dislikes?.length || 0}</span>
                </button>

                <div className="emoji-action">
                  <button
                    className={`btn-emoji ${currentUserReaction ? 'has-reaction' : ''}`}
                    onClick={() => setShowReactionModal(`review-${review._id}`)}
                  >
                    <div className="emoji-with-badge">
                      {currentUserReaction ? currentUserReaction.icon : <MdOutlineEmojiEmotions />}
                      {currentUserReaction?.comment && <span className="has-comment-dot"></span>}
                    </div>
                  </button>
                </div>
                
                {user && review.user?._id === user._id && (
                  <>
                    <button
                      className="btn-edit-review"
                      onClick={() => handleEditReview(review)}
                    >
                      ✏️ Chỉnh sửa
                    </button>
                    <button
                      className="btn-delete-review"
                      onClick={() => handleDeleteReview(review._id)}
                    >
                      🗑 Xóa
                    </button>
                  </>
                )}
                {user?.admin && review.user?._id !== user._id && (
                  <button
                    className="btn-delete-review"
                    onClick={() => handleDeleteReview(review._id)}
                  >
                    🗑 Xóa (Admin)
                  </button>
                )}

                {user && (
                  <button
                    className="btn-reply"
                    onClick={() => {
                      if (replyingTo === review._id) {
                        setReplyingTo(null);
                        setReplyingToReply(null);
                        setReplyText("");
                      } else {
                        setReplyingTo(review._id);
                        setReplyingToReply(null);
                        setEditingReplyId(null);
                        setEditingReplyText("");
                      }
                    }}
                  >
                    💬 {replyingTo === review._id ? "Hủy" : "Trả lời"}
                  </button>
                )}
              </div>

              {replyingTo === review._id && !replyingToReply && (
                <div className="reply-form">
                  {replyingToReply && (
                    <div className="replying-to-info">
                      Đang trả lời <strong>@{replyingToReply.user?.username}</strong>
                      <button 
                        className="btn-clear-mention"
                        onClick={() => setReplyingToReply(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <textarea
                    id={`reply-input-${review._id}`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={replyingToReply ? `Trả lời @${replyingToReply.user?.username}...` : "Nhập câu trả lời của bạn..."}
                    rows="3"
                  />
                  <div className="reply-actions">
                    <button
                      type="button"
                      className="btn-cancel-reply"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyingToReply(null);
                        setReplyText("");
                      }}
                    >
                      Hủy
                    </button>

                    <button
                      className="btn-submit-reply"
                      onClick={() => handleReplySubmit(review._id)}
                    >
                      Gửi
                    </button>
                  </div>
                </div>
              )}

              {review.replies && review.replies.length > 0 && (
                <div className="replies-section">
                  <h4>Câu trả lời ({review.replies.length})</h4>
                  {review.replies
                    .filter(reply => !reply.parentReply) // Chỉ hiển thị replies gốc
                    .map((reply) => (
                      <div key={reply._id}>
                        {renderReply(reply, review._id, review.replies, 0)}
                      </div>
                    ))}
                </div>
              )}

              <ReactionModal
                show={showReactionModal === `review-${review._id}`}
                currentReaction={currentUserReaction}
                onClose={() => setShowReactionModal(null)}
                onSubmit={(data) => handleAddReaction(review._id, data)}
              />
            </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProductReviews;
