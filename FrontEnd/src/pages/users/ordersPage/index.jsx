// src/pages/user/orders/index.jsx
import { memo, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import { formatter } from "../../../utils/fomater";
import { API } from "../../../component/redux/apiRequest"; // dùng axios instance sẵn có
import { ROUTERS } from "../../../utils/router";
import "./style.scss"; // nếu cần style dùng chung

const formatDateTime = (iso) => {
    try {
        const d = new Date(iso);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    } catch {
        return iso || "";
    }
};

const OrdersPage = () => {
    const navigate = useNavigate();
    const user = useSelector((s) => s.auth?.login?.currentUser);

    const [orders, setOrders] = useState([]);
    const [openIds, setOpenIds] = useState(() => new Set()); // toggle chi tiết từng đơn
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const tokenHeader = useMemo(() => {
        // Back-end chấp nhận 'Authorization' hoặc 'token'
        const bearer = user?.accessToken ? `Bearer ${user.accessToken}` : "";
        return bearer ? { Authorization: bearer } : {};
    }, [user?.accessToken]);

    useEffect(() => {
        if (!user?.accessToken) {
        // Chưa đăng nhập => điều hướng về trang đăng nhập (đang dùng chung trang Admin Login)
        navigate(ROUTERS.ADMIN.LOGIN, { replace: true });
        return;
        }

        let alive = true;
        (async () => {
        setLoading(true);
        setError("");
        try {
            // validateStatus để tự kiểm soát thông báo lỗi (khỏi ném exception)
            const res = await API.get("/order/me", {
            headers: tokenHeader,
            validateStatus: () => true,
            });
            if (!alive) return;

            if (res.status === 200 && Array.isArray(res.data)) {
            setOrders(res.data);
            } else {
            const msg = res?.data?.message || `Không tải được đơn hàng (HTTP ${res.status}).`;
            setError(msg);
            }
        } catch (e) {
            const msg = e?.response?.data?.message || e?.message || "Lỗi mạng khi tải đơn hàng.";
            setError(msg);
        } finally {
            if (alive) setLoading(false);
        }
        })();

        return () => {
        alive = false;
        };
    }, [navigate, tokenHeader, user?.accessToken]);

    const toggleOpen = (id) => {
        setOpenIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
        });
    };

    return (
        <>
        <Breadcrumb paths={[{ label: "Đơn mua" }]} />
        <div className="container">
            <h2 style={{ margin: "12px 0 16px" }}>Đơn hàng của tôi</h2>

            {loading && <p>Đang tải đơn hàng…</p>}
            {!loading && error && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: 16 }}>
                {error}
            </div>
            )}

            {!loading && !error && (!orders || orders.length === 0) && (
            <div className="empty-state">
                <p>Bạn chưa có đơn hàng nào.</p>
                <button
                type="button"
                className="button-submit"
                onClick={() => navigate(ROUTERS.USER.PRODUCTS)}
                >
                Mua sắm ngay
                </button>
            </div>
            )}

            {!loading && !error && orders && orders.length > 0 && (
            <div className="orders-list">
                <table className="table table-striped" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                    <th style={{ textAlign: "left" }}>Mã đơn</th>
                    <th style={{ textAlign: "left" }}>Thời gian</th>
                    <th style={{ textAlign: "left" }}>Trạng thái</th>
                    <th style={{ textAlign: "left" }}>Thanh toán</th>
                    <th style={{ textAlign: "right" }}>Tổng tiền</th>
                    <th />
                    </tr>
                </thead>
                <tbody>
                    {orders.map((o) => {
                    const id = String(o._id || o.id || "");
                    const total = o?.amount?.total ?? o?.amount ?? 0;
                    const createdAt = o?.createdAt || o?.updatedAt || "";
                    const isOpen = openIds.has(id);

                    return (
                        <tr key={id} style={{ borderTop: "1px solid #eee" }}>
                        <td>
                            <div style={{ fontWeight: 600 }}>{id.slice(-8).toUpperCase()}</div>
                        </td>
                        <td>{formatDateTime(createdAt)}</td>
                        <td>
                            <span className={`badge status-${o?.status || "pending"}`}>
                            {o?.status || "pending"}
                            </span>
                        </td>
                        <td>{o?.payment || "COD"}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatter(total)}</td>
                        <td style={{ width: 1, whiteSpace: "nowrap" }}>
                            <button
                            type="button"
                            className="link-btn"
                            onClick={() => toggleOpen(id)}
                            aria-expanded={isOpen}
                            >
                            {isOpen ? "Thu gọn" : "Xem chi tiết"}
                            </button>
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>

                {/* Vùng chi tiết từng đơn */}
                {orders.map((o) => {
                const id = String(o._id || o.id || "");
                if (!openIds.has(id)) return null;

                return (
                    <div key={`${id}-details`} className="order-details" style={{ margin: "12px 0 28px" }}>
                    <div className="card" style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
                        <div style={{ marginBottom: 8 }}>
                        <b>Khách hàng: </b>
                        {o?.customer?.name} — {o?.customer?.phone} — {o?.customer?.email}
                        <br />
                        <b>Địa chỉ: </b>
                        {o?.customer?.address}
                        {o?.customer?.note ? (
                            <>
                            <br />
                            <b>Ghi chú: </b>
                            {o.customer.note}
                            </>
                        ) : null}
                        </div>

                        <div className="table__cart" style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                            <tr>
                                <th style={{ textAlign: "left" }}>Sản phẩm</th>
                                <th style={{ textAlign: "right" }}>Đơn giá</th>
                                <th style={{ textAlign: "right" }}>Số lượng</th>
                                <th style={{ textAlign: "right" }}>Thành tiền</th>
                            </tr>
                            </thead>
                            <tbody>
                            {(o?.items || []).map((it, idx) => {
                                // ảnh có thể là mảng hoặc string
                                const imgSrc = Array.isArray(it.image) ? (it.image[0] || "") : (it.image || "");
                                return (
                                <tr key={idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                                    <td style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                                    {imgSrc ? (
                                        <img
                                        src={imgSrc}
                                        alt={it.name}
                                        style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }}
                                        />
                                    ) : null}
                                    <span>{it.name}</span>
                                    </td>
                                    <td style={{ textAlign: "right" }}>{formatter(it.price)}</td>
                                    <td style={{ textAlign: "right" }}>{it.quantity}</td>
                                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                                    {formatter(it.total ?? it.price * it.quantity)}
                                    </td>
                                </tr>
                                );
                            })}
                            </tbody>
                            <tfoot>
                            <tr>
                                <td />
                                <td />
                                <td style={{ textAlign: "right" }}>
                                <b>Tạm tính:</b>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                {formatter(o?.amount?.subtotal ?? 0)}
                                </td>
                            </tr>
                            <tr>
                                <td />
                                <td />
                                <td style={{ textAlign: "right" }}>
                                <b>Phí vận chuyển:</b>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                {formatter(o?.amount?.shipping ?? 0)}
                                </td>
                            </tr>
                            <tr>
                                <td />
                                <td />
                                <td style={{ textAlign: "right" }}>
                                <b>Giảm giá:</b>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                {formatter(o?.amount?.discount ?? 0)}
                                </td>
                            </tr>
                            <tr>
                                <td />
                                <td />
                                <td style={{ textAlign: "right" }}>
                                <h4 style={{ margin: 0 }}>Tổng thanh toán:</h4>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                <h4 style={{ margin: 0 }}>
                                    {formatter(o?.amount?.total ?? o?.amount ?? 0)}
                                </h4>
                                </td>
                            </tr>
                            </tfoot>
                        </table>
                        </div>
                    </div>
                    </div>
                );
                })}
            </div>
            )}
        </div>
        </>
    );
};

export default memo(OrdersPage);
