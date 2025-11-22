import "./style.scss";
import { memo, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API } from "../../../component/redux/apiRequest";
import { ROUTERS } from "../../../utils/router";
import { formatter } from "../../../utils/fomater";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";

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
// + ADD: chuẩn hóa đầu/cuối ngày cho lọc khoảng
const toStartOfDay = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};
const toEndOfDay = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
};

const PAYMENT_METHOD_LABELS = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK: "Thanh toán trực tuyến (SePay QR)",
  VNPAY: "Cổng VNPAY / Thẻ quốc tế",
};

const PAYMENT_CHANNEL_LABELS = {
  vietqr: "Quét mã VietQR - Ngân hàng nội địa",
  card: "QR thẻ quốc tế (Visa/Mastercard)",
  momo: "Ví MoMo",
};

const PAYMENT_CANCEL_REASON_LABELS = {
  timeout: "Tự hủy do quá hạn thanh toán",
  user_cancelled: "Khách tự hủy đơn",
  admin_cancelled: "Quản trị viên hủy đơn",
};

const resolvePaymentLabels = (order) => {
  // Handle both old format (string) and new format (object with gateway)
  const methodCode = typeof order?.payment === 'object' 
    ? order?.payment?.gateway 
    : order?.payment;
  const channelCode = order?.paymentMeta?.channel;
  const methodLabel = PAYMENT_METHOD_LABELS[methodCode] || methodCode || "Không xác định";
  const channelLabel = channelCode && PAYMENT_CHANNEL_LABELS[channelCode]
    ? PAYMENT_CHANNEL_LABELS[channelCode]
    : "";
  return { methodLabel, channelLabel };
};

const resolveCancelNote = (order) => {
  if (!order || order.status !== "cancelled") return "";
  const reason = order?.paymentMeta?.cancelReason;
  if (reason && PAYMENT_CANCEL_REASON_LABELS[reason]) {
    return PAYMENT_CANCEL_REASON_LABELS[reason];
  }
  return "Đơn đã bị hủy";
};

const normalizeOrderStatus = (status) => {
  const raw = String(status || "").toLowerCase();
  if (!raw) return "";
  if (raw === "shipping" || raw === "shipped") return "shipped";
  if (raw === "completed" || raw === "complete") return "complete";
  return raw;
};


