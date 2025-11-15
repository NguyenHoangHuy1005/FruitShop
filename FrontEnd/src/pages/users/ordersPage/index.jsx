// src/pages/user/orders/index.jsx
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import { formatter } from "../../../utils/fomater";
import {
    API,
    addToCart,
} from "../../../component/redux/apiRequest"; // dùng axios instance sẵn có
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

const formatCountdown = (ms) => {
    if (typeof ms !== "number" || Number.isNaN(ms) || ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const PAYMENT_METHOD_LABELS = {
    COD: "Thanh toán khi nhận hàng (COD)",
    BANK: "Thanh toán trực tuyến (SePay QR)",
    VNPAY: "Cổng VNPAY / Thẻ quốc tế",
};

const PAYMENT_CHANNEL_LABELS = {
    vietqr: "Quét mã SePay - Ngân hàng nội địa",
    card: "QR thẻ quốc tế (Visa/Mastercard)",
    momo: "Ví MoMo",
};

const PAYMENT_CANCEL_REASON_LABELS = {
    timeout: "Đơn hàng đã được hủy tự động do quá hạn thanh toán. Kho đã được hoàn lại.",
    user_cancelled: "Đơn hàng đã được bạn hủy.",
    admin_cancelled: "Đơn hàng đã được quản trị viên hủy.",
};

const resolvePaymentLabels = (order) => {
    // Handle both old format (string) and new format (object)
    let methodCode;
    if (typeof order?.payment === 'object') {
        methodCode = order?.payment?.gateway || 'BANK';
    } else {
        methodCode = order?.payment;
    }
    
    const channelCode = order?.paymentMeta?.channel;
    const methodLabel = PAYMENT_METHOD_LABELS[methodCode] || methodCode || "Không xác định";
    const channelLabel = channelCode && PAYMENT_CHANNEL_LABELS[channelCode]
        ? PAYMENT_CHANNEL_LABELS[channelCode]
        : "";
    return { methodLabel, channelLabel };
};

const OrdersPage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();
    const user = useSelector((s) => s.auth?.login?.currentUser);

    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null); // chỉ hiển thị 1 đơn
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [now, setNow] = useState(() => Date.now());
    const [reorderLoading, setReorderLoading] = useState(null);
    const [reloadTick, setReloadTick] = useState(0);
    const refreshOnExpiryRef = useRef(false);
    const pendingOrderIdRef = useRef(null); // Lưu orderId từ notification

    const tokenHeader = useMemo(() => {
        // Back-end chấp nhận 'Authorization' hoặc 'token'
        const bearer = user?.accessToken ? `Bearer ${user.accessToken}` : "";
        return bearer ? { Authorization: bearer } : {};
    }, [user?.accessToken]);

    useEffect(() => {
        if (!API?.defaults?.headers?.common) return;

        if (user?.accessToken) {
            API.defaults.headers.common.Authorization = `Bearer ${user.accessToken}`;
        } else {
            delete API.defaults.headers.common.Authorization;
        }
    }, [user?.accessToken]);
    
    // Lưu orderId từ navigation state ngay lập tức
    useEffect(() => {
        if (location.state?.selectedOrderId) {
            pendingOrderIdRef.current = location.state.selectedOrderId;
            console.log('📦 Received orderId from notification:', location.state.selectedOrderId);
            // Clear state sau khi đã lưu
            window.history.replaceState({}, document.title);
        }
    }, [location.state?.selectedOrderId]);
    
    // Xử lý mở chi tiết đơn hàng sau khi orders đã load
    useEffect(() => {
        if (pendingOrderIdRef.current && !loading && orders.length > 0) {
            const orderId = pendingOrderIdRef.current;
            console.log('🔍 Orders loaded, checking for orderId:', orderId);
            console.log('📋 Available orders:', orders.map(o => o._id || o.id));
            
            // Kiểm tra xem đơn hàng có tồn tại trong danh sách không
            const orderExists = orders.some(o => String(o._id || o.id || "") === String(orderId));
            
            if (orderExists) {
                console.log('✅ Order found, opening details');
                setSelectedOrderId(String(orderId));
                // Scroll lên đầu trang để xem chi tiết
                setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 300);
            } else {
                console.log('❌ Order not found in list');
            }
            
            // Clear ref sau khi đã xử lý
            pendingOrderIdRef.current = null;
        }
    }, [loading, orders]);
    
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
                if (!alive) return;
                const msg = e?.response?.data?.message || e?.message || "Lỗi mạng khi tải đơn hàng.";
                setError(msg);
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [navigate, reloadTick, tokenHeader, user?.accessToken]);

    useEffect(() => {
        const hasPendingWithDeadline = orders.some(
            (ord) => ord?.status === "pending" && ord?.paymentDeadline
        );
        if (!hasPendingWithDeadline) return undefined;
        setNow(Date.now());
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, [orders]);

    useEffect(() => {
        if (!Number.isFinite(now)) {
            refreshOnExpiryRef.current = false;
            return undefined;
        }
        const hasExpiredPending = orders.some((ord) => {
            if (ord?.status !== "pending" || !ord?.paymentDeadline) return false;
            const deadline = new Date(ord.paymentDeadline).getTime();
            if (Number.isNaN(deadline)) return false;
            return deadline <= now;
        });
        if (!hasExpiredPending) {
            refreshOnExpiryRef.current = false;
            return undefined;
        }
        if (refreshOnExpiryRef.current) return undefined;
        refreshOnExpiryRef.current = true;
        const timer = setTimeout(() => {
            setReloadTick((tick) => tick + 1);
        }, 1200);
        return () => clearTimeout(timer);
    }, [now, orders]);

    const orderMeta = useMemo(() => {
        const metaMap = new Map();
        orders.forEach((ord) => {
            const orderId = String(ord?._id || ord?.id || "");
            const deadlineMs = ord?.paymentDeadline ? new Date(ord.paymentDeadline).getTime() : null;
            const remainingMs = typeof deadlineMs === "number" ? deadlineMs - now : null;
            const hasDeadline = typeof deadlineMs === "number" && !Number.isNaN(deadlineMs);
            const isPending = ord?.status === "pending";
            const stillValid = isPending && hasDeadline && remainingMs > 0;
            const expired = isPending && hasDeadline && remainingMs !== null && remainingMs <= 0;
            metaMap.set(orderId, {
                deadlineMs,
                remainingMs,
                hasDeadline,
                countdown: stillValid ? formatCountdown(remainingMs) : "00:00",
                stillValid,
                expired,
            });
        });
        return metaMap;
    }, [now, orders]);

    const toggleOpen = (id) => {
        // Nếu click vào đơn đang mở thì đóng, nếu không thì mở đơn mới
        setSelectedOrderId((prev) => (prev === id ? null : id));
        // Scroll lên đầu trang để xem chi tiết
        if (selectedOrderId !== id) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleRepeatOrder = async (order) => {
        if (!order) return;
        const id = String(order._id || order.id || "");
        const items = Array.isArray(order.items) ? order.items : [];
        if (!items.length) {
            alert("Đơn hàng không còn sản phẩm để đặt lại.");
            return;
        }

        setReorderLoading(id);
        try {
            const selectedIds = [];
            const skipped = [];
            for (const line of items) {
                const productId =
                    line?.product?._id || line?.product?.id || line?.product || line?.id;
                const qty = Math.max(1, Number(line?.quantity) || 1);
                if (!productId) {
                    skipped.push(line?.name || "Sản phẩm");
                    continue;
                }
                selectedIds.push(String(productId));
                // addToCart sẽ tự kiểm tra tồn kho & giá mới nhất
                await addToCart(productId, qty, dispatch);
            }

            if (!selectedIds.length) {
                alert("Không thể chuẩn bị giỏ hàng cho đơn này. Sản phẩm có thể đã ngừng bán.");
                return;
            }

            if (skipped.length) {
                alert(
                    `Một số sản phẩm không thể thêm lại vào giỏ: ${skipped
                        .slice(0, 3)
                        .join(", ")}${skipped.length > 3 ? "…" : ""}`
                );
            }

            const uniqueIds = Array.from(new Set(selectedIds));
            const cartSnapshot = await API.get("/cart", {
                headers: tokenHeader,
                validateStatus: () => true,
            });

            if (cartSnapshot.status !== 200) {
                alert(cartSnapshot?.data?.message || "Không thể đồng bộ giỏ hàng, vui lòng thử lại.");
                return;
            }

            const cartItems = Array.isArray(cartSnapshot.data?.items) ? cartSnapshot.data.items : [];
            const matchedIds = cartItems
                .map((line) => String(line?.product?._id || line?.product?.id || line?.product || line?.id || ""))
                .filter((pid) => pid && uniqueIds.includes(pid));

            if (!matchedIds.length) {
                alert("Không có sản phẩm nào được thêm vào giỏ. Vui lòng kiểm tra tồn kho.");
                return;
            }

            const customer = order.customer || {};
            const repeatState = {
                repeatOrder: {
                    selectedProductIds: matchedIds,
                    form: {
                        fullName: customer.name || "",
                        address: customer.address || "",
                        phone: customer.phone || "",
                        email: customer.email || "",
                        note: customer.note || "",
                    },
                    paymentMethod: typeof order.payment === 'object' ? order.payment?.gateway : (order.payment || "COD"),
                },
            };

            navigate(ROUTERS.USER.CHECKOUT, { state: repeatState });
        } catch (err) {
            alert(err?.message || "Không thể chuẩn bị đơn hàng mới, vui lòng thử lại.");
        } finally {
            setReorderLoading(null);
        }
    };

    return (
        <>
        <Breadcrumb paths={[{ label: "Đơn mua" }]} />
        <div className="container orders-page-container">
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
                {/* Chi tiết đơn hàng được chọn - hiển thị ở đầu */}
                {selectedOrderId && (() => {
                    const selectedOrder = orders.find(o => String(o._id || o.id || "") === selectedOrderId);
                    if (!selectedOrder) return null;
                    
                    const id = String(selectedOrder._id || selectedOrder.id || "");
                    const meta = orderMeta.get(id) || {};
                    const paymentPath = ROUTERS.USER.PAYMENT.replace(":id", id);
                    const isReorderLoading = reorderLoading === id;
                    const { methodLabel, channelLabel } = resolvePaymentLabels(selectedOrder);
                    const total = selectedOrder?.amount?.total ?? selectedOrder?.amount ?? 0;
                    
                    return (
                        <div className="order-detail-card">
                            <div className={`order-detail-header header-status-${selectedOrder?.status || "pending"}`}>
                                <div className="order-detail-header-left">
                                    <h3>Chi tiết đơn hàng #{id.slice(-8).toUpperCase()}</h3>
                                    <span className={`badge-large status-${selectedOrder?.status || "pending"}`}>
                                        {selectedOrder?.status === "paid" ? "ĐÃ THANH TOÁN" : 
                                         selectedOrder?.status === "cancelled" ? "ĐÃ HỦY" :
                                         selectedOrder?.status === "pending" ? "CHỜ THANH TOÁN" :
                                         selectedOrder?.status?.toUpperCase()}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close-detail"
                                    onClick={() => setSelectedOrderId(null)}
                                    aria-label="Đóng chi tiết"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="order-detail-body">
                                {/* Thông tin khách hàng */}
                                <section className="detail-section">
                                    <h4 className="detail-section-title">Thông tin người nhận</h4>
                                    <div className="detail-info-grid">
                                        <div className="info-item">
                                            <span className="info-label">Tên:</span>
                                            <span className="info-value">{selectedOrder?.customer?.name}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Điện thoại:</span>
                                            <span className="info-value">{selectedOrder?.customer?.phone}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Email:</span>
                                            <span className="info-value">{selectedOrder?.customer?.email}</span>
                                        </div>
                                        <div className="info-item full-width">
                                            <span className="info-label">Địa chỉ:</span>
                                            <span className="info-value">{selectedOrder?.customer?.address}</span>
                                        </div>
                                        {selectedOrder?.customer?.note && (
                                            <div className="info-item full-width">
                                                <span className="info-label">Ghi chú:</span>
                                                <span className="info-value">{selectedOrder.customer.note}</span>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Thông tin thanh toán */}
                                <section className="detail-section">
                                    <h4 className="detail-section-title">Thông tin thanh toán</h4>
                                    <div className="detail-info-grid">
                                        <div className="info-item">
                                            <span className="info-label">Phương thức:</span>
                                            <span className="info-value">{methodLabel}</span>
                                        </div>
                                        {channelLabel && (
                                            <div className="info-item">
                                                <span className="info-label">Kênh:</span>
                                                <span className="info-value">{channelLabel}</span>
                                            </div>
                                        )}
                                        {selectedOrder?.paymentCompletedAt && (
                                            <div className="info-item full-width">
                                                <span className="info-label">Hoàn tất lúc:</span>
                                                <span className="info-value highlight-success">
                                                    {formatDateTime(selectedOrder.paymentCompletedAt)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Danh sách sản phẩm */}
                                <section className="detail-section">
                                    <div className="table__cart" style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: "left" }}>Sản phẩm</th>
                                                    <th style={{ textAlign: "right" }}>Đơn giá</th>
                                                    <th style={{ textAlign: "right" }}>SL</th>
                                                    <th style={{ textAlign: "right" }}>Thành tiền</th>
                                                    {selectedOrder.status === "paid" && (
                                                        <th style={{ textAlign: "center" }}>Đánh giá</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedOrder?.items || []).map((it, idx) => {
                                                    const productId = it?.product?._id || it?.product?.id || it?.product || it?.id || "";
                                                    const imgSrc = Array.isArray(it.image) ? (it.image[0] || "") : (it.image || "");
                                                    return (
                                                        <tr key={idx}>
                                                            <td style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                                                                {imgSrc && (
                                                                    <img
                                                                        src={imgSrc}
                                                                        alt={it.name}
                                                                        style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                                                                    />
                                                                )}
                                                                <span style={{ whiteSpace: "nowrap" }}>{it.name}</span>
                                                            </td>
                                                            <td style={{ textAlign: "right" }}>{formatter(it.price)}</td>
                                                            <td style={{ textAlign: "right" }}>{it.quantity}</td>
                                                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                                                                {formatter(it.total ?? it.price * it.quantity)}
                                                            </td>
                                                            {selectedOrder.status === "paid" && (
                                                                <td style={{ textAlign: "center" }}>
                                                                    <button
                                                                        className="btn-review-product"
                                                                        onClick={() => navigate(`/product/detail/${productId}`)}
                                                                        title="Đánh giá sản phẩm"
                                                                    >
                                                                        ⭐ Đánh giá
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td colSpan="2" />
                                                    <td style={{ textAlign: "right" }}><b>Tạm tính:</b></td>
                                                    <td style={{ textAlign: "right" }}>{formatter(selectedOrder?.amount?.subtotal ?? 0)}</td>
                                                </tr>
                                                <tr>
                                                    <td colSpan="2" />
                                                    <td style={{ textAlign: "right" }}><b>Vận chuyển:</b></td>
                                                    <td style={{ textAlign: "right" }}>{formatter(selectedOrder?.amount?.shipping ?? 0)}</td>
                                                </tr>
                                                {(selectedOrder?.amount?.discount ?? 0) > 0 && (
                                                    <tr>
                                                        <td colSpan="2" />
                                                        <td style={{ textAlign: "right" }}><b>Giảm giá:</b></td>
                                                        <td style={{ textAlign: "right", color: "#ef4444" }}>
                                                            -{formatter(selectedOrder?.amount?.discount ?? 0)}
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr className="total-row">
                                                    <td colSpan="2" />
                                                    <td style={{ textAlign: "right" }}><b>Tổng thanh toán:</b></td>
                                                    <td style={{ textAlign: "right" }}><b>{formatter(total)}</b></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </section>

                                {/* Trạng thái và hành động */}
                                {selectedOrder.status === "pending" && meta.stillValid && (
                                    <div className="order-status-alert alert-warning">
                                        <div>
                                            <h4>⏰ Thanh toán còn hạn</h4>
                                            <p>
                                                Đơn hàng sẽ tự động hủy nếu chưa thanh toán trong <strong>{meta.countdown}</strong> nữa.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="button-submit"
                                            onClick={() => navigate(paymentPath)}
                                        >
                                            Tiếp tục thanh toán
                                        </button>
                                    </div>
                                )}

                                {selectedOrder.status !== "pending" && (
                                    <div className="order-detail-actions">
                                        <button
                                            type="button"
                                            className="btn-reorder"
                                            onClick={() => handleRepeatOrder(selectedOrder)}
                                            disabled={isReorderLoading}
                                        >
                                            {isReorderLoading ? "Đang chuẩn bị…" : "Đặt lại đơn"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Bảng danh sách đơn hàng */}
                <table className="table table-striped orders-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: selectedOrderId ? "24px" : "0" }}>
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
                    const meta = orderMeta.get(id) || {};
                    const { methodLabel, channelLabel } = resolvePaymentLabels(o);

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
                        <td>
                            <div className="payment-method-label">{methodLabel}</div>
                            {channelLabel ? (
                                <div className="payment-channel-label">{channelLabel}</div>
                            ) : null}
                            {meta.stillValid ? (
                            <div className="payment-countdown">Còn {meta.countdown} để thanh toán</div>
                            ) : null}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatter(total)}</td>
                        <td style={{ width: 1, whiteSpace: "nowrap" }}>
                            <button
                            type="button"
                            className={`link-btn ${selectedOrderId === id ? 'active' : ''}`}
                            onClick={() => toggleOpen(id)}
                            aria-expanded={selectedOrderId === id}
                            >
                            {selectedOrderId === id ? "Thu gọn" : "Xem chi tiết"}
                            </button>
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
            )}
        </div>
        </>
    );
};

export default memo(OrdersPage);
