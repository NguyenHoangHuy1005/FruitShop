import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import { FaUser, FaClock, FaEye, FaEdit } from "react-icons/fa";
import { BiLike, BiSolidLike, BiDislike, BiSolidDislike } from "react-icons/bi";
import { MdOutlineEmojiEmotions } from "react-icons/md";
import ReactionModal from "../../../component/reactionModal";
import ReactionBar from "../../../component/reactionBar";
import Breadcrumb from "../theme/breadcrumb";
import { uploadImageFile, uploadArticleImage } from "../../../component/redux/apiRequest";
import "./style.scss";
const ArticleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useSelector((state) => state.auth?.login?.currentUser);
  const isLoggedIn = !!currentUser;
  const userId = currentUser?._id;

  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyingToComment, setReplyingToComment] = useState(null); // Comment đang được reply (nested)
  const [showReactionModal, setShowReactionModal] = useState(null); // Modal for emoji + text
  const [isEditing, setIsEditing] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt"); // Thêm state sắp xếp
  // eslint-disable-next-line no-unused-vars
  const [sortOrder, setSortOrder] = useState("desc"); // Thêm thứ tự sắp xếp
  const [editFormData, setEditFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    category: "",
    image: "",
  });
  const [imageUpload, setImageUpload] = useState({
    uploading: false,
    error: "",
  });
  const highlightTimeoutRef = useRef(null);
  const lastScrolledCommentRef = useRef(null);
  const highlightStateClearedRef = useRef(false);
  const [stateHighlightTarget, setStateHighlightTarget] = useState(null);
  const commentInputId = "article-comment-input";

  useEffect(() => {
    if (!isEditing) {
      setImageUpload({ uploading: false, error: "" });
    }
  }, [isEditing]);

  const scrollToElement = useCallback((elementId) => {
    if (!elementId) return false;
    const element = document.getElementById(elementId);
    if (!element) return false;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("highlight-target");

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      element.classList.remove("highlight-target");
      highlightTimeoutRef.current = null;
    }, 3000);

    return true;
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchArticleDetail();
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sortBy, sortOrder]);

  useEffect(() => {
    if (!comments.length) return;

    const params = new URLSearchParams(location.search);
    const commentTarget = params.get("commentId") || params.get("replyId");

    if (!commentTarget || lastScrolledCommentRef.current === commentTarget) return;

    const timer = setTimeout(() => {
      if (scrollToElement(`comment-${commentTarget}`)) {
        lastScrolledCommentRef.current = commentTarget;
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [comments, location.search, scrollToElement]);

  useEffect(() => {
    if (location.state?.highlightTarget) {
      setStateHighlightTarget(location.state.highlightTarget);
      if (!highlightStateClearedRef.current) {
        navigate(
          { pathname: location.pathname, search: location.search, hash: location.hash },
          { replace: true, state: null }
        );
        highlightStateClearedRef.current = true;
      }
    } else {
      highlightStateClearedRef.current = false;
    }
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    if (!comments.length || !stateHighlightTarget?.id) return;

    const targetId = `comment-${stateHighlightTarget.id}`;
    if (scrollToElement(targetId)) {
      lastScrolledCommentRef.current = stateHighlightTarget.id;
      setStateHighlightTarget(null);
    }
  }, [comments, stateHighlightTarget, scrollToElement]);

  useEffect(() => {
    lastScrolledCommentRef.current = null;
  }, [location.search]);

  // Auto-scroll and focus the reply textarea when replyingTo changes
  useEffect(() => {
    if (!replyingTo) return;
    const id = `reply-input-${replyingTo}`;
    // small delay to allow DOM to render the reply form
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          /* ignore scroll errors */
        }
        el.focus && el.focus();
      }
    }, 80);

    return () => clearTimeout(t);
  }, [replyingTo]);

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
        `http://localhost:3000/api/comment/article/${id}?sortBy=${sortBy}&order=${sortOrder}`
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

  const handleSubmitReply = async (commentId) => {
    if (!isLoggedIn) {
      toast.error("Vui lòng đăng nhập để trả lời");
      return;
    }

    if (!replyText.trim()) {
      toast.error("Vui lòng nhập nội dung trả lời");
      return;
    }

    try {
      const payload = {
        articleId: id,
        content: replyText,
        parentCommentId: commentId,
      };

      // Nếu đang reply vào một reply khác (nested)
      if (replyingToComment) {
        payload.mentionedUserId = replyingToComment.user._id;
      }

      const response = await axios.post(
        "http://localhost:3000/api/comment",
        payload,
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      if (response.data.success) {
        toast.success("Đã trả lời bình luận");
        setReplyText("");
        setReplyingTo(null);
        setReplyingToComment(null);
        fetchComments();
      }
    } catch (error) {
      console.error("Error replying to comment:", error);
      toast.error(error.response?.data?.message || "Lỗi khi trả lời");
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!isLoggedIn) {
      toast.error("Vui lòng đăng nhập để thích bình luận");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/comment/${commentId}/like`,
        {},
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      fetchComments();
    } catch (error) {
      console.error("Error liking comment:", error);
    }
  };

  const handleDislikeComment = async (commentId) => {
    if (!isLoggedIn) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/comment/${commentId}/dislike`,
        {},
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      fetchComments();
    } catch (error) {
      console.error("Error disliking comment:", error);
    }
  };

  const handleAddReaction = async (commentId, reactionData) => {
    if (!isLoggedIn) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    try {
      await axios.post(
        `http://localhost:3000/api/comment/${commentId}/reaction`,
        reactionData,
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      setShowReactionModal(null);
      fetchComments();
      toast.success(`Đã phản ứng ${reactionData.icon}`);
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const handleDeleteReaction = async (commentId, targetUserId) => {
    if (!isLoggedIn) return;

    const isOwnReaction = targetUserId === currentUser._id;
    const confirmMessage = isOwnReaction
      ? "Bạn có chắc muốn xóa reaction của mình?"
      : "Bạn có chắc muốn xóa reaction này? (Quyền Admin)";

    if (!window.confirm(confirmMessage)) return;

    try {
      const url = currentUser.admin && targetUserId !== currentUser._id
        ? `http://localhost:3000/api/comment/${commentId}/reaction?targetUserId=${targetUserId}`
        : `http://localhost:3000/api/comment/${commentId}/reaction`;

      await axios.delete(url, {
        headers: { token: `Bearer ${currentUser.accessToken}` },
      });

      toast.success("Đã xóa reaction");
      fetchComments();
    } catch (error) {
      console.error("Error deleting reaction:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa reaction");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!isLoggedIn) return;

    if (!window.confirm("Bạn có chắc muốn xóa bình luận này?")) return;

    try {
      await axios.delete(
        `http://localhost:3000/api/comment/${commentId}`,
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      toast.success("Đã xóa bình luận");
      fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error(error.response?.data?.message || "Lỗi khi xóa");
    }
  };

  const handleHideComment = async (commentId) => {
    if (!isLoggedIn || !currentUser.admin) return;

    try {
      await axios.patch(
        `http://localhost:3000/api/comment/${commentId}/hide`,
        {},
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      toast.success("Đã ẩn bình luận");
      fetchComments();
    } catch (error) {
      console.error("Error hiding comment:", error);
      toast.error("Lỗi khi ẩn bình luận");
    }
  };

  const handleShowComment = async (commentId) => {
    if (!isLoggedIn || !currentUser.admin) return;

    try {
      await axios.patch(
        `http://localhost:3000/api/comment/${commentId}/show`,
        {},
        {
          headers: { token: `Bearer ${currentUser.accessToken}` },
        }
      );

      toast.success("Đã hiển thị bình luận");
      fetchComments();
    } catch (error) {
      console.error("Error showing comment:", error);
      toast.error("Lỗi khi hiển thị bình luận");
    }
  };

  const renderComment = (comment, allComments, depth = 0) => {
    const replies = comment.replies || [];
    const isNested = depth > 0;
    const isLiked = comment.likes?.includes(userId);
    const isDisliked = comment.dislikes?.includes(userId);
    const currentUserReaction = comment.reactions?.find(r =>
      r.user._id === userId || r.user === userId
    );
    const isHidden = comment.status === 'hidden';

    return (
      <div
        key={comment._id}
        id={`comment-${comment._id}`}
        className={`comment-item ${isNested ? 'nested-comment' : ''} ${isHidden ? 'hidden-comment' : ''}`}
        style={{ marginLeft: isNested ? '32px' : '0' }}
      >
        <div className="comment-header">
          <div className="comment-author">
            <FaUser className={isNested ? "user-icon-small" : "user-icon"} />
            <span className="author-name">
              {comment.user?.username || "Người dùng"}
            </span>
          </div>
          <span className="comment-date">
            {new Date(comment.createdAt).toLocaleDateString("vi-VN")}
          </span>
          {isHidden && <span className="hidden-badge">Đã ẩn</span>}
        </div>
        <div className="comment-content">
          {comment.mentionedUser && (
            <span className="mention-tag">
              @{comment.mentionedUser.username}{" "}
            </span>
          )}
          {comment.content}
        </div>

        <ReactionBar
          reactions={comment.reactions || []}
          currentUserId={userId}
          isAdmin={currentUser?.role === 'admin' || currentUser?.admin}
          onDeleteReaction={(targetUserId) => handleDeleteReaction(comment._id, targetUserId)}
        />

        <div className="comment-actions">
          <button
            className={`btn-like-comment ${isLiked ? 'active' : ''}`}
            onClick={() => handleLikeComment(comment._id)}
          >
            {isLiked ? <BiSolidLike /> : <BiLike />}
            <span>{comment.likes?.length || 0}</span>
          </button>

          <button
            className={`btn-dislike-comment ${isDisliked ? 'active' : ''}`}
            onClick={() => handleDislikeComment(comment._id)}
          >
            {isDisliked ? <BiSolidDislike /> : <BiDislike />}
            <span>{comment.dislikes?.length || 0}</span>
          </button>

          <div className="emoji-action">
            <button
              className={`btn-emoji ${currentUserReaction ? 'has-reaction' : ''}`}
              onClick={() => setShowReactionModal(`comment-${comment._id}`)}
            >
              <div className="emoji-with-badge">
                {currentUserReaction ? currentUserReaction.icon : <MdOutlineEmojiEmotions />}
                {currentUserReaction?.comment && <span className="has-comment-dot"></span>}
              </div>
            </button>
          </div>

          {isLoggedIn && (
            <button
              className="btn-reply-comment"
              onClick={() => {
                if (depth === 0) {
                  // Reply trực tiếp comment gốc - không mention
                  setReplyingTo(comment._id);
                  setReplyingToComment(null);
                } else {
                  // Reply vào reply - có mention
                  // Tìm comment gốc để set replyingTo
                  const rootComment = allComments.find(c => !c.parentComment);
                  setReplyingTo(rootComment?._id || comment._id);
                  setReplyingToComment(comment);
                }
                setReplyText("");
              }}
            >
              💬 Trả lời
            </button>
          )}

          {isLoggedIn && (comment.user?._id === userId || currentUser?.role === 'admin') && (
            <button
              className="btn-delete-comment"
              onClick={() => handleDeleteComment(comment._id)}
            >
              🗑️ Xóa
            </button>
          )}

          {isLoggedIn && currentUser?.admin && (
            <>
              {isHidden ? (
                <button
                  className="btn-admin-action btn-show"
                  onClick={() => handleShowComment(comment._id)}
                >
                  👁️ Hiện
                </button>
              ) : (
                <button
                  className="btn-admin-action btn-hide"
                  onClick={() => handleHideComment(comment._id)}
                >
                  🚫 Ẩn
                </button>
              )}
            </>
          )}
        </div>

        <ReactionModal
          show={showReactionModal === `comment-${comment._id}`}
          currentReaction={currentUserReaction}
          onClose={() => setShowReactionModal(null)}
          onSubmit={(data) => handleAddReaction(comment._id, data)}
        />

        {/* Render nested replies */}
        {replies.length > 0 && (
          <div className="nested-comments">
            {replies.map(reply =>
              renderComment(reply, [comment, ...replies], depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const handleEditImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (!/^image\//.test(file.type)) {
      toast.error("Vui lòng chọn đúng định dạng ảnh");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh tối đa 5MB");
      return;
    }

    if (!currentUser?.accessToken) {
      toast.error("Vui lòng đăng nhập lại để tải ảnh");
      return;
    }

    try {
      setImageUpload({ uploading: true, error: "" });
      let uploadedUrl = "";

      if (article?._id) {
        const result = await uploadArticleImage(file, article._id, {
          token: currentUser?.accessToken,
        });
        uploadedUrl = result.image;
        setArticle((prev) => (prev ? { ...prev, image: uploadedUrl } : prev));
      } else {
        uploadedUrl = await uploadImageFile(file, {
          token: currentUser?.accessToken,
        });
      }

      setEditFormData((prev) => ({ ...prev, image: uploadedUrl }));
      toast.success("Đã cập nhật ảnh bìa");
      setImageUpload({ uploading: false, error: "" });
    } catch (error) {
      console.error("Error uploading cover image:", error);
      const message =
        error?.response?.data?.message || error.message || "Upload ảnh thất bại";
      setImageUpload({ uploading: false, error: message });
      toast.error(message);
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
      <>  <Breadcrumb
      paths={[
        { label: "Bài viết", to: "/articles" },
        { label: article.title },
      ]}
    />
      <div className="article-detail-page">
        <div className="container">
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
                    onClick={() => {
                      setImageUpload({ uploading: false, error: "" });
                      setIsEditing(true);
                    }}
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
                  <label>Ảnh bìa *</label>
                  <div className="image-input-field">
                    <input
                      type="url"
                      value={editFormData.image}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, image: e.target.value })
                      }
                      required
                    />
                    <span className="input-divider">hoặc</span>
                    <label
                      className={`upload-btn ${
                        imageUpload.uploading ? "disabled" : ""
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageUpload}
                        disabled={imageUpload.uploading}
                      />
                      {imageUpload.uploading ? "Đang tải..." : "Chọn ảnh"}
                    </label>
                  </div>
                  <small className="helper-text">
                    Dán URL hoặc tải ảnh trực tiếp (tối đa 5MB).
                  </small>
                  {imageUpload.error && (
                    <small className="error-text">{imageUpload.error}</small>
                  )}
                  {editFormData.image && (
                    <div className="image-preview">
                      <img src={editFormData.image} alt="Xem trước ảnh bìa" />
                    </div>
                  )}
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
            <div className="comments-header">
              <h2 className="comments-title">
                Bình luận ({comments.length})
              </h2>
              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="createdAt">Mới nhất</option>
                <option value="likes">Nhiều thích nhất</option>
              </select>
            </div>

            {/* Comment Form */}
            {isLoggedIn ? (
              <form onSubmit={handleSubmitComment} className="comment-form">
                <div className="comment-form__field">
                  <label htmlFor={commentInputId}>Chia sẻ suy nghĩ của bạn</label>
                  <textarea
                    id={commentInputId}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Chia sẻ suy nghĩ của bạn..."
                    rows="4"
                    maxLength={800}
                    disabled={submittingComment}
                  />
                </div>
                <div className="comment-form__footer">
                  <p className="comment-form__hint">
                    Hãy giữ bình luận lịch sự và thân thiện ✨
                  </p>
                  <button
                    type="submit"
                    className="btn-submit-comment"
                    disabled={submittingComment}
                  >
                    {submittingComment ? "Đang gửi..." : "Gửi bình luận"}
                  </button>
                </div>
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
                  <div key={comment._id}>
                    {renderComment(comment, comments, 0)}

                    {/* Reply form cho comment này */}
                    {replyingTo === comment._id && (
                      <div className="reply-form">
                        {replyingToComment && (
                          <div className="replying-to-info">
                            Đang trả lời <strong>@{replyingToComment.user?.username}</strong>
                            <button
                              className="btn-clear-mention"
                              onClick={() => setReplyingToComment(null)}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        <textarea
                          id={`reply-input-${comment._id}`}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={
                            replyingToComment
                              ? `Trả lời @${replyingToComment.user?.username}...`
                              : "Chia sẻ câu trả lời của bạn..."
                          }
                          rows="3"
                          maxLength={600}
                        />
                        <div className="reply-actions">
                          <button
                            className="btn-submit-reply"
                            onClick={() => handleSubmitReply(comment._id)}
                          >
                            Gửi
                          </button>
                          <button
                            type="button"
                            className="btn-cancel-reply"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyingToComment(null);
                              setReplyText("");
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
      </>
      );
};

      export default ArticleDetailPage;
