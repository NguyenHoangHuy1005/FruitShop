import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEyeSlash,
  FaTrash,
  FaStar,
  FaPlus,
  FaEdit,
} from "react-icons/fa";
import ReactionBar from "../../../component/reactionBar";
import "./style.scss";

const ContentManagementPage = () => {
  const [activeTab, setActiveTab] = useState("articles");
  const [articles, setArticles] = useState([]);
  const [comments, setComments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Filters
  const [articleFilter, setArticleFilter] = useState("all");
  const [commentFilter, setCommentFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewSortBy, setReviewSortBy] = useState("createdAt");
  const [reviewSortOrder, setReviewSortOrder] = useState("desc");

  // Get admin user from Redux
  const currentUser = useSelector((state) => state.auth?.login?.currentUser);
  const accessToken = currentUser?.accessToken;

  console.log("🔐 Admin Auth:", { 
    isAdmin: currentUser?.admin, 
    hasToken: !!accessToken,
    userId: currentUser?._id 
  });

  // Form data for creating article
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    category: "Mẹo chọn hàng",
    image: "",
  });
  // Edit form state for updating existing articles
  const [editArticle, setEditArticle] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    category: "Mẹo chọn hàng",
    image: "",
  });

  useEffect(() => {
    if (activeTab === "articles") fetchArticles();
    else if (activeTab === "comments") fetchComments();
    else if (activeTab === "reviews") fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, articleFilter, commentFilter, reviewFilter, reviewSortBy, reviewSortOrder]);

  const getAuthHeaders = () => {
    console.log("🔑 Admin Token:", accessToken ? "Token exists" : "No token");
    
    if (!accessToken) {
      toast.error("Vui lòng đăng nhập lại");
      return null;
    }
    
    return { 
      headers: { 
        Authorization: `Bearer ${accessToken}` 
      } 
    };
  };

  // ====== ARTICLES ======
  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (articleFilter !== "all") params.append("status", articleFilter);

      const response = await axios.get(
        `http://localhost:3000/api/article/admin/all?${params.toString()}`,
        getAuthHeaders()
      );

      if (response.data.success) {
        setArticles(response.data.articles);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
      toast.error("Lỗi khi tải danh sách bài viết");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveArticle = async (articleId) => {
    try {
      const response = await axios.patch(
        `http://localhost:3000/api/article/${articleId}/approve`,
        {},
        getAuthHeaders()
      );

      if (response.data.success) {
        toast.success("Đã duyệt bài viết");
        fetchArticles();
      }
    } catch (error) {
      console.error("Error approving article:", error);
      toast.error("Lỗi khi duyệt bài viết");
    }
  };

  const handleRejectArticle = async (articleId, reason) => {
    const rejectionReason = reason || prompt("Lý do từ chối:");
    if (!rejectionReason) return;

    try {
      const response = await axios.patch(
        `http://localhost:3000/api/article/${articleId}/reject`,
        { rejectionReason },
        getAuthHeaders()
      );

      if (response.data.success) {
        toast.success("Đã từ chối bài viết");
        fetchArticles();
      }
    } catch (error) {
      console.error("Error rejecting article:", error);
      toast.error("Lỗi khi từ chối bài viết");
    }
  };

  const handleDeleteArticle = async (articleId) => {
    if (!window.confirm("Bạn có chắc muốn xóa bài viết này?")) return;

    try {
      await axios.delete(
        `http://localhost:3000/api/article/${articleId}`,
        getAuthHeaders()
      );
      toast.success("Đã xóa bài viết");
      fetchArticles();
    } catch (error) {
      console.error("Error deleting article:", error);
      toast.error("Lỗi khi xóa bài viết");
    }
  };

  const handleOpenEdit = (article) => {
    setEditArticle(article);
    setEditFormData({
      title: article.title || "",
      content: article.content || "",
      excerpt: article.excerpt || "",
      category: article.category || "Mẹo chọn hàng",
      image: article.image || "",
    });
    setShowEditForm(true);
    // scroll to top of page so admin sees the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setEditArticle(null);
    setEditFormData({ title: "", content: "", excerpt: "", category: "Mẹo chọn hàng", image: "" });
  };

  const handleUpdateArticle = async (e) => {
    e.preventDefault();

    if (!editArticle) return;

    if (!editFormData.title || !editFormData.content) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      // Try PATCH on the regular article endpoint first
      let response;
      try {
        response = await axios.patch(
          `http://localhost:3000/api/article/${editArticle._id}`,
          editFormData,
          headers
        );
      } catch (err) {
        // If not found or method not allowed, try PUT as a fallback
        if (err.response && (err.response.status === 404 || err.response.status === 405)) {
          try {
            response = await axios.put(
              `http://localhost:3000/api/article/${editArticle._id}`,
              editFormData,
              headers
            );
          } catch (err2) {
            // Final fallback: try admin-scoped update route if backend exposes it
            try {
              response = await axios.patch(
                `http://localhost:3000/api/article/admin/${editArticle._id}`,
                editFormData,
                headers
              );
            } catch (err3) {
              throw err3 || err2 || err;
            }
          }
        } else {
          throw err;
        }
      }

      if (response?.data?.success) {
        toast.success("Bài viết đã được cập nhật");
        setShowEditForm(false);
        setEditArticle(null);
        setEditFormData({ title: "", content: "", excerpt: "", category: "Mẹo chọn hàng", image: "" });
        // refresh admin article list
        fetchArticles();
      } else {
        throw new Error(response?.data?.message || 'Không thể cập nhật bài viết');
      }
    } catch (error) {
      console.error("Error updating article:", error);
      const message = error.response?.data?.message || error.message || "Lỗi khi cập nhật bài viết";
      toast.error(message);
    }
  };

  // ====== COMMENTS ======
  const fetchComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (commentFilter !== "all") params.append("status", commentFilter);

      const response = await axios.get(
        `http://localhost:3000/api/comment/admin/all?${params.toString()}`,
        getAuthHeaders()
      );

      if (response.data.success) {
        setComments(response.data.comments);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast.error("Lỗi khi tải danh sách bình luận");
    } finally {
      setLoading(false);
    }
  };

  const handleHideComment = async (commentId) => {
    const adminNote = prompt("Lý do ẩn bình luận:");
    if (!adminNote) return;

    try {
      await axios.patch(
        `http://localhost:3000/api/comment/${commentId}/hide`,
        { adminNote },
        getAuthHeaders()
      );
      toast.success("Đã ẩn bình luận");
      fetchComments();
    } catch (error) {
      console.error("Error hiding comment:", error);
      toast.error("Lỗi khi ẩn bình luận");
    }
  };

  const handleShowComment = async (commentId) => {
    try {
      await axios.patch(
        `http://localhost:3000/api/comment/${commentId}/show`,
        {},
        getAuthHeaders()
      );
      toast.success("Đã hiển thị bình luận");
      fetchComments();
    } catch (error) {
      console.error("Error showing comment:", error);
      toast.error("Lỗi khi hiển thị bình luận");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Bạn có chắc muốn xóa bình luận này?")) return;

    try {
      await axios.delete(
        `http://localhost:3000/api/comment/${commentId}`,
        getAuthHeaders()
      );
      toast.success("Đã xóa bình luận");
      fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Lỗi khi xóa bình luận");
    }
  };

  const handleDeleteReactionFromComment = async (commentId, targetUserId) => {
    if (!window.confirm("Bạn có chắc muốn xóa reaction này?")) return;

    try {
      const url = `http://localhost:3000/api/comment/${commentId}/reaction?targetUserId=${targetUserId}`;
      await axios.delete(url, getAuthHeaders());
      toast.success("Đã xóa reaction");
      fetchComments();
    } catch (error) {
      console.error("Error deleting reaction:", error);
      toast.error("Lỗi khi xóa reaction");
    }
  };

  const handleDeleteCommentReply = async (parentCommentId, replyId) => {
    if (!window.confirm("Bạn có chắc muốn xóa phản hồi này?")) return;

    try {
      await axios.delete(
        `http://localhost:3000/api/comment/${replyId}`,
        getAuthHeaders()
      );
      toast.success("Đã xóa phản hồi");
      fetchComments();
    } catch (error) {
      console.error("Error deleting reply:", error);
      toast.error("Lỗi khi xóa phản hồi");
    }
  };

  // ====== REVIEWS ======
  const fetchReviews = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (reviewFilter !== "all") params.append("status", reviewFilter);
      params.append("sortBy", reviewSortBy);
      params.append("order", reviewSortOrder);

      const url = `http://localhost:3000/api/review/admin/all?${params.toString()}`;
      console.log("🔍 Fetching reviews from:", url);
      console.log("🔍 Filter:", reviewFilter, "Sort:", reviewSortBy, reviewSortOrder);

      const response = await axios.get(url, headers);

      console.log("📊 Admin Reviews Response:", {
        success: response.data.success,
        reviewsCount: response.data.reviews?.length,
        reviews: response.data.reviews
      });

      if (response.data.success) {
        setReviews(response.data.reviews);
        console.log("✅ Reviews loaded:", response.data.reviews.length);
      } else {
        console.warn("⚠️ Response not successful:", response.data);
      }
    } catch (error) {
      console.error("❌ Error fetching reviews:", error);
      console.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      toast.error(error.response?.data?.message || "Lỗi khi tải danh sách đánh giá");
    } finally {
      setLoading(false);
    }
  };

  const handleHideReview = async (reviewId) => {
    const adminNote = prompt("Lý do ẩn đánh giá:");
    if (!adminNote) return;

    try {
      await axios.patch(
        `http://localhost:3000/api/review/${reviewId}/hide`,
        { adminNote },
        getAuthHeaders()
      );
      toast.success("Đã ẩn đánh giá");
      fetchReviews();
    } catch (error) {
      console.error("Error hiding review:", error);
      toast.error("Lỗi khi ẩn đánh giá");
    }
  };

  const handleShowReview = async (reviewId) => {
    try {
      await axios.patch(
        `http://localhost:3000/api/review/${reviewId}/show`,
        {},
        getAuthHeaders()
      );
      toast.success("Đã hiển thị đánh giá");
      fetchReviews();
    } catch (error) {
      console.error("Error showing review:", error);
      toast.error("Lỗi khi hiển thị đánh giá");
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("Bạn có chắc muốn xóa đánh giá này?")) return;

    try {
      await axios.delete(
        `http://localhost:3000/api/review/${reviewId}`,
        getAuthHeaders()
      );
      toast.success("Đã xóa đánh giá");
      fetchReviews();
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Lỗi khi xóa đánh giá");
    }
  };

  const handleDeleteReactionFromReview = async (reviewId, targetUserId) => {
    if (!window.confirm("Bạn có chắc muốn xóa reaction này?")) return;

    try {
      const url = `http://localhost:3000/api/review/${reviewId}/reaction?targetUserId=${targetUserId}`;
      await axios.delete(url, getAuthHeaders());
      toast.success("Đã xóa reaction");
      fetchReviews();
    } catch (error) {
      console.error("Error deleting reaction:", error);
      toast.error("Lỗi khi xóa reaction");
    }
  };

  const handleDeleteReactionFromReply = async (reviewId, replyId, targetUserId) => {
    if (!window.confirm("Bạn có chắc muốn xóa reaction này?")) return;

    try {
      const url = `http://localhost:3000/api/review/${reviewId}/reply/${replyId}/reaction?targetUserId=${targetUserId}`;
      await axios.delete(url, getAuthHeaders());
      toast.success("Đã xóa reaction");
      fetchReviews();
    } catch (error) {
      console.error("Error deleting reaction:", error);
      toast.error("Lỗi khi xóa reaction");
    }
  };

  const handleDeleteReply = async (reviewId, replyId) => {
    if (!window.confirm("Bạn có chắc muốn xóa phản hồi này?")) return;

    try {
      await axios.delete(
        `http://localhost:3000/api/review/${reviewId}/reply/${replyId}`,
        getAuthHeaders()
      );
      toast.success("Đã xóa phản hồi");
      fetchReviews();
    } catch (error) {
      console.error("Error deleting reply:", error);
      toast.error("Lỗi khi xóa phản hồi");
    }
  };

  const handleSubmitArticle = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.content) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:3000/api/article",
        formData,
        getAuthHeaders()
      );

      if (response.data.success) {
        toast.success("Bài viết đã được đăng thành công");
        setShowCreateForm(false);
        setFormData({
          title: "",
          content: "",
          excerpt: "",
          category: "Mẹo chọn hàng",
          image: "",
        });
        fetchArticles();
      }
    } catch (error) {
      console.error("Error creating article:", error);
      toast.error(error.response?.data?.message || "Lỗi khi đăng bài viết");
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <FaStar
            key={star}
            className={star <= rating ? "star filled" : "star"}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="content-management-page">
      <div className="page-header">
        <h1>Quản lý nội dung</h1>
        {activeTab === "articles" && !showCreateForm && (
          <button
            className="btn-create"
            onClick={() => setShowCreateForm(true)}
          >
            <FaPlus /> Đăng bài viết mới
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="create-article-form">
          <h2>Đăng bài viết mới</h2>
          <form onSubmit={handleSubmitArticle}>
            <div className="form-group">
              <label>Tiêu đề *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Nhập tiêu đề bài viết"
                required
              />
            </div>

            <div className="form-group">
              <label>Danh mục</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              >
                <option value="Mẹo chọn hàng">Mẹo chọn hàng</option>
                <option value="Công thức">Công thức</option>
                <option value="Dinh dưỡng">Dinh dưỡng</option>
                <option value="Cảm hứng">Cảm hứng</option>
                <option value="Tin tức">Tin tức</option>
              </select>
            </div>

            <div className="form-group">
              <label>URL Ảnh bìa *</label>
              <input
                type="url"
                value={formData.image}
                onChange={(e) =>
                  setFormData({ ...formData, image: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
                required
              />
            </div>

            <div className="form-group">
              <label>Tóm tắt</label>
              <textarea
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
                placeholder="Tóm tắt ngắn gọn nội dung bài viết"
                rows="2"
              />
            </div>

            <div className="form-group">
              <label>Nội dung *</label>
              <textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Viết nội dung bài viết..."
                rows="10"
                required
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({
                    title: "",
                    content: "",
                    excerpt: "",
                    category: "Mẹo chọn hàng",
                    image: "",
                  });
                }}
              >
                Hủy
              </button>
              <button type="submit" className="btn-submit">
                Đăng bài
              </button>
            </div>
          </form>
        </div>
      )}

        {showEditForm && (
          <div className="create-article-form">
            <h2>Chỉnh sửa bài viết</h2>
            <form onSubmit={handleUpdateArticle}>
              <div className="form-group">
                <label>Tiêu đề *</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="Nhập tiêu đề bài viết"
                  required
                />
              </div>

              <div className="form-group">
                <label>Danh mục</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                >
                  <option value="Mẹo chọn hàng">Mẹo chọn hàng</option>
                  <option value="Công thức">Công thức</option>
                  <option value="Dinh dưỡng">Dinh dưỡng</option>
                  <option value="Cảm hứng">Cảm hứng</option>
                  <option value="Tin tức">Tin tức</option>
                </select>
              </div>

              <div className="form-group">
                <label>URL Ảnh bìa</label>
                <input
                  type="url"
                  value={editFormData.image}
                  onChange={(e) => setEditFormData({ ...editFormData, image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="form-group">
                <label>Tóm tắt</label>
                <textarea
                  value={editFormData.excerpt}
                  onChange={(e) => setEditFormData({ ...editFormData, excerpt: e.target.value })}
                  placeholder="Tóm tắt ngắn gọn nội dung bài viết"
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label>Nội dung *</label>
                <textarea
                  value={editFormData.content}
                  onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                  placeholder="Viết nội dung bài viết..."
                  rows="10"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={handleCancelEdit}>
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        )}

      <div className="tabs">
        <button
          className={activeTab === "articles" ? "active" : ""}
          onClick={() => setActiveTab("articles")}
        >
          Bài viết ({articles.length})
        </button>
        <button
          className={activeTab === "comments" ? "active" : ""}
          onClick={() => setActiveTab("comments")}
        >
          Bình luận ({comments.length})
        </button>
        <button
          className={activeTab === "reviews" ? "active" : ""}
          onClick={() => setActiveTab("reviews")}
        >
          Đánh giá ({reviews.length})
        </button>
      </div>

      {/* ARTICLES TAB */}
      {activeTab === "articles" && (
        <div className="tab-content">
          <div className="filter-bar">
            <select
              value={articleFilter}
              onChange={(e) => setArticleFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Đã từ chối</option>
            </select>
          </div>

          {loading ? (
            <div className="loading">Đang tải...</div>
          ) : articles.length === 0 ? (
            <div className="empty-state">Không có bài viết nào</div>
          ) : (
            <div className="content-list">
              {articles.map((article) => (
                <div key={article._id} className="content-item">
                  <div className="content-header">
                    <h3>{article.title}</h3>
                    <span className={`status status-${article.status}`}>
                      {article.status === "pending" && "Chờ duyệt"}
                      {article.status === "approved" && "Đã duyệt"}
                      {article.status === "rejected" && "Đã từ chối"}
                    </span>
                  </div>

                  <div className="content-meta">
                    <span>Tác giả: {article.author?.username || "N/A"}</span>
                    <span>
                      Ngày: {new Date(article.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    <span>Lượt xem: {article.views || 0}</span>
                  </div>

                  <p className="content-excerpt">{article.excerpt}</p>

                  {article.status === "rejected" && article.rejectionReason && (
                    <div className="rejection-reason">
                      <strong>Lý do từ chối:</strong> {article.rejectionReason}
                    </div>
                  )}

                  <div className="content-actions">
                    {article.status === "pending" && (
                      <>
                        <button
                          className="btn-approve"
                          onClick={() => handleApproveArticle(article._id)}
                        >
                          <FaCheckCircle /> Duyệt
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => handleRejectArticle(article._id)}
                        >
                          <FaTimesCircle /> Từ chối
                        </button>
                      </>
                    )}
                      {currentUser && article.author && currentUser._id === article.author._id && (
                        <button
                          className="btn-edit"
                          onClick={() => handleOpenEdit(article)}
                        >
                          <FaEdit /> Chỉnh sửa
                        </button>
                      )}
                      <button
                      className="btn-delete"
                      onClick={() => handleDeleteArticle(article._id)}
                    >
                      <FaTrash /> Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMMENTS TAB */}
      {activeTab === "comments" && (
        <div className="tab-content">
          <div className="filter-bar">
            <select
              value={commentFilter}
              onChange={(e) => setCommentFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="active">Hiển thị</option>
              <option value="hidden">Đã ẩn</option>
            </select>
          </div>

          {loading ? (
            <div className="loading">Đang tải...</div>
          ) : comments.length === 0 ? (
            <div className="empty-state">Không có bình luận nào</div>
          ) : (
            <div className="content-list">
              {comments.map((comment) => (
                <div key={comment._id} className="content-item">
                  <div className="content-header">
                    <span>
                      <strong>{comment.user?.username || "Khách"}</strong> - Bài viết: {comment.article?.title || "N/A"}
                    </span>
                    <span className={`status status-${comment.status}`}>
                      {comment.status === "active" ? "Hiển thị" : "Đã ẩn"}
                    </span>
                  </div>

                  <div className="content-meta">
                    <span>
                      Ngày: {new Date(comment.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    <span>👍 {comment.likes?.length || 0}</span>
                    <span>👎 {comment.dislikes?.length || 0}</span>
                  </div>

                  <p className="content-text">{comment.content}</p>

                  {comment.adminNote && (
                    <div className="admin-note">
                      <strong>Ghi chú:</strong> {comment.adminNote}
                    </div>
                  )}

                  {/* Reactions */}
                  {comment.reactions && comment.reactions.length > 0 && (
                    <ReactionBar
                      reactions={comment.reactions}
                      currentUserId={currentUser._id}
                      isAdmin={true}
                      onDeleteReaction={(targetUserId) =>
                        handleDeleteReactionFromComment(comment._id, targetUserId)
                      }
                    />
                  )}

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="replies-section">
                      <h4>Phản hồi ({comment.replies.length})</h4>
                      {comment.replies.map((reply) => (
                        <div key={reply._id} className={`reply-item ${reply.status === 'hidden' ? 'hidden-item' : ''}`}>
                          <div className="reply-header">
                            <strong>{reply.user?.username || "Người dùng"}</strong>
                            <span>{new Date(reply.createdAt).toLocaleDateString("vi-VN")}</span>
                            {reply.status === 'hidden' && <span className="hidden-badge">Đã ẩn</span>}
                          </div>
                          <p className="reply-text">{reply.content}</p>
                          
                          {reply.reactions && reply.reactions.length > 0 && (
                            <ReactionBar
                              reactions={reply.reactions}
                              currentUserId={currentUser._id}
                              isAdmin={true}
                              onDeleteReaction={(targetUserId) =>
                                handleDeleteReactionFromComment(reply._id, targetUserId)
                              }
                            />
                          )}
                          
                          <button 
                            className="btn-delete-small"
                            onClick={() => handleDeleteCommentReply(comment._id, reply._id)}
                          >
                            <FaTrash /> Xóa phản hồi
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="content-actions">
                    {comment.status === "active" ? (
                      <button
                        className="btn-hide"
                        onClick={() => handleHideComment(comment._id)}
                      >
                        <FaEyeSlash /> Ẩn
                      </button>
                    ) : (
                      <button
                        className="btn-show"
                        onClick={() => handleShowComment(comment._id)}
                      >
                        <FaEye /> Hiển thị
                      </button>
                    )}
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteComment(comment._id)}
                    >
                      <FaTrash /> Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REVIEWS TAB */}
      {activeTab === "reviews" && (
        <div className="tab-content">
          <div className="filter-bar">
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="active">Hiển thị</option>
              <option value="hidden">Đã ẩn</option>
            </select>

            <select
              value={reviewSortBy}
              onChange={(e) => setReviewSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="createdAt">Mới nhất</option>
              <option value="rating">Đánh giá</option>
              <option value="likes">Nhiều thích nhất</option>
            </select>

            {reviewSortBy !== "createdAt" && (
              <select
                value={reviewSortOrder}
                onChange={(e) => setReviewSortOrder(e.target.value)}
                className="order-select"
              >
                <option value="desc">
                  {reviewSortBy === "rating" ? "Cao nhất" : "Nhiều nhất"}
                </option>
                <option value="asc">
                  {reviewSortBy === "rating" ? "Thấp nhất" : "Ít nhất"}
                </option>
              </select>
            )}
          </div>

          {loading ? (
            <div className="loading">Đang tải...</div>
          ) : reviews.length === 0 ? (
            <div className="empty-state">Không có đánh giá nào</div>
          ) : (
            <div className="content-list">
              {reviews.map((review) => (
                <div key={review._id} className="content-item">
                  <div className="content-header">
                    <span>
                      <strong>{review.user?.username || "Khách"}</strong> - SP: {review.product?.name || "N/A"}
                    </span>
                    <span className={`status status-${review.status}`}>
                      {review.status === "active" ? "Hiển thị" : "Đã ẩn"}
                    </span>
                  </div>

                  <div className="content-meta">
                    {renderStars(review.rating)}
                    <span>
                      Ngày: {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    <span>👍 {review.likes?.length || 0}</span>
                  </div>

                  <p className="content-text">{review.comment}</p>

                  {review.images && review.images.length > 0 && (
                    <div className="review-images">
                      {review.images.map((img, idx) => (
                        <img key={idx} src={img} alt={`Review ${idx + 1}`} />
                      ))}
                    </div>
                  )}

                  {/* Reactions */}
                  {review.reactions && review.reactions.length > 0 && (
                    <ReactionBar
                      reactions={review.reactions}
                      currentUserId={currentUser._id}
                      isAdmin={true}
                      onDeleteReaction={(targetUserId) =>
                        handleDeleteReactionFromReview(review._id, targetUserId)
                      }
                    />
                  )}

                  {/* Replies */}
                  {review.replies && review.replies.length > 0 && (
                    <div className="replies-section">
                      <h4>Phản hồi ({review.replies.length})</h4>
                      {review.replies.map((reply) => (
                        <div key={reply._id} className={`reply-item ${reply.status === 'hidden' ? 'hidden-item' : ''}`}>
                          <div className="reply-header">
                            <strong>{reply.user?.username || "Người dùng"}</strong>
                            <span>{new Date(reply.createdAt).toLocaleDateString("vi-VN")}</span>
                            {reply.status === 'hidden' && <span className="hidden-badge">Đã ẩn</span>}
                          </div>
                          <p className="reply-text">{reply.comment}</p>
                          
                          {reply.reactions && reply.reactions.length > 0 && (
                            <ReactionBar
                              reactions={reply.reactions}
                              currentUserId={currentUser._id}
                              isAdmin={true}
                              onDeleteReaction={(targetUserId) =>
                                handleDeleteReactionFromReply(review._id, reply._id, targetUserId)
                              }
                            />
                          )}

                          <div className="reply-actions">
                            <button
                              className="btn-delete-small"
                              onClick={() => handleDeleteReply(review._id, reply._id)}
                            >
                              <FaTrash /> Xóa phản hồi
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {review.adminNote && (
                    <div className="admin-note">
                      <strong>Ghi chú:</strong> {review.adminNote}
                    </div>
                  )}

                  <div className="content-actions">
                    {review.status === "active" ? (
                      <button
                        className="btn-hide"
                        onClick={() => handleHideReview(review._id)}
                      >
                        <FaEyeSlash /> Ẩn
                      </button>
                    ) : (
                      <button
                        className="btn-show"
                        onClick={() => handleShowReview(review._id)}
                      >
                        <FaEye /> Hiển thị
                      </button>
                    )}
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteReview(review._id)}
                    >
                      <FaTrash /> Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContentManagementPage;
