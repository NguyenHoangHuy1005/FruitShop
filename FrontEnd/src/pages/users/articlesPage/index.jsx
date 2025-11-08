import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-toastify";
import { AiOutlineArrowRight, AiOutlinePlus } from "react-icons/ai";
import { BiTimeFive } from "react-icons/bi";
import { FaEye } from "react-icons/fa";
import "./style.scss";

const ArticlesPage = () => {
  const [articles, setArticles] = useState([]);
  const [myArticles, setMyArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState("public"); // public, myArticles
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    category: "Mẹo chọn hàng",
    image: "",
  });

  // Dùng Redux thay vì localStorage
  const currentUser = useSelector((state) => state.auth?.login?.currentUser);
  const isLoggedIn = !!currentUser;

  console.log("🔐 Articles Page Auth:", { 
    isLoggedIn, 
    userId: currentUser?._id,
    username: currentUser?.username 
  });

  useEffect(() => {
    fetchPublicArticles();
    if (isLoggedIn) {
      fetchMyArticles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const fetchPublicArticles = async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://localhost:3000/api/article/public");
      if (response.data.success) {
        setArticles(response.data.articles);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyArticles = async () => {
    try {
      const token = currentUser?.accessToken;
      if (!token) {
        console.log("⚠️ No token available for fetchMyArticles");
        return;
      }
      
      const response = await axios.get(
        "http://localhost:3000/api/article/user/my-articles",
        { headers: { token: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setMyArticles(response.data.articles);
      }
    } catch (error) {
      console.error("Error fetching my articles:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoggedIn) {
      toast.error("Vui lòng đăng nhập để đăng bài");
      return;
    }

    if (!formData.title || !formData.content) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const token = currentUser?.accessToken;
      if (!token) {
        toast.error("Vui lòng đăng nhập lại");
        return;
      }
      
      const response = await axios.post(
        "http://localhost:3000/api/article",
        formData,
        { headers: { token: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success(
          currentUser?.admin
            ? "Bài viết đã được đăng"
            : "Bài viết đã được gửi và chờ duyệt"
        );
        setShowCreateForm(false);
        setFormData({
          title: "",
          content: "",
          excerpt: "",
          category: "Mẹo chọn hàng",
          image: "",
        });
        fetchPublicArticles();
        fetchMyArticles();
      }
    } catch (error) {
      console.error("Error creating article:", error);
      toast.error(error.response?.data?.message || "Lỗi khi đăng bài viết");
    }
  };

  const handleDeleteArticle = async (articleId) => {
    if (!window.confirm("Bạn có chắc muốn xóa bài viết này?")) return;

    try {
      const token = currentUser?.accessToken;
      if (!token) {
        toast.error("Vui lòng đăng nhập lại");
        return;
      }
      
      await axios.delete(`http://localhost:3000/api/article/${articleId}`, {
        headers: { token: `Bearer ${token}` },
      });
      toast.success("Đã xóa bài viết");
      fetchMyArticles();
      fetchPublicArticles();
    } catch (error) {
      console.error("Error deleting article:", error);
      toast.error("Lỗi khi xóa bài viết");
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Chờ duyệt",
      approved: "Đã duyệt",
      rejected: "Đã từ chối",
    };
    return labels[status] || status;
  };

  const featured = articles[0];
  const displayArticles = activeTab === "public" ? articles : myArticles;

  return (
    <div className="articles-page">
      <div className="articles-hero">
        <div className="container">
          <div className="hero-content card">
            <span className="hero-tag">Bài viết mới</span>
            <h1>Trái cây sạch cho cuộc sống cân bằng</h1>
            <p>
              Cùng FruitShop khám phá nguồn cảm hứng nấu ăn, mẹo dinh dưỡng và câu chuyện
              mùa vụ để mỗi bữa ăn đều tròn vị và tốt cho sức khỏe.
            </p>
            <button
              className="btn-create-article"
              onClick={() => {
                if (!isLoggedIn) {
                  toast.error("Vui lòng đăng nhập để viết bài");
                  return;
                }
                setShowCreateForm(!showCreateForm);
              }}
            >
              <AiOutlinePlus /> {showCreateForm ? "Đóng form" : "Viết bài mới"}
            </button>
          </div>
          <div className="hero-highlight">
            {featured && <img src={featured.image || "https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=1200&q=80"} alt={featured.title} />}
          </div>
        </div>
      </div>

      <div className="container">
        {showCreateForm && (
          <div className="create-article-form">
            <h2>Viết bài mới</h2>
            <form onSubmit={handleSubmit}>
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
                  onClick={() => setShowCreateForm(false)}
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

        {isLoggedIn && (
          <div className="article-tabs">
            <div className="tabs-buttons">
              <button
                className={activeTab === "public" ? "active" : ""}
                onClick={() => setActiveTab("public")}
              >
                Bài viết công khai ({articles.length})
              </button>
              <button
                className={activeTab === "myArticles" ? "active" : ""}
                onClick={() => setActiveTab("myArticles")}
              >
                Bài viết của tôi ({myArticles.length})
              </button>
            </div>
            <button
              className="btn-create-article-small"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <AiOutlinePlus /> {showCreateForm ? "Đóng form" : "Viết bài mới"}
            </button>
          </div>
        )}

        <section className="latest-section">
          <header className="section-head">
            <h2>{activeTab === "public" ? "Bài viết gần đây" : "Bài viết của tôi"}</h2>
            <p>
              {activeTab === "public"
                ? "Cập nhật thường xuyên các bí quyết chọn lựa, bảo quản và chế biến trái cây."
                : "Quản lý các bài viết bạn đã đăng"}
            </p>
          </header>

          {loading ? (
            <div className="loading">Đang tải...</div>
          ) : displayArticles.length === 0 ? (
            <div className="empty-state">
              {activeTab === "public"
                ? "Chưa có bài viết nào"
                : "Bạn chưa đăng bài viết nào"}
            </div>
          ) : (
            <div className="latest-grid">
              {displayArticles.map((article) => (
                <article key={article._id} className="latest-card">
                  <div className="card-body">
                    <div className="card-header-row">
                      <span className="card-badge">{article.category}</span>
                      {activeTab === "myArticles" && (
                        <span className={`status-badge status-${article.status}`}>
                          {getStatusLabel(article.status)}
                        </span>
                      )}
                    </div>
                    <h3>{article.title}</h3>
                    <p>{article.excerpt || "Chưa có tóm tắt"}</p>
                    <div className="card-meta">
                      <span>
                        <BiTimeFive />{" "}
                        {new Date(article.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                      <span>
                        <FaEye /> {article.views || 0} lượt xem
                      </span>
                    </div>

                    {article.status === "rejected" && article.rejectionReason && (
                      <div className="rejection-reason">
                        <strong>Lý do từ chối:</strong> {article.rejectionReason}
                      </div>
                    )}

                    <div className="card-actions">
                      <Link to={`/articles/${article._id}`} className="card-link">
                        Đọc tiếp <AiOutlineArrowRight />
                      </Link>
                      {activeTab === "myArticles" && (
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteArticle(article._id)}
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ArticlesPage;