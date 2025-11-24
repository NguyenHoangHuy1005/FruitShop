import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  FaPlus,
  FaSync,
  FaEye,
  FaTrash,
  FaPen,
  FaToggleOn,
  FaToggleOff,
  FaTimes,
  FaCloudUploadAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  fetchAdminBanners,
  createBannerEntry,
  updateBannerEntry,
  deleteBannerEntry,
  toggleBannerActive,
  uploadBannerAsset,
} from "../../../component/redux/apiRequest";
import "./style.scss";

const POSITION_OPTIONS = [
  { value: "HOME_SLIDER", label: "Home Slider" },
  { value: "HOME_BOTTOM_BANNER", label: "Home Bottom Banner" },
  { value: "FEATURED_TOP_BANNER", label: "Featured Top Banner" },
];

const SEASONS = ["Xuân", "Hạ", "Thu", "Đông"];
const DAY_OPTIONS = [
  { value: 0, label: "CN" },
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
];

const DEFAULT_FORM = {
  title: "",
  description: "",
  position: POSITION_OPTIONS[0].value,
  redirectUrl: "",
  imageDesktop: "",
  imageMobile: "",
  startAt: "",
  endAt: "",
  activeHours: { from: "00:00", to: "23:59" },
  activeDaysOfWeek: [],
  season: "",
  eventTag: "",
  priority: 0,
  rotationGroup: "",
  rotationInterval: 0,
  isDefault: false,
  isActive: true,
};

const toDatetimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const formatDateTime = (value) => {
  if (!value) return "Không giới hạn";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", { hour12: false });
};

const dayLabelFromNumbers = (days) => {
  if (!days || days.length === 0) return "Tất cả các ngày";
  return DAY_OPTIONS.filter((d) => days.includes(d.value))
    .map((d) => d.label)
    .join(", ");
};

