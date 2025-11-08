import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import { FaUser, FaClock, FaEye, FaEdit } from "react-icons/fa";
import "./style.scss";

const ArticleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth?.login?.currentUser);
  const isLoggedIn = !!currentUser;
  const userId = currentUser?._id;

  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    category: "",
    image: "",
  });

  useEffect(() => {
    fetchArticleDetail();
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchArticleDetail = async () => {
    setLoading(true);
    try {
      const config = isLoggedIn
        ? { headers: { token: `Bearer ${currentUser.accessToken}` } }
        : {};

      const response = await axios.get(
        `http://localhost:3000/api/article/${id}`,
        config
      );

      if (response.data.success) {
        setArticle(response.data.article);
        setEditFormData({
          title: response.data.article.title,
          content: response.data.article.content,
          excerpt: response.data.article.excerpt,
          category: response.data.article.category,
          image: response.data.article.image,
        });
      }
    } catch (error) {
      console.error("Error fetching article:", error);
      toast.error("Lỗi khi tải bài viết");
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/comment/article/${id}`
      );

      if (response.data.success) {
        setComments(response.data.comments);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!isLoggedIn) {
      toast.error("Vui lòng đăng nhập để bình luận");
      return;
    }

    if (!commentText.trim()) {
      toast.error("Vui lòng nhập nội dung bình luận");
      return;
    }

    setSubmittingComment(true);
    try {
      const response = await axios.post(
        "http://localhost:3000/api/comment",
        {
          articleId: id,
          content: commentText,
        },
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      if (response.data.success) {
        toast.success("Đã gửi bình luận");
        setCommentText("");
        fetchComments();
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
      toast.error(error.response?.data?.message || "Lỗi khi gửi bình luận");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditArticle = async (e) => {
    e.preventDefault();

    if (!editFormData.title || !editFormData.content || !editFormData.image) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const response = await axios.put(
        `http://localhost:3000/api/article/${id}`,
        editFormData,
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      if (response.data.success) {
        toast.success(
          currentUser?.admin
            ? "Đã cập nhật bài viết"
            : "Bài viết đã được gửi và chờ duyệt lại"
        );
        setIsEditing(false);
        fetchArticleDetail();
      }
    } catch (error) {
      console.error("Error updating article:", error);
      toast.error(error.response?.data?.message || "Lỗi khi cập nhật bài viết");
    }
  };

  const canEditArticle = () => {
    if (!article || !currentUser) return false;
    return (
      article.author?._id === userId ||
      article.author === userId ||
      currentUser.admin
    );
  };

  if (loading) {
    return (
      <div className="article-detail-page">
        <div className="container">
          <div className="loading">Đang tải bài viết...</div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="article-detail-page">
        <div className="container">
          <div className="error-message">Không tìm thấy bài viết</div>
        </div>
      </div>
    );
  }

  return (
    <div className="article-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <span onClick={() => navigate("/")} className="clickable">
            Trang chủ
          </span>
          <span className="separator">/</span>
          <span onClick={() => navigate("/articles")} className="clickable">
            Bài viết
          </span>
          <span className="separator">/</span>
          <span className="current">{article.title}</span>
        </div>

        {!isEditing ? (
          <>
            {/* Article Header */}
            <div className="article-header">
              <div className="category-badge">{article.category}</div>
              {article.isViewingDraft && (
                <div className={`version-badge ${article.showingOriginal ? 'version-original' : 'version-draft'}`}>
                  {article.showingOriginal ? '👁️ Phiên bản công khai' : '📝 Bản chỉnh sửa'}
                </div>
              )}
              <h1 className="article-title">{article.title}</h1>

              <div className="article-meta">
                <div className="meta-item">
                  <FaUser />
                  <span>{article.authorName || article.author?.username}</span>
                </div>
                <div className="meta-item">
                  <FaClock />
                  <span>
                    {new Date(article.createdAt).toLocaleDateString("vi-VN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="meta-item">
                  <FaEye />
                  <span>{article.views || 0} lượt xem</span>
                </div>
                <div className="meta-item">
                  <FaClock />
                  <span>{article.readTime}</span>
                </div>
              </div>

              {article.status && article.status !== "approved" && (
                <div className={`status-badge status-${article.status}`}>
                  {article.status === "pending" && "⏳ Chờ duyệt"}
                  {article.status === "rejected" && "❌ Đã từ chối"}
                </div>
              )}

              {article.isViewingDraft && article.originalContent && (
                <div className="draft-notice">
                  <div>
                    📝 Bạn đang xem bản chỉnh sửa chờ duyệt. Người dùng khác vẫn thấy nội dung gốc.
                  </div>
                  <button
                    className="btn-view-public"
                    onClick={() => {
                      // Toggle giữa draft và original
                      setArticle((prev) => {
                        if (prev.showingOriginal) {
                          // Đang xem original, chuyển về draft
                          return {
                            ...prev,
                            title: prev.draftTitle || prev.title,
                            content: prev.draftContent || prev.content,
                            excerpt: prev.draftExcerpt || prev.excerpt,
                            category: prev.draftCategory || prev.category,
                            image: prev.draftImage || prev.image,
                            readTime: prev.draftReadTime || prev.readTime,
                            showingOriginal: false,
                          };
                        } else {
                          // Đang xem draft, chuyển sang original
                          return {
                            ...prev,
                            draftTitle: prev.title,
                            draftContent: prev.content,
                            draftExcerpt: prev.excerpt,
                            draftCategory: prev.category,
                            draftImage: prev.image,
                            draftReadTime: prev.readTime,
                            title: prev.originalContent.title,
                            content: prev.originalContent.content,
                            excerpt: prev.originalContent.excerpt,
                            category: prev.originalContent.category,
                            image: prev.originalContent.image,
                            readTime: prev.originalContent.readTime,
                            showingOriginal: true,
                          };
                        }
                      });
                    }}
                  >
                    {article.showingOriginal ? '📝 Xem bản chỉnh sửa' : '👁️ Xem phiên bản công khai'}
                  </button>
                </div>
              )}

              {article.rejectionReason && (
                <div className="rejection-reason">
                  <strong>Lý do từ chối:</strong> {article.rejectionReason}
                </div>
              )}

              {canEditArticle() && (
                <button
                  className="btn-edit-article"
                  onClick={() => setIsEditing(true)}
                >
                  <FaEdit /> Chỉnh sửa bài viết
                </button>
              )}
            </div>

            {/* Featured Image */}
            {article.image && (
              <div className="article-image">
                <img src={article.image} alt={article.title} />
              </div>
            )}

            {/* Article Content */}
            <div className="article-content">
              {article.excerpt && (
                <div className="article-excerpt">{article.excerpt}</div>
              )}
              <div
                className="article-body"
                dangerouslySetInnerHTML={{
                  __html: article.content.replace(/\n/g, "<br />"),
                }}
              />
            </div>
          </>
        ) : (
          /* Edit Form */
          <div className="edit-article-form">
            <h2>Chỉnh sửa bài viết</h2>
            <form onSubmit={handleEditArticle}>
              <div className="form-group">
                <label>Tiêu đề *</label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Danh mục</label>
                <select
                  value={editFormData.category}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      category: e.target.value,
                    })
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
                  value={editFormData.image}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, image: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Tóm tắt</label>
                <textarea
                  value={editFormData.excerpt}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      excerpt: e.target.value,
                    })
                  }
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label>Nội dung *</label>
                <textarea
                  value={editFormData.content}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      content: e.target.value,
                    })
                  }
                  rows="15"
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsEditing(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-submit">
                  {currentUser?.admin ? "Cập nhật" : "Gửi yêu cầu duyệt"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Comments Section */}
        <div className="comments-section">
          <h2 className="comments-title">
            Bình luận ({comments.length})
          </h2>

          {/* Comment Form */}
          {isLoggedIn ? (
            <form onSubmit={handleSubmitComment} className="comment-form">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Viết bình luận của bạn..."
                rows="4"
                disabled={submittingComment}
              />
              <button
                type="submit"
                className="btn-submit-comment"
                disabled={submittingComment}
              >
                {submittingComment ? "Đang gửi..." : "Gửi bình luận"}
              </button>
            </form>
          ) : (
            <div className="login-prompt">
              <p>Vui lòng đăng nhập để bình luận</p>
              <button
                className="btn-login"
                onClick={() => navigate("/login")}
              >
                Đăng nhập
              </button>
            </div>
          )}

          {/* Comments List */}
          <div className="comments-list">
            {comments.length === 0 ? (
              <p className="no-comments">
                Chưa có bình luận nào. Hãy là người đầu tiên bình luận!
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment._id} className="comment-item">
                  <div className="comment-header">
                    <div className="comment-author">
                      <FaUser className="user-icon" />
                      <span className="author-name">
                        {comment.user?.username || "Người dùng"}
                      </span>
                    </div>
                    <span className="comment-date">
                      {new Date(comment.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <div className="comment-content">{comment.content}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticleDetailPage;
