import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API, addToCart, confirmDelivered } from "../../redux/apiRequest";
import OrderStatusTag, { normalizeOrderStatus } from "../../orders/OrderStatusTag";
import OrderActions from "../../orders/OrderActions";
import { formatter } from "../../../utils/fomater";
import "./style.scss";

const getPaymentMethodDisplay = (payment) => {
    if (!payment) return "COD";
    if (typeof payment === "string") return payment;
    if (typeof payment === "object") {
        return payment.gateway || payment.method || "COD";
    }
    return "COD";
};

const OrderDetailModal = ({ orderId, onClose }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionKey, setActionKey] = useState("");
    const user = useSelector((state) => state.auth?.login?.currentUser);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const tokenHeader = useMemo(
        () => (user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
        [user?.accessToken]
    );

    const fetchOrderDetail = async () => {
        if (!orderId || !user?.accessToken) return;
        try {
            setLoading(true);
            const res = await API.get(`/order/${orderId}`, {
                headers: tokenHeader,
                validateStatus: () => true,
            });
            if (res.status === 200) {
                setOrder(res.data);
                return;
            }
            throw new Error(res?.data?.message || `HTTP ${res.status}`);
        } catch (error) {
            console.error("Error fetching order detail:", error);
            alert("Khong the tai thong tin don hang.");
            onClose?.();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrderDetail();
    }, [orderId, user?.accessToken]);

    const normalizedStatus = normalizeOrderStatus(order?.status);
    const cancelReason = order?.paymentMeta?.cancelReason || order?.cancelReason || "";

    const handleConfirmReceived = async (id) => {
        const targetId = id || orderId;
        if (!targetId) return;
        try {
            setActionKey("confirm");
            const res = await confirmDelivered(targetId, user?.accessToken);
            if (res?.order) {
                setOrder(res.order);
            } else {
                await fetchOrderDetail();
            }
            alert("Da xac nhan don hoan tat.");
        } catch (err) {
            alert(err?.message || "Xac nhan that bai.");
        } finally {
            setActionKey("");
        }
    };

    const handleRepeatOrder = async (_id, maybeOrder) => {
        const current = maybeOrder || order;
        if (!current) return;
        const items = Array.isArray(current.items) ? current.items : [];
        if (!items.length) {
            alert("Don hang khong co san pham de dat lai.");
            return;
        }

        try {
            setActionKey("reorder");
            const selectedIds = [];
            for (const line of items) {
                const productId = line?.product?._id || line?.product?.id || line?.product || line?.id;
                const qty = Math.max(1, Number(line?.quantity) || 1);
                if (!productId) continue;
                selectedIds.push(String(productId));
                await addToCart(productId, qty, dispatch);
            }

            const cartSnapshot = await API.get("/cart", {
                headers: tokenHeader,
                validateStatus: () => true,
            });
            if (cartSnapshot.status !== 200) {
                alert(cartSnapshot?.data?.message || "Khong the dong bo gio hang.");
                return;
            }

            const cartItems = Array.isArray(cartSnapshot.data?.items) ? cartSnapshot.data.items : [];
            const matchedIds = cartItems
                .map((line) => String(line?.product?._id || line?.product?.id || line?.product || line?.id || ""))
                .filter((pid) => pid && selectedIds.includes(pid));

            if (!matchedIds.length) {
                alert("Khong co san pham nao duoc them vao gio.");
                return;
            }

            const customer = current.customer || {};
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
                    paymentMethod:
                        typeof current.payment === "object" ? current.payment?.gateway : current.payment || "COD",
                },
            };

            onClose?.();
            navigate("/checkout", { state: repeatState });
        } catch (err) {
            alert(err?.message || "Khong the chuan bi don moi.");
        } finally {
            setActionKey("");
        }
    };

    const handleReview = (_id, maybeOrder) => {
        const current = maybeOrder || order;
        const firstItem = current?.items?.[0];
        const productId =
            firstItem?.product?._id ||
            firstItem?.product?.id ||
            firstItem?.product ||
            firstItem?.id;
        if (!productId) {
            alert("Khong tim thay san pham de danh gia.");
            return;
        }
        onClose?.();
        navigate(`/product/detail/${productId}`);
    };

    if (loading) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="order-detail-modal loading" onClick={(e) => e.stopPropagation()}>
                    <p>Dang tai don hang...</p>
                </div>
            </div>
        );
    }

    if (!order) return null;

    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
    const shippingDisplay = Number(order?.amount?.shipping || order?.shippingFee || order?.shippingFeeActual || 0);
    const totalDisplay = Math.max(0, Number(order?.amount?.total || 0) + shippingDisplay);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>Chi tiet don hang</h2>
                        <p className="order-id">#{String(order._id || "").slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="modal-header__meta">
                        <OrderStatusTag status={order.status} />
                        <button className="close-btn" onClick={onClose}>Dong</button>
                    </div>
                </div>

                <div className="modal-body">
                    <div className="order-info-section">
                        <div className="info-row">
                            <span className="label">Ngay dat:</span>
                            <span className="value">{new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                        {normalizedStatus === "cancelled" && (
                            <div className="info-row info-row--muted">
                                <span className="label">Ly do huy:</span>
                                <span className="value">{cancelReason || "Khong co ly do"}</span>
                            </div>
                        )}
                    </div>

                    <div className="customer-section">
                        <h3>Thong tin khach hang</h3>
                        <div className="info-row">
                            <span className="label">Ten:</span>
                            <span className="value">{order.customer?.name || order.guestInfo?.name}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Dien thoai:</span>
                            <span className="value">{order.customer?.phone || order.guestInfo?.phone}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Email:</span>
                            <span className="value">{order.customer?.email || order.guestInfo?.email}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Dia chi:</span>
                            <span className="value">{order.customer?.address || order.guestInfo?.address}</span>
                        </div>
                        {order.customer?.note && (
                            <div className="info-row">
                                <span className="label">Ghi chu:</span>
                                <span className="value">{order.customer.note}</span>
                            </div>
                        )}
                    </div>

                    <div className="items-section">
                        <h3>San pham ({itemCount})</h3>
                        <div className="items-list">
                            {order.items?.map((item, index) => {
                                const thumb = Array.isArray(item.image) ? item.image[0] : item.image;
                                return (
                                    <div key={index} className="order-item">
                                        <div className="item-image">
                                            {thumb ? (
                                                <img src={thumb} alt={item.name} />
                                            ) : (
                                                <div className="no-image">?</div>
                                            )}
                                        </div>
                                        <div className="item-details">
                                            <div className="item-name">{item.name}</div>
                                            <div className="item-quantity">So luong: {item.quantity}</div>
                                        </div>
                                        <div className="item-price">{formatter(item.price * item.quantity)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="payment-section">
                        <h3>Thanh toán</h3>
                        <div className="payment-row">
                            <span className="label">Tạm tính:</span>
                            <span className="value">{formatter(order.amount?.subtotal || 0)}</span>
                        </div>
                        {order.amount?.discount > 0 && (
                            <div className="payment-row discount">
                                <span className="label">Giảm giá:</span>
                                <span className="value">-{formatter(order.amount.discount)}</span>
                            </div>
                        )}
                        <div className="payment-row">
                            <span className="label">Phí vận chuyển:</span>
                            <span className="value">{formatter(shippingDisplay)}</span>
                        </div>
                        <div className="payment-row total">
                            <span className="label">Tổng cộng:</span>
                            <span className="value">{formatter(totalDisplay)}</span>
                        </div>
                        <div className="payment-method">
                            Phương thức: {getPaymentMethodDisplay(order.payment)}
                        </div>
                    </div>

                    <OrderActions
                        order={order}
                        role="user"
                        onConfirmReceived={handleConfirmReceived}
                        onReorder={handleRepeatOrder}
                        onReview={handleReview}
                        loadingAction={actionKey}
                    />
                </div>

                <div className="modal-footer">
                    <button className="btn-close" onClick={onClose}>
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailModal;
