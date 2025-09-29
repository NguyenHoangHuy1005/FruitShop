import "./style.scss";
import { memo, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API, ensureAccessToken } from "../../../component/redux/apiRequest";
import { ROUTERS } from "../../../utils/router";

const formatDateTime = (iso) => {
    try {
        return new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return iso || "";
    }
};

// Chuẩn hóa đầu/cuối ngày cho lọc khoảng
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


const InvoicePage = () => {
    const navigate = useNavigate();
    const user = useSelector((s) => s.auth?.login?.currentUser);

    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage]   = useState(1);
    const [limit, setLimit] = useState(20);
    const [q, setQ]         = useState("");
    const [fromDate, setFromDate] = useState(""); // YYYY-MM-DD
    const [toDate, setToDate] = useState("");     // YYYY-MM-DD
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [showDetail, setShowDetail] = useState(false);
    const [detail, setDetail] = useState(null);

    const authHeaders = async () => {
        const t = await ensureAccessToken(null);
        return t ? { Authorization: `Bearer ${t}` } : {};
    };

    useEffect(() => {
        (async () => {
            const t = await ensureAccessToken(null);     //  thử refresh
            if (!t || user?.admin !== true) {
                navigate(ROUTERS.ADMIN.LOGIN, { replace: true });
            }
        })();
    }, [user?.admin, navigate]);

    useEffect(() => {
        let alive = true;
        (async () => {
        setLoading(true); setErr("");
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
        });
        if (q.trim()) params.set("q", q.trim());
        if (fromDate) params.set("from", fromDate); // YYYY-MM-DD
        if (toDate)   params.set("to", toDate);     // YYYY-MM-DD

        const headers = await authHeaders();
        const res = await API.get(`/stock/receipts?${params.toString()}`, {
            headers, validateStatus: () => true,
        });

        if (!alive) return;
        if (res.status === 200) {
            setData(res.data?.data || []);   // lấy mảng data
            setTotal(res.data?.total || 0);  // tổng số hóa đơn
        } else {
            setErr(res?.data?.message || `Tải hóa đơn thất bại (HTTP ${res.status})`);
        }
        setLoading(false);
        })();
        return () => { alive = false; };
    }, [page, limit, q, fromDate, toDate]);

    const pages = Math.max(1, Math.ceil(total / limit));

    const fetchDetail = async (id) => {
        try {
            const headers = await authHeaders();
            const res = await API.get(`/stock/receipt/${id}`, {
            headers, validateStatus: () => true,
            });
            if (res.status === 200) {
            setDetail(res.data);
            setShowDetail(true);
            } else {
            alert(res?.data?.message || "Không lấy được chi tiết hóa đơn");
            }
        } catch (e) {
            alert("Lỗi tải chi tiết hóa đơn");
        }
    };

    const download = async (id) => {
        try {
            const headers = await authHeaders();
            const res = await API.get(`/stock/invoice/${id}`, {
                headers, responseType: "blob", validateStatus: () => true
            });
            if (res.status !== 200) throw new Error("Không tải được PDF");
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `invoice_${id}.pdf`;
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
        alert(e.message);
        }
    };

    const viewRows = useMemo(() => {
        const key = (q || "").trim().toLowerCase();
        const from = toStartOfDay(fromDate);
        const to   = toEndOfDay(toDate);

        return (data || []).filter((r) => {
            // match text: mã HĐ (đầy đủ và 8 ký tự cuối), NCC, người nhập, ghi chú
            const haystack = [
            r?._id, r?._id?.slice(-8),
            r?.supplier?.name,
            r?.admin?.fullname, r?.admin?.username,
            r?.note
            ].map(x => (x || "").toString().toLowerCase()).join(" | ");
            let ok = !key || haystack.includes(key);

            if (ok && from) ok = new Date(r.createdAt) >= from;
            if (ok && to)   ok = new Date(r.createdAt) <= to;

            return ok;
        });
    }, [data, q, fromDate, toDate]);

    const resetFilters = () => {
        setQ(""); setFromDate(""); setToDate(""); setPage(1);
    };

    return (
        <div className="container">
            <div className="invoices">
                <div className="invoices__header">
                    <h2>QUẢN LÝ HÓA ĐƠN NHẬP KHO</h2>
                </div>

                <div className="invoices__toolbar toolbar-card">
                    <div className="field grow">
                        <label>Tìm kiếm</label>
                        <input
                        value={q}
                        onChange={(e) => { setPage(1); setQ(e.target.value); }}
                        placeholder="Mã HĐ / Nhà cung cấp / Người nhập…"
                        />
                    </div>

                    <div className="field">
                        <label>Từ ngày</label>
                        <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => { setPage(1); setFromDate(e.target.value); }}
                        title="Từ ngày (theo ngày tạo)"
                        />
                    </div>

                    <div className="dash">→</div>

                    <div className="field">
                        <label>Đến ngày</label>
                        <input
                        type="date"
                        value={toDate}
                        onChange={(e) => { setPage(1); setToDate(e.target.value); }}
                        title="Đến ngày (theo ngày tạo)"
                        />
                    </div>

                    <div className="field compact">
                        <label>Số dòng</label>
                        <select
                        value={limit}
                        onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }}
                        >
                        <option value={10}>10 / trang</option>
                        <option value={20}>20 / trang</option>
                        <option value={50}>50 / trang</option>
                        </select>
                    </div>

                    <button className="btn ghost" onClick={resetFilters}>Xóa lọc</button>
                </div>

                <div className="invoices__content">
                    {loading && <p>Đang tải…</p>}
                    {!loading && err && <div className="alert alert-danger">{err}</div>}

                    {!loading && !err && (
                        <table className="invoices__table">
                        <thead>
                            <tr>
                            <th>Mã HĐ</th>
                            <th>Nhà cung cấp</th>
                            <th>Người nhập</th>
                            <th>Ngày</th>
                            <th>Tổng tiền</th>
                            <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {viewRows.map((r) => (
                            <tr key={r._id}>
                                <td>{r._id.slice(-8).toUpperCase()}</td>
                                <td>{r.supplier?.name}</td>
                                <td>{r.admin?.fullname || r.admin?.username}</td>
                                <td>{formatDateTime(r.createdAt)}</td>
                                <td>{(r.totalAmount||0).toLocaleString()} VND</td>
                                <td>
                                    <button onClick={() => fetchDetail(r._id)}>Chi tiết</button>
                                    <button onClick={() => download(r._id)}>Tải PDF</button>
                                </td>
                            </tr>
                            ))}
                            {viewRows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="no-data">Không có hóa đơn nào.</td>
                            </tr>
                            )}
                        </tbody>
                        </table>
                    )}
                </div>

                <div className="invoices__footer">
                    <div>
                        Tổng: <b>{total}</b> hóa đơn — Trang <b>{page}</b>/<b>{pages}</b>
                    </div>
                    <div className="invoices__pagination">
                        <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Trước</button>
                        <button disabled={page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Sau →</button>
                    </div>
                </div>

                {showDetail && detail && (
                    <div className="modal-backdrop">
                        <div className="modal">
                            <h3>Chi tiết hóa đơn #{detail._id.slice(-8).toUpperCase()}</h3>
                            <p><b>Nhà cung cấp:</b> {detail.supplier?.name}</p>
                            <p><b>Người nhập:</b> {detail.admin?.fullname || detail.admin?.username}</p>
                            <p><b>Ngày:</b> {formatDateTime(detail.createdAt)}</p>
                            <p><b>Ghi chú:</b> {detail.note || "-"}</p>

                            <h4>Danh sách sản phẩm:</h4>
                            <ul>
                                {detail.items?.map((it, idx) => (
                                <li key={idx}>
                                    {it.product?.name} — SL: {it.quantity} × {it.unitPrice.toLocaleString()} VND  
                                    = <b>{it.total.toLocaleString()} VND</b>
                                </li>
                                ))}
                            </ul>

                            <p><b>Tổng cộng:</b> {detail.totalAmount?.toLocaleString()} VND</p>

                            <div className="modal-actions">
                                <button onClick={() => download(detail._id)}>Tải PDF</button>
                                <button onClick={() => setShowDetail(false)}>Đóng</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(InvoicePage);
