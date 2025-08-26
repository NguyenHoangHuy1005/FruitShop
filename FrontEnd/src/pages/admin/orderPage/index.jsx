import "./style.scss";
import { memo, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API } from "../../../component/redux/apiRequest"; // đường dẫn tới file export API
import { ROUTERS } from "../../../utils/router";
import { formatter } from "../../../utils/fomater";

const formatDateTime = (iso) => {
    try {
        const d = new Date(iso);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    } catch { return iso || ""; }
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

    const headers = useMemo(() => {
        const bearer = user?.accessToken ? `Bearer ${user.accessToken}` : "";
        return bearer ? { Authorization: bearer } : {};
    }, [user?.accessToken]);

    useEffect(() => {
        // bảo vệ route admin
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
        if (q.trim())      params.set("q", q.trim());
        if (status)        params.set("status", status);

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

    return (
        <div className="container">
        <div className="orders">
            <h2>QUẢN LÝ ĐƠN HÀNG</h2>

            <div className="orders__toolbar" style={{ display: "flex", gap: 12, margin: "12px 0" }}>
            <input
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
                placeholder="Tìm tên/điện thoại/email/sản phẩm…"
                style={{ flex: 1, padding: 8 }}
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
                <table className="orders__table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                    <th style={{ textAlign: "left" }}>Mã đơn</th>
                    <th style={{ textAlign: "right" }}>Tổng đơn</th>
                    <th style={{ textAlign: "left" }}>Khách hàng</th>
                    <th style={{ textAlign: "left" }}>Ngày đặt</th>
                    <th style={{ textAlign: "left" }}>Trạng thái</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((o) => {
                    const id = String(o._id || "");
                    const total = o?.amount?.total ?? o?.amount ?? 0;
                    return (
                        <tr key={id} style={{ borderTop: "1px solid #eee" }}>
                        <td>{id.slice(-8).toUpperCase()}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatter(total)}</td>
                        <td>
                            <div style={{ fontWeight: 600 }}>{o?.customer?.name}</div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                            {o?.customer?.phone} • {o?.customer?.email}
                            </div>
                        </td>
                        <td>{formatDateTime(o?.createdAt)}</td>
                        <td>
                            <span className={`badge status-${o?.status || "pending"}`}>{o?.status || "pending"}</span>
                        </td>
                        </tr>
                    );
                    })}
                    {data.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 16 }}>Không có đơn nào.</td></tr>
                    )}
                </tbody>
                </table>
            )}
            </div>

            <div className="orders__footer" style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
            <div>
                Tổng: <b>{total}</b> đơn — Trang <b>{page}</b>/<b>{pages}</b>
            </div>
            <div className="orders__pagination" style={{ display: "flex", gap: 8 }}>
                <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Trước</button>
                <button disabled={page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Sau →</button>
            </div>
            </div>
        </div>
        </div>
    );
};

export default memo(OrderAdminPage);
