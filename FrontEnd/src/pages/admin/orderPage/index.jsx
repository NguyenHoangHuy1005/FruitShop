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
    const [page, setPage]   = useState(1);
    const [limit, setLimit] = useState(20);
    const [q, setQ]         = useState("");
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
        <div className="container">
            <div className="orders">
                <div className="orders__header">
                    <h2>QUẢN LÝ ĐƠN HÀNG</h2>
                    <button className="btn-theme" onClick={toggleTheme}>
                        {isDark ? "☀️" : "🌙"}
                    </button>
                </div>

                <div className="orders__toolbar">
                    <input
                        value={q}
                        onChange={(e) => { setPage(1); setQ(e.target.value); }}
                        placeholder="Tìm tên/điện thoại/email/sản phẩm…"
                    />
                    <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
                        <option value="">Tất cả trạng thái</option>
                        <option value="pending">pending</option>
                        <option value="paid">paid</option>
                        <option value="shipped">shipped</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                    </select>
                    <select value={limit} onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value,10)); }}>
                        <option value={10}>10 / trang</option>
                        <option value={20}>20 / trang</option>
                        <option value={50}>50 / trang</option>
                    </select>
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
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((o) => {
                                    const id = String(o._id || "");
                                    const total = o?.amount?.total ?? o?.amount ?? 0;
                                    return (
                                        <tr key={id} className="orders__row">
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
                                              <select
                                                value={o?.status}
                                                onChange={async (e) => {
                                                  const newStatus = e.target.value;
                                                  try {
                                                    await API.patch(`/order/${o._id}/status`, { status: newStatus }, { headers });
                                                    // cập nhật lại state để FE phản ánh ngay
                                                    setData((prev) =>
                                                      prev.map((item) =>
                                                        item._id === o._id ? { ...item, status: newStatus } : item
                                                      )
                                                    );
                                                  } catch (err) {
                                                    alert("Cập nhật trạng thái thất bại!");
                                                  }
                                                }}
                                                className={`status-select status-${o?.status}`}
                                              >
                                                <option value="pending">Pending</option>
                                                <option value="paid">Paid</option>
                                                <option value="shipped">Shipped</option>
                                                <option value="completed">Completed</option>
                                                <option value="cancelled">Cancelled</option>
                                              </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {data.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="no-data">Không có đơn nào.</td>
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
