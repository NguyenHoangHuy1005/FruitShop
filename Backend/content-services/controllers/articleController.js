const Article = require("../models/Article");
const { createNotification } = require("../../auth-services/controllers/notificationController");

const articleController = {
  createArticle: async (req, res) => {
    try {
      const { title, content, excerpt, category, image, readTime } = req.body;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const status = isAdmin ? "approved" : "pending";

      const newArticle = new Article({
        title,
        content,
        excerpt,
        category,
        image,
        author: userId,
        authorName: req.user.username || req.user.email,
        status,
        readTime: readTime || "5 phút đọc",
        isAdmin,
      });

      const savedArticle = await newArticle.save();

      // Tạo thông báo nếu user không phải admin (bài viết chờ duyệt)
      if (!isAdmin) {
        createNotification(
          userId,
          "article_pending",
          "Bài viết chờ duyệt",
          `Bài viết "${title}" đã được gửi và đang chờ quản trị viên duyệt.`,
          savedArticle._id,
          "/articles"
        ).catch(err => console.error("[notification] Failed to create article_pending notification:", err));
      }

      res.status(201).json({
        success: true,
        message: isAdmin
          ? "Bài viết đã được đăng thành công"
          : "Bài viết đã được gửi và đang chờ duyệt",
        article: savedArticle,
      });
    } catch (error) {
      console.error("Error creating article:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi tạo bài viết",
        error: error.message,
      });
    }
  },

  getAllArticles: async (req, res) => {
    try {
      const {
        status,
        category,
        author,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        order = "desc",
      } = req.query;

      const query = {};
      if (status) query.status = status;
      if (category) query.category = category;
      if (author) query.author = author;

      const skip = (page - 1) * limit;
      const sortOrder = order === "asc" ? 1 : -1;

      const articles = await Article.find(query)
        .populate("author", "username email")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Article.countDocuments(query);

      res.status(200).json({
        success: true,
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching articles:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách bài viết",
        error: error.message,
      });
    }
  },

  getPublicArticles: async (req, res) => {
    try {
      const { category, page = 1, limit = 10 } = req.query;

      // Lấy bài viết approved HOẶC bài viết đang chờ duyệt chỉnh sửa (hasPendingEdit = true)
      const query = {
        $or: [
          { status: "approved" },
          { status: "pending", hasPendingEdit: true }
        ]
      };
      if (category) query.category = category;

      const skip = (page - 1) * limit;

      const articles = await Article.find(query)
        .populate("author", "username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select("-__v");

      const total = await Article.countDocuments(query);

      res.status(200).json({
        success: true,
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching public articles:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách bài viết",
        error: error.message,
      });
    }
  },

  getArticleById: async (req, res) => {
    try {
      const { id } = req.params;

      const article = await Article.findById(id).populate(
        "author",
        "username email"
      );

      if (!article) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết",
        });
      }

      // Kiểm tra quyền truy cập:
      // - Nếu bài viết có hasPendingEdit = true → Cho phép mọi người xem (kể cả chưa đăng nhập)
      // - Nếu status !== "approved" và không có draft → Chỉ tác giả/admin xem được
      
      console.log(`[getArticleById] Article: ${article.title}`);
      console.log(`[getArticleById] status: ${article.status}`);
      console.log(`[getArticleById] hasPendingEdit: ${article.hasPendingEdit}`);
      console.log(`[getArticleById] req.user: ${req.user ? req.user.id : 'null'}`);
      
      const isPubliclyViewable = article.status === "approved" || article.hasPendingEdit === true;
      
      console.log(`[getArticleById] isPubliclyViewable: ${isPubliclyViewable}`);
      
      if (
        !isPubliclyViewable &&
        (!req.user || (req.user.id !== article.author._id.toString() && !req.user.admin))
      ) {
        console.log(`[getArticleById] Access denied!`);
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xem bài viết này",
        });
      }
      
      console.log(`[getArticleById] Access granted!`);

      article.views += 1;
      await article.save();

      // Nếu có draft đang chờ duyệt và người xem là tác giả hoặc admin
      // Trả về cả nội dung draft và nội dung gốc
      let articleData = article.toObject();
      
      const isAuthorOrAdmin = req.user && (req.user.id === article.author._id.toString() || req.user.admin);
      
      if (article.hasPendingEdit && isAuthorOrAdmin) {
        // Giữ nội dung gốc trong originalContent
        articleData.originalContent = {
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
          category: article.category,
          image: article.image,
          readTime: article.readTime,
        };
        
        // Hiển thị nội dung draft
        articleData.title = article.draftTitle || article.title;
        articleData.content = article.draftContent || article.content;
        articleData.excerpt = article.draftExcerpt || article.excerpt;
        articleData.category = article.draftCategory || article.category;
        articleData.image = article.draftImage || article.image;
        articleData.readTime = article.draftReadTime || article.readTime;
        articleData.isViewingDraft = true; // Flag để frontend biết đang xem draft
      }
      
      // Ẩn thông tin nhạy cảm với người dùng công khai
      if (!isAuthorOrAdmin) {
        delete articleData.rejectionReason;
        delete articleData.draftTitle;
        delete articleData.draftContent;
        delete articleData.draftExcerpt;
        delete articleData.draftCategory;
        delete articleData.draftImage;
        delete articleData.draftReadTime;
        delete articleData.hasPendingEdit;
      }

      res.status(200).json({
        success: true,
        article: articleData,
      });
    } catch (error) {
      console.error("Error fetching article:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thông tin bài viết",
        error: error.message,
      });
    }
  },

  updateArticle: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const article = await Article.findById(id);

      if (!article) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết",
        });
      }

      if (article.author.toString() !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền chỉnh sửa bài viết này",
        });
      }

      const { title, content, excerpt, category, image, readTime } = req.body;

      // Nếu user (không phải admin) chỉnh sửa bài viết đã được duyệt
      // Lưu vào draft fields và giữ nguyên nội dung gốc
      if (!isAdmin && article.status === "approved") {
        article.status = "pending"; // Đổi status để admin biết cần duyệt
        article.hasPendingEdit = true; // Flag để phân biệt bài viết mới vs bài viết đang chỉnh sửa
        
        // Lưu nội dung chỉnh sửa vào draft
        if (title !== undefined) article.draftTitle = title;
        if (content !== undefined) article.draftContent = content;
        if (excerpt !== undefined) article.draftExcerpt = excerpt;
        if (category !== undefined) article.draftCategory = category;
        if (image !== undefined) article.draftImage = image;
        if (readTime !== undefined) article.draftReadTime = readTime;
      } else {
        // Admin hoặc bài viết chưa được duyệt: cập nhật trực tiếp
        if (title) article.title = title;
        if (content) article.content = content;
        if (excerpt) article.excerpt = excerpt;
        if (category) article.category = category;
        if (image) article.image = image;
        if (readTime) article.readTime = readTime;
      }

      const updatedArticle = await article.save();

      res.status(200).json({
        success: true,
        message: "Cập nhật bài viết thành công",
        article: updatedArticle,
      });
    } catch (error) {
      console.error("Error updating article:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi cập nhật bài viết",
        error: error.message,
      });
    }
  },

  deleteArticle: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.admin;

      const article = await Article.findById(id);

      if (!article) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết",
        });
      }

      if (article.author.toString() !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xóa bài viết này",
        });
      }

      await Article.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Xóa bài viết thành công",
      });
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa bài viết",
        error: error.message,
      });
    }
  },

  approveArticle: async (req, res) => {
    try {
      const { id } = req.params;

      const article = await Article.findById(id);

      if (!article) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết",
        });
      }

      // Nếu có draft đang chờ duyệt, copy draft sang nội dung chính
      if (article.hasPendingEdit) {
        if (article.draftTitle) article.title = article.draftTitle;
        if (article.draftContent) article.content = article.draftContent;
        if (article.draftExcerpt) article.excerpt = article.draftExcerpt;
        if (article.draftCategory) article.category = article.draftCategory;
        if (article.draftImage) article.image = article.draftImage;
        if (article.draftReadTime) article.readTime = article.draftReadTime;

        // Xóa draft fields
        article.draftTitle = null;
        article.draftContent = null;
        article.draftExcerpt = null;
        article.draftCategory = null;
        article.draftImage = null;
        article.draftReadTime = null;
        article.hasPendingEdit = false;
      }

      article.status = "approved";
      article.rejectionReason = null;

      await article.save();

      // Tạo thông báo cho tác giả
      if (article.author) {
        createNotification(
          article.author,
          "article_approved",
          "Bài viết đã được duyệt",
          `Bài viết "${article.title}" của bạn đã được duyệt và đăng công khai.`,
          article._id,
          "/articles"
        ).catch(err => console.error("[notification] Failed to create article_approved notification:", err));
      }

      res.status(200).json({
        success: true,
        message: "Duyệt bài viết thành công",
        article,
      });
    } catch (error) {
      console.error("Error approving article:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi duyệt bài viết",
        error: error.message,
      });
    }
  },

  rejectArticle: async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const article = await Article.findById(id);

      if (!article) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài viết",
        });
      }

      // Nếu bài viết đang có draft chờ duyệt (bài viết đã approved trước đó)
      // Xóa draft và giữ lại nội dung gốc, đưa status về approved
      if (article.hasPendingEdit) {
        article.draftTitle = null;
        article.draftContent = null;
        article.draftExcerpt = null;
        article.draftCategory = null;
        article.draftImage = null;
        article.draftReadTime = null;
        article.hasPendingEdit = false;
        article.status = "approved"; // Trở về trạng thái approved với nội dung gốc
        article.rejectionReason = reason || "Nội dung chỉnh sửa không phù hợp";
      } else {
        // Bài viết mới chưa được duyệt lần nào
        article.status = "rejected";
        article.rejectionReason = reason || "Nội dung không phù hợp";
      }

      await article.save();

      // Tạo thông báo cho tác giả
      if (article.author) {
        createNotification(
          article.author,
          "article_rejected",
          "Bài viết bị từ chối",
          `Bài viết "${article.title}" của bạn đã bị từ chối. Lý do: ${article.rejectionReason}`,
          article._id,
          "/articles"
        ).catch(err => console.error("[notification] Failed to create article_rejected notification:", err));
      }

      res.status(200).json({
        success: true,
        message: "Từ chối bài viết thành công",
        article,
      });
    } catch (error) {
      console.error("Error rejecting article:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi từ chối bài viết",
        error: error.message,
      });
    }
  },

  getMyArticles: async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, page = 1, limit = 10 } = req.query;

      const query = { author: userId };
      if (status) query.status = status;

      const skip = (page - 1) * limit;

      const articles = await Article.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Article.countDocuments(query);

      res.status(200).json({
        success: true,
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching my articles:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách bài viết của bạn",
        error: error.message,
      });
    }
  },
};

module.exports = articleController;
