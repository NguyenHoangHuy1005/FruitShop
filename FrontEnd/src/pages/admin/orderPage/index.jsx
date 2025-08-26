import "./style.scss";
import { memo, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API } from "../../../component/redux/apiRequest";
import { ROUTERS } from "../../../utils/router";
import { formatter } from "../../../utils/fomater";

const formatDateTime = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso || "";
  }
};

const OrderAdminPage = () => {
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth?.login?.currentUser);

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const headers = useMemo(() => {
    const bearer = user?.accessToken ? `Bearer ${user.accessToken}` : "";
    return bearer ? { Authorization: bearer } : {};
  }, [user?.accessToken]);

  useEffect(() => {
    if (!user?.accessToken || user?.admin !== true) {
      navigate(ROUTERS.ADMIN.LOGIN, { replace: true });
      return;
    }
  }, [user?.accessToken, user?.admin, navigate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);

      const res = await API.get(`/order?${params.toString()}`, {
        headers,
        validateStatus: () => true,
      });

      if (!alive) return;

      if (res.status === 200) {
        setData(res.data?.data || []);
        setTotal(res.data?.total || 0);
      } else {
        setErr(
          res?.data?.message ||
            `Tải danh sách đơn thất bại (HTTP ${res.status}).`
        );
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [page, limit, q, status, headers]);

  const pages = Math.max(1, Math.ceil(total / limit));

  const getStatusClass = (status) => {
    switch (status) {
      case "pending":
        return "status-pending";
      case "paid":
        return "status-paid";
      case "shipped":
        return "status-shipped";
      case "completed":
        return "status-completed";
      case "cancelled":
        return "status-cancelled";
      default:
        return "status-default";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "paid":
        return "Paid";
      case "shipped":
        return "Shipped";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  return (
    <div className="admin-orders-page">
      <div className="container">
          <h2>QUẢN LÝ ĐƠN HÀNG</h2>
        <div className="admin-card">
          {/* Bộ lọc */}
          <div className="card-header">
            <div className="filters">
              <div className="search-box">
                <input
                  type="text"
                  value={q}
                  onChange={(e) => {
                    setPage(1);
                    setQ(e.target.value);
                  }}
                  placeholder="Tìm theo tên, số điện thoại, email..."
                  className="search-input"
                />
              </div>

              <div className="filter-group">
                <select
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value);
                  }}
                  className="filter-select"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>

                <select
                  value={limit}
                  onChange={(e) => {
                    setPage(1);
                    setLimit(parseInt(e.target.value, 10));
                  }}
                  className="filter-select"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>
            </div>
          </div>

          {/* Nội dung */}
          <div className="card-content">
            {loading && (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Đang tải dữ liệu...</p>
              </div>
            )}

            {!loading && err && (
              <div className="alert alert-error">
                ⚠️ <span>{err}</span>
              </div>
            )}

            {!loading && !err && (
              <div className="table-container">
                {data.length === 0 ? (
                  <div className="empty-state">
                    <h3>📋 Không có đơn hàng nào</h3>
                    <p>Hãy thử thay đổi điều kiện lọc để tìm đơn hàng.</p>
                  </div>
                ) : (
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Mã đơn</th>
                        <th>Tổng đơn</th>
                        <th>Khách hàng</th>
                        <th>Ngày đặt</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((o) => {
                        const id = String(o._id || "");
                        const total = o?.amount?.total ?? o?.amount ?? 0;
                        return (
                          <tr key={id}>
                            <td className="order-id">
                              #{id.slice(-8).toUpperCase()}
                            </td>
                            <td className="order-total">
                              {formatter(total)}
                            </td>
                            <td className="customer-info">
                              <div className="customer-name">
                                {o?.customer?.name}
                              </div>
                              <div className="customer-contact">
                                {o?.customer?.phone} • {o?.customer?.email}
                              </div>
                            </td>
                            <td className="order-date">
                              {formatDateTime(o?.createdAt)}
                            </td>
                            <td>
                              <span
                                className={`status-badge ${getStatusClass(
                                  o?.status
                                )}`}
                              >
                                {getStatusText(o?.status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && !err && (
            <div className="card-footer">
              <div className="pagination-info">
                Tổng: <strong>{total}</strong> đơn — Trang{" "}
                <strong>{page}</strong>/<strong>{pages}</strong>
              </div>

              <div className="pagination">
                <button
                  className="pagination-btn prev"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Trước
                </button>

                {[...Array(pages)].map((_, i) => (
                  <button
                    key={i}
                    className={`pagination-btn ${
                      page === i + 1 ? "active" : ""
                    }`}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  className="pagination-btn next"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(OrderAdminPage);
