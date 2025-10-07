// src/pages/user/orders/index.jsx
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import { formatter } from "../../../utils/fomater";
import {
    API,
    addToCart,
    cancelOrder,
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
    BANK: "Chuyển khoản ngân hàng (VietQR)",
    VNPAY: "Cổng VNPAY / Thẻ quốc tế",
};

const PAYMENT_CHANNEL_LABELS = {
    vietqr: "Quét mã VietQR - Ngân hàng nội địa",
    card: "QR thẻ quốc tế (Visa/Mastercard)",
    momo: "Ví MoMo",
};

const PAYMENT_CANCEL_REASON_LABELS = {
    timeout: "Đơn hàng đã được hủy tự động do quá hạn thanh toán. Kho đã được hoàn lại.",
    user_cancelled: "Đơn hàng đã được bạn hủy.",
    admin_cancelled: "Đơn hàng đã được quản trị viên hủy.",
};

const resolvePaymentLabels = (order) => {
    const methodCode = order?.payment;
    const channelCode = order?.paymentMeta?.channel;
    const methodLabel = PAYMENT_METHOD_LABELS[methodCode] || methodCode || "Không xác định";
    const channelLabel = channelCode && PAYMENT_CHANNEL_LABELS[channelCode]
        ? PAYMENT_CHANNEL_LABELS[channelCode]
        : "";
    return { methodLabel, channelLabel };
};

const resolveCancelMessage = (order) => {
    if (!order || order.status !== "cancelled") return "";
    const reason = order?.paymentMeta?.cancelReason;
    if (reason && PAYMENT_CANCEL_REASON_LABELS[reason]) {
        return PAYMENT_CANCEL_REASON_LABELS[reason];
    }
    return "Đơn hàng đã được hủy.";
};

const OrdersPage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector((s) => s.auth?.login?.currentUser);

    const [orders, setOrders] = useState([]);
    const [openIds, setOpenIds] = useState(() => new Set()); // toggle chi tiết từng đơn
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [now, setNow] = useState(() => Date.now());
    const [reorderLoading, setReorderLoading] = useState(null);
    const [reloadTick, setReloadTick] = useState(0);
    const refreshOnExpiryRef = useRef(false);

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
        setOpenIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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
                    paymentMethod: order.payment || "COD",
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
                    const meta = orderMeta.get(id) || {};
                    const paymentPath = ROUTERS.USER.PAYMENT.replace(":id", id);
                    const isReorderLoading = reorderLoading === id;
                    const { methodLabel, channelLabel } = resolvePaymentLabels(o);
                    const cancelMessage = resolveCancelMessage(o);
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
                                
                                <div style={{ marginBottom: 12, lineHeight: 1.6 }}>
                                    <b>Thanh toán: </b>
                                    {methodLabel}
                                    {channelLabel ? (
                                        <span className="payment-channel-inline"> — {channelLabel}</span>
                                    ) : null}
                                    {o?.paymentCompletedAt ? (
                                        <>
                                            <br />
                                            <span className="payment-timestamp">
                                                Hoàn tất lúc: {formatDateTime(o.paymentCompletedAt)}
                                            </span>
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
                                {o.status === "pending" && meta.stillValid && (
                                    <div className="order-payment-reminder">
                                        <div className="order-payment-reminder__content">
                                            <h4>Thanh toán còn hạn</h4>
                                            <p>
                                                Đơn hàng sẽ tự động hủy nếu chưa thanh toán trong <strong>{meta.countdown}</strong> nữa.
                                            </p>
                                        </div>
                                        <div className="order-payment-reminder__actions">
                                            <button
                                                type="button"
                                                className="button-submit"
                                                onClick={() => navigate(paymentPath)}
                                            >
                                                Tiếp tục thanh toán
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {o.status === "pending" && meta.expired && (
                                    <div className="order-payment-expired">
                                        <strong>Thanh toán đã quá hạn.</strong> Hệ thống sẽ sớm hủy đơn và hoàn lại tồn kho sản phẩm.
                                    </div>
                                )}
                                {o.status === "cancelled" && cancelMessage && (
                                    <div className="order-payment-cancelled">{cancelMessage}</div>
                                )}
                                <div className="order-actions">
                                    <button
                                        type="button"
                                        className="btn-reorder"
                                        onClick={() => handleRepeatOrder(o)}
                                        disabled={isReorderLoading}
                                    >
                                        {isReorderLoading ? "Đang chuẩn bị…" : "Đặt lại đơn"}
                                    </button>
                                    {o.status === "pending" && (
                                        <button
                                            type="button"
                                            className="btn-cancel"
                                            onClick={async () => {
                                                if (!window.confirm("Bạn có chắc chắn muốn hủy đơn này? (Mã giảm giá sẽ không được hoàn lại)")) return;
                                                try {
                                                    const res = await cancelOrder(o._id, user?.accessToken); // dùng o._id
                                                    setOrders((prev) =>
                                                        prev.map((ord) =>
                                                            ord._id === o._id ? { ...ord, status: "cancelled" } : ord
                                                        )
                                                    );
                                                    alert(res.message || "Đơn hàng đã được hủy.");
                                                } catch (err) {
                                                    alert(err.message || "Không thể hủy đơn.");
                                                }
                                            }}
                                            disabled={isReorderLoading}
                                        >
                                            Hủy đơn
                                        </button>
                                    )}
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