const OrderAdminPage = () => {
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth?.login?.currentUser);

    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage]   = useState(1);
    const [limit, setLimit] = useState(20);
    const [q, setQ]         = useState("");
    const [fromDate, setFromDate] = useState(""); // YYYY-MM-DD
    const [toDate, setToDate]     = useState(""); // YYYY-MM-DD
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem("theme") === "dark";
    });

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        if (next) {
            document.body.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            document.body.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
    };

    useEffect(() => {
        if (isDark) document.body.classList.add("dark");
        else document.body.classList.remove("dark");
    }, [isDark]);

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
            setLoading(true); setErr("");
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
            });
            if (q.trim()) params.set("q", q.trim());
            if (status) params.set("status", status);
            if (fromDate) params.set("from", fromDate); // YYYY-MM-DD
            if (toDate)   params.set("to", toDate);     // YYYY-MM-DD

            const res = await API.get(`/order?${params.toString()}`, {
                headers, validateStatus: () => true,
            });

            if (!alive) return;
            if (res.status === 200) {
                setData(res.data?.data || []);
                setTotal(res.data?.total || 0);
            } else {
                setErr(res?.data?.message || `Tải danh sách đơn thất bại (HTTP ${res.status}).`);
            }
            setLoading(false);
        })();
        return () => { alive = false; };
    }, [page, limit, q, status, fromDate, toDate, headers]);

  const pages = Math.max(1, Math.ceil(total / limit));

  // + ADD: chỉ lọc theo createdAt để hiển thị
  const viewRows = useMemo(() => {
    const from = toStartOfDay(fromDate);
    const to   = toEndOfDay(toDate);
    return (data || []).filter((o) => {
      let ok = true;
      if (ok && from) ok = new Date(o.createdAt) >= from;
      if (ok && to)   ok = new Date(o.createdAt) <= to;
      return ok;
    });
  }, [data, fromDate, toDate]);

  // + ADD
  const resetFilters = () => {
    setQ("");
    setFromDate("");
    setToDate("");
    setStatus("");
    setPage(1);
  };

    return (
        <div className="container">
          <h2>QUẢN LÝ ĐƠN HÀNG</h2>
            <div className="orders">
                <div className="orders__header">
                </div>
                <div className="orders__toolbar">
                  <div className="filter-field search-field">
                    <label>TÌM KIẾM</label>
                    <input
                      value={q}
                      onChange={(e) => { setPage(1); setQ(e.target.value); }}
                      placeholder="Mã HD / Nhà cung cấp / Người nhập..."
                    />
                  </div>

                  <div className="filter-field">
                    <label>TỪ NGÀY</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => { setPage(1); setFromDate(e.target.value); }}
                      title="Từ ngày (theo ngày đặt)"
                    />
                  </div>

                  <span className="dash">→</span>

                  <div className="filter-field">
                    <label>ĐẾN NGÀY</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => { setPage(1); setToDate(e.target.value); }}
                      title="Đến ngày (theo ngày đặt)"
                    />
                  </div>

                  <div className="filter-field">
                    <label>SỐ DÒNG</label>
                    <select value={limit} onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value,10)); }}>
                      <option value={10}>10 / trang</option>
                      <option value={20}>20 / trang</option>
                      <option value={50}>50 / trang</option>
                    </select>
                  </div>

                  <button className="btn-clear" onClick={resetFilters}>XÓA LỌC</button>
                </div>

                <div className="orders__content">
                    {loading && <p>Đang tải…</p>}
                    {!loading && err && <div className="alert alert-danger">{err}</div>}

                    {!loading && !err && (
                        <table className="orders__table">
                            <thead>
                                <tr>
                                    <th>Mã đơn</th>
                                    <th className="td-right">Tổng đơn</th>
                                    <th>Khách hàng</th>
                                    <th>Ngày đặt</th>
                                    <th>Thanh toán</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewRows.map((o) => {
                                    const id = String(o._id || "");
                                    const total = o?.amount?.total ?? o?.amount ?? 0;
                                    const { methodLabel, channelLabel } = resolvePaymentLabels(o);
                                    const cancelNote = resolveCancelNote(o);
                                    const confirmedAt = o?.paymentCompletedAt ? formatDateTime(o.paymentCompletedAt) : "";
                                    const normalizedStatus = normalizeOrderStatus(o?.status);
                                    const statusClass = normalizedStatus ? `order-${normalizedStatus}` : '';
                                    return (
                                        <tr key={id} className={`orders__row ${statusClass}`}>
                                            <td>{id.slice(-8).toUpperCase()}</td>
                                            <td className="td-right fw-bold">{formatter(total)}</td>
                                            <td>
                                                <div className="fw-bold">{o?.customer?.name}</div>
                                                <div className="text-muted">
                                                    {o?.customer?.phone} • {o?.customer?.email}
                                                </div>
                                            </td>
                                            <td>{formatDateTime(o?.createdAt)}</td>
                                            <td>
                                                <div className="orders__payment">
                                                    <span className="orders__payment-method">{methodLabel}</span>
                                                    {channelLabel ? (
                                                        <span className="orders__payment-channel">{channelLabel}</span>
                                                    ) : null}
                                                    {confirmedAt ? (
                                                        <span className="orders__payment-time">Hoàn tất: {confirmedAt}</span>
                                                    ) : null}
                                                    {cancelNote ? (
                                                        <span className="orders__payment-note">{cancelNote}</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td>
                                              <OrderStatusTag status={o?.status} size="sm" />
                                            </td>
                                        </tr>
                                    );
                                })}
                                {viewRows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="no-data">Không có đơn nào.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="orders__footer">
                    <div>
                        Tổng: <b>{total}</b> đơn — Trang <b>{page}</b>/<b>{pages}</b>
                    </div>
                    <div className="orders__pagination">
                        <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Trước</button>
                        <button disabled={page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Sau →</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(OrderAdminPage);
