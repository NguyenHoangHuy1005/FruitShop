import React, { useState, useEffect } from "react";
import { API } from "../../redux/apiRequest";
import { useSelector } from "react-redux";
import "./style.scss";

const OrderDetailModal = ({ orderId, onClose }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = useSelector((state) => state.auth?.login?.currentUser);

    useEffect(() => {
        const fetchOrderDetail = async () => {
            if (!orderId || !user?.accessToken) return;

            try {
                setLoading(true);
                const res = await API.get(`/order/${orderId}`, {
                    headers: { Authorization: `Bearer ${user.accessToken}` },
                });

                if (res.status === 200) {
                    setOrder(res.data);
                }
            } catch (error) {
                console.error("Error fetching order detail:", error);
                alert("Không thể tải thông tin đơn hàng");
                onClose();
            } finally {
                setLoading(false);
            }
        };

        fetchOrderDetail();
    }, [orderId, user?.accessToken, onClose]);

    if (loading) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="order-detail-modal loading" onClick={(e) => e.stopPropagation()}>
                    <p>⏳ Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!order) return null;

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: "⏳ Chờ xử lý", class: "pending" },
            paid: { text: "💳 Đã thanh toán", class: "paid" },
            shipped: { text: "🚚 Đang giao", class: "shipped" },
            completed: { text: "✅ Hoàn thành", class: "completed" },
            cancelled: { text: "❌ Đã hủy", class: "cancelled" },
        };
        return badges[status] || { text: status, class: "" };
    };

    const statusBadge = getStatusBadge(order.status);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Chi tiết đơn hàng</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {/* Order Info */}
                    <div className="order-info-section">
                        <div className="info-row">
                            <span className="label">Mã đơn:</span>
                            <span className="value order-id">#{order._id?.slice(-8).toUpperCase()}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Trạng thái:</span>
                            <span className={`status-badge ${statusBadge.class}`}>
                                {statusBadge.text}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="label">Ngày đặt:</span>
                            <span className="value">
                                {new Date(order.createdAt).toLocaleString("vi-VN")}
                            </span>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="customer-section">
                        <h3>Thông tin khách hàng</h3>
                        <div className="info-row">
                            <span className="label">Tên:</span>
                            <span className="value">{order.customer?.name || order.guestInfo?.name}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Điện thoại:</span>
                            <span className="value">{order.customer?.phone || order.guestInfo?.phone}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Email:</span>
                            <span className="value">{order.customer?.email || order.guestInfo?.email}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">Địa chỉ:</span>
                            <span className="value">{order.customer?.address || order.guestInfo?.address}</span>
                        </div>
                        {order.customer?.note && (
                            <div className="info-row">
                                <span className="label">Ghi chú:</span>
                                <span className="value">{order.customer.note}</span>
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <div className="items-section">
                        <h3>Sản phẩm ({order.items?.length || 0})</h3>
                        <div className="items-list">
                            {order.items?.map((item, index) => (
                                <div key={index} className="order-item">
                                    <div className="item-image">
                                        {item.image?.[0] ? (
                                            <img src={item.image[0]} alt={item.name} />
                                        ) : (
                                            <div className="no-image">📦</div>
                                        )}
                                    </div>
                                    <div className="item-details">
                                        <div className="item-name">{item.name}</div>
                                        <div className="item-quantity">
                                            Số lượng: {item.quantity}
                                        </div>
                                    </div>
                                    <div className="item-price">
                                        {(item.price * item.quantity).toLocaleString()} ₫
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="payment-section">
                        <h3>Thanh toán</h3>
                        <div className="payment-row">
                            <span className="label">Tạm tính:</span>
                            <span className="value">{order.amount?.subtotal?.toLocaleString()} ₫</span>
                        </div>
                        {order.amount?.discount > 0 && (
                            <div className="payment-row discount">
                                <span className="label">Giảm giá:</span>
                                <span className="value">-{order.amount.discount.toLocaleString()} ₫</span>
                            </div>
                        )}
                        <div className="payment-row">
                            <span className="label">Phí vận chuyển:</span>
                            <span className="value">{order.amount?.shipping?.toLocaleString()} ₫</span>
                        </div>
                        <div className="payment-row total">
                            <span className="label">Tổng cộng:</span>
                            <span className="value">{order.amount?.total?.toLocaleString()} ₫</span>
                        </div>
                        <div className="payment-method">
                            Phương thức: {order.payment === "COD" ? "💵 Thanh toán khi nhận hàng" : "💳 Chuyển khoản"}
                        </div>
                    </div>
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