const BannerManagerPage = () => {
  const dispatch = useDispatch();
  const adminState = useSelector((state) => state.banner?.admin) || {
    items: [],
    pagination: { total: 0, page: 1, limit: 10 },
    isFetching: false,
  };
  const mutationState = useSelector((state) => state.banner?.mutation) || {
    isSaving: false,
  };

  const [filters, setFilters] = useState({
    search: "",
    position: "all",
    status: "all",
    season: "all",
    eventTag: "",
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [editingBanner, setEditingBanner] = useState(null);
  const [viewBanner, setViewBanner] = useState(null);
  const [uploading, setUploading] = useState({ desktop: false, mobile: false });
  const [searchInput, setSearchInput] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const buildQueryParams = () => {
    const query = { page, limit };
    if (filters.position !== "all") query.position = filters.position;
    if (filters.status === "active") query.isActive = true;
    if (filters.status === "inactive") query.isActive = false;
    if (filters.season !== "all") query.season = filters.season;
    if (filters.eventTag.trim()) query.eventTag = filters.eventTag.trim();
    if (filters.search.trim()) query.search = filters.search.trim();
    return query;
  };

  useEffect(() => {
    fetchAdminBanners(dispatch, buildQueryParams());
  }, [dispatch, filters, page, limit]);

  const banners = adminState.items || [];
  const pagination = adminState.pagination || { total: 0, page: 1, limit };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const resetFormState = () => {
    setFormState(DEFAULT_FORM);
    setEditingBanner(null);
    setFieldErrors({});
  };

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleFieldChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    clearFieldError(key);
  };

  const openCreateForm = () => {
    resetFormState();
    setShowForm(true);
  };

  const openEditForm = (banner) => {
    setEditingBanner(banner);
    setFormState({
      title: banner.title || "",
      description: banner.description || "",
      position: banner.position || POSITION_OPTIONS[0].value,
      redirectUrl: banner.redirectUrl || "",
      imageDesktop: banner.imageDesktop || "",
      imageMobile: banner.imageMobile || "",
      startAt: toDatetimeLocalValue(banner.startAt),
      endAt: toDatetimeLocalValue(banner.endAt),
      activeHours: {
        from: banner.activeHours?.from || "00:00",
        to: banner.activeHours?.to || "23:59",
      },
      activeDaysOfWeek: Array.isArray(banner.activeDaysOfWeek)
        ? banner.activeDaysOfWeek
        : [],
      season: banner.season || "",
      eventTag: banner.eventTag || "",
      priority: banner.priority ?? 0,
      rotationGroup: banner.rotationGroup || "",
      rotationInterval: banner.rotationInterval ?? 0,
      isDefault: Boolean(banner.isDefault),
      isActive: banner.isActive !== false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetFormState();
  };

  const buildPayload = () => {
    const payload = {
      title: formState.title.trim(),
      description: formState.description.trim(),
      position: formState.position,
      redirectUrl: formState.redirectUrl.trim(),
      imageDesktop: formState.imageDesktop.trim(),
      imageMobile: formState.imageMobile.trim(),
      startAt: formState.startAt ? new Date(formState.startAt).toISOString() : null,
      endAt: formState.endAt ? new Date(formState.endAt).toISOString() : null,
      activeHours: {
        from: formState.activeHours?.from || "00:00",
        to: formState.activeHours?.to || "23:59",
      },
      activeDaysOfWeek: formState.activeDaysOfWeek,
      season: formState.season || null,
      eventTag: formState.eventTag.trim() ? formState.eventTag.trim().toUpperCase() : null,
      priority: Number(formState.priority) || 0,
      rotationGroup: formState.rotationGroup.trim()
        ? formState.rotationGroup.trim().toUpperCase()
        : null,
      rotationInterval: Number(formState.rotationInterval) || 0,
      isDefault: Boolean(formState.isDefault),
      isActive: Boolean(formState.isActive),
    };
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const requiredFields = [
      { key: "title", value: formState.title.trim(), message: "Vui lòng nhập tiêu đề banner" },
      { key: "position", value: formState.position, message: "Vui lòng chọn vị trí hiển thị" },
      { key: "imageDesktop", value: formState.imageDesktop.trim(), message: "Vui lòng cung cấp hình ảnh desktop" },
    ];

    const pendingErrors = requiredFields.reduce((acc, field) => {
      if (!field.value) acc[field.key] = field.message;
      return acc;
    }, {});

    if (Object.keys(pendingErrors).length > 0) {
      setFieldErrors(pendingErrors);
      return;
    }
    setFieldErrors({});

    const payload = buildPayload();

    try {
      if (editingBanner?._id) {
        await updateBannerEntry(editingBanner._id, payload, dispatch, buildQueryParams());
      } else {
        await createBannerEntry(payload, dispatch, buildQueryParams());
      }
      closeForm();
    } catch (error) {
      console.error("Lỗi khi gửi biểu mẫu banner", error);
    }
  };

  const handleDelete = async (banner) => {
    if (!banner?._id) return;
    if (!window.confirm(`Delete banner "${banner.title}"?`)) return;
    try {
      await deleteBannerEntry(banner._id, dispatch, buildQueryParams());
    } catch (error) {
      console.error("Lỗi khi xóa banner", error);
    }
  };

  const handleToggleActive = async (banner) => {
    if (!banner?._id) return;
    try {
      await toggleBannerActive(banner._id, !banner.isActive, dispatch, buildQueryParams());
    } catch (error) {
      console.error("Lỗi khi chuyển đổi trạng thái banner", error);
    }
  };

  const handleImageUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn một tệp hình ảnh hợp lệ");
      return;
    }
    setUploading((prev) => ({ ...prev, [type]: true }));
    try {
      const url = await uploadBannerAsset({ file, type }, dispatch);
      const targetField = type === "imageMobile" ? "imageMobile" : "imageDesktop";
      setFormState((prev) => ({ ...prev, [targetField]: url }));
      clearFieldError(targetField);
      toast.success("Đã tải lên hình ảnh banner");
    } catch (error) {
      console.error("uploadBannerAsset", error);
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleDayToggle = (day) => {
    setFormState((prev) => {
      const exists = prev.activeDaysOfWeek.includes(day);
      return {
        ...prev,
        activeDaysOfWeek: exists
          ? prev.activeDaysOfWeek.filter((d) => d !== day)
          : [...prev.activeDaysOfWeek, day],
      };
    });
  };

  const totalPages = useMemo(() => {
    if (!pagination.total) return 1;
    return Math.max(1, Math.ceil(pagination.total / pagination.limit));
  }, [pagination.total, pagination.limit]);

  const applySearch = () => {
    handleFilterChange("search", searchInput.trim());
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      applySearch();
    }
  };

  return (
    <div className="banner-manager">
      <div className="banner-manager__header">
        <div>
          <h2>Quản lý Banner</h2>
          <p>Điều khiển banner trên cửa hàng</p>
        </div>
        <div className="banner-manager__header-actions">
          <button className="btn btn-secondary" onClick={() => fetchAdminBanners(dispatch, buildQueryParams())}>
            <FaSync /> Làm mới
          </button>
          <button className="btn btn-primary" onClick={openCreateForm}>
            <FaPlus /> Thêm banner
          </button>
        </div>
      </div>

      <div className="banner-manager__filters">
        <div className="filter-group">
          <label>Tìm kiếm</label>
          <div className="search-control">
            <input
              type="text"
              value={searchInput}
              placeholder="Tìm kiếm tiêu đề hoặc mô tả"
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button onClick={applySearch}>Tìm kiếm</button>
          </div>
        </div>
        <div className="filter-group">
          <label>Vị trí</label>
          <select
            value={filters.position}
            onChange={(e) => handleFilterChange("position", e.target.value)}
          >
            <option value="all">Tất cả</option>
            {POSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Trạng thái</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="all">Tất cả</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Không hoạt động</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Mùa</label>
          <select
            value={filters.season}
            onChange={(e) => handleFilterChange("season", e.target.value)}
          >
            <option value="all">Tất cả</option>
            {SEASONS.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Thẻ sự kiện</label>
          <input
            type="text"
            value={filters.eventTag}
            placeholder="e.g. TET, NOEL"
            onChange={(e) => handleFilterChange("eventTag", e.target.value)}
          />
        </div>
      </div>

      <div className="banner-manager__table-wrapper">
        {adminState.isFetching ? (
          <div className="data-placeholder">Đang tải dữ liệu...</div>
        ) : banners.length === 0 ? (
          <div className="data-placeholder">Chưa có banner nào</div>
        ) : (
          <table className="banner-table">
            <thead>
              <tr>
                <th>Hình ảnh</th>
                <th>Thông tin</th>
                <th>Lịch thực hiện</th>
                <th>Mùa / Sự kiện</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((banner) => (
                <tr key={banner._id}>
                  <td>
                    <img src={banner.imageDesktop || banner.imageMobile} alt={banner.title} />
                  </td>
                  <td>
                    <p className="banner-title">{banner.title}</p>
                    <p>{banner.position}</p>
                    {banner.priority !== undefined && (
                      <small>Priority: {banner.priority}</small>
                    )}
                    {banner.rotationGroup && (
                      <small>Rotation: {banner.rotationGroup}</small>
                    )}
                  </td>
                  <td>
                    <p>{formatDateTime(banner.startAt)} - {formatDateTime(banner.endAt)}</p>
                    <small>{dayLabelFromNumbers(banner.activeDaysOfWeek)}</small>
                    <small>
                      Giờ: {banner.activeHours?.from || "00:00"} - {banner.activeHours?.to || "23:59"}
                    </small>
                  </td>
                  <td>
                    <p>{banner.season || "--"}</p>
                    <small>{banner.eventTag || "--"}</small>
                  </td>
                  <td>
                    <span className={`status-badge ${banner.isCurrentlyActive ? "active" : banner.isActive ? "scheduled" : "disabled"}`}>
                      {banner.isCurrentlyActive
                        ? "Hiển thị"
                        : banner.isActive
                        ? "Lên lịch"
                        : "Vô hiệu hóa"}
                    </span>
                  </td>
                  <td>
                    <div className="action-group">
                      <button className="icon-btn" onClick={() => setViewBanner(banner)} title="Xem chi tiết">
                        <FaEye />
                      </button>
                      <button className="icon-btn" onClick={() => openEditForm(banner)} title="Chỉnh sửa banner">
                        <FaPen />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => handleToggleActive(banner)}
                        title={banner.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                      >
                        {banner.isActive ? <FaToggleOn /> : <FaToggleOff />}
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDelete(banner)} title="Xóa">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="banner-manager__pagination">
        <button disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
          Next
        </button>
      </div>

      {showForm && (
        <>
          <div className="banner-form-backdrop" onClick={closeForm} />
          <div className="banner-form-panel" role="dialog" aria-modal="true">
            <div className="panel-header">
              <div className="panel-title">
                <span className="panel-title__label">
                  {editingBanner ? "Chỉnh sửa banner" : "Thêm banner"}
                </span>
                <p>Hoàn tất các trường đánh dấu * trước khi lưu</p>
              </div>
              <button className="panel-close-btn" onClick={closeForm} type="button" aria-label="Đóng form banner">
                <FaTimes size={14} />
              </button>
            </div>
            <form className="banner-form" onSubmit={handleSubmit}>
            <section>
              <h4>Thông tin chính</h4>
              <div className="form-group">
                <label>Tiêu đề *</label>
                <input
                  type="text"
                  className={fieldErrors.title ? "has-error" : ""}
                  value={formState.title}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  required
                />
                {fieldErrors.title && <small className="error-text">{fieldErrors.title}</small>}
              </div>
              <div className="form-group">
                <label>Mô tả</label>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Vị trí</label>
                  <select
                    className={fieldErrors.position ? "has-error" : ""}
                    value={formState.position}
                    onChange={(e) => handleFieldChange("position", e.target.value)}
                  >
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>URL chuyển hướng</label>
                  <input
                    type="url"
                    value={formState.redirectUrl}
                    placeholder="https://..."
                    onChange={(e) => setFormState((prev) => ({ ...prev, redirectUrl: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Hình ảnh desktop *</label>
                  <div className="upload-field">
                  <input
                    type="url"
                    className={fieldErrors.imageDesktop ? "has-error" : ""}
                    value={formState.imageDesktop}
                    placeholder="Paste image URL"
                    onChange={(e) => handleFieldChange("imageDesktop", e.target.value)}
                  />
                  {fieldErrors.imageDesktop && <small className="error-text">{fieldErrors.imageDesktop}</small>}
                    <label className={`upload-btn ${uploading.desktop ? "disabled" : ""}`}>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "imageDesktop")} disabled={uploading.desktop} />
                      <FaCloudUploadAlt /> {uploading.desktop ? "Uploading..." : "Upload file"}
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label>Hình ảnh mobile</label>
                  <div className="upload-field">
                    <input
                      type="url"
                      value={formState.imageMobile}
                      placeholder="Paste image URL"
                      onChange={(e) => setFormState((prev) => ({ ...prev, imageMobile: e.target.value }))}
                    />
                    <label className={`upload-btn ${uploading.mobile ? "disabled" : ""}`}>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "imageMobile")} disabled={uploading.mobile} />
                      <FaCloudUploadAlt /> {uploading.mobile ? "Uploading..." : "Upload file"}
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h4>Lịch hiển thị</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Bắt đầu</label>
                  <input
                    type="datetime-local"
                    value={formState.startAt}
                    onChange={(e) => setFormState((prev) => ({ ...prev, startAt: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Kết thúc</label>
                  <input
                    type="datetime-local"
                    value={formState.endAt}
                    onChange={(e) => setFormState((prev) => ({ ...prev, endAt: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={formState.activeHours?.from}
                    onChange={(e) => setFormState((prev) => ({
                      ...prev,
                      activeHours: { ...prev.activeHours, from: e.target.value },
                    }))}
                  />
                </div>
                <div className="form-group">
                  <label>Giờ kết thúc</label>
                  <input
                    type="time"
                    value={formState.activeHours?.to}
                    onChange={(e) => setFormState((prev) => ({
                      ...prev,
                      activeHours: { ...prev.activeHours, to: e.target.value },
                    }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Ngày trong tuần</label>
                <div className="day-selector">
                  {DAY_OPTIONS.map((day) => (
                    <label key={day.value} className={formState.activeDaysOfWeek.includes(day.value) ? "checked" : ""}>
                      <input
                        type="checkbox"
                        checked={formState.activeDaysOfWeek.includes(day.value)}
                        onChange={() => handleDayToggle(day.value)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h4>Mùa & sự kiện</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Mùa</label>
                  <select
                    value={formState.season}
                    onChange={(e) => setFormState((prev) => ({ ...prev, season: e.target.value }))}
                  >
                    <option value="">--</option>
                    {SEASONS.map((season) => (
                      <option key={season} value={season}>
                        {season}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tag sự kiện</label>
                  <input
                    type="text"
                    value={formState.eventTag}
                    placeholder="TET, NOEL, BLACKFRIDAY"
                    onChange={(e) => setFormState((prev) => ({ ...prev, eventTag: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section>
              <h4>Tùy chọn hiển thị</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Ưu tiên</label>
                  <input
                    type="number"
                    value={formState.priority}
                    onChange={(e) => setFormState((prev) => ({ ...prev, priority: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Nhóm xoay vòng</label>
                  <input
                    type="text"
                    value={formState.rotationGroup}
                    onChange={(e) => setFormState((prev) => ({ ...prev, rotationGroup: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Khoảng thời gian xoay vòng (s)</label>
                  <input
                    type="number"
                    min={0}
                    value={formState.rotationInterval}
                    onChange={(e) => setFormState((prev) => ({ ...prev, rotationInterval: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={formState.isDefault}
                    onChange={(e) => setFormState((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  />
                  Banner mặc định (dự phòng)
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Kích hoạt banner
                </label>
              </div>
            </section>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={mutationState.isSaving}>
                  {mutationState.isSaving ? "Đang lưu..." : "Lưu banner"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {viewBanner && (
        <div className="banner-viewer" onClick={() => setViewBanner(null)}>
          <div className="viewer-card" onClick={(e) => e.stopPropagation()}>
            <div className="viewer-header">
              <h3>{viewBanner.title}</h3>
              <button className="icon-btn" onClick={() => setViewBanner(null)}>
                <FaTimes />
              </button>
            </div>
            <div className="viewer-body">
              <div className="viewer-images">
                {viewBanner.imageDesktop && (
                  <img src={viewBanner.imageDesktop} alt="desktop" />
                )}
                {viewBanner.imageMobile && (
                  <img src={viewBanner.imageMobile} alt="mobile" />
                )}
              </div>
              <p>{viewBanner.description}</p>
              <ul>
                <li>Vị trí: {viewBanner.position}</li>
                <li>Link banner: {viewBanner.redirectUrl || "--"}</li>
                <li>thời gian: {formatDateTime(viewBanner.startAt)} - {formatDateTime(viewBanner.endAt)}</li>
                <li>Ngày áp dụng: {dayLabelFromNumbers(viewBanner.activeDaysOfWeek)}</li>
                <li>Giờ: {viewBanner.activeHours?.from || "00:00"} - {viewBanner.activeHours?.to || "23:59"}</li>
                <li>Mùa: {viewBanner.season || "--"}</li>
                <li>Sự kiện: {viewBanner.eventTag || "--"}</li>
                <li>Ưu tiên: {viewBanner.priority ?? 0}</li>
                <li>Xoay vòng: {viewBanner.rotationGroup || "--"} ({viewBanner.rotationInterval || 0}s)</li>
                <li>Mặc định: {viewBanner.isDefault ? "Có" : "Không"}</li>
                <li>Kích hoạt: {viewBanner.isActive ? "Có" : "Không"}</li>
                <li>Trạng thái hiện tại: {viewBanner.isCurrentlyActive ? "Đang hiển thị" : "Ẩn"}</li>
                <li>Lượt xem / Lượt nhấp: {viewBanner.stats?.views || 0} / {viewBanner.stats?.clicks || 0}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannerManagerPage;

