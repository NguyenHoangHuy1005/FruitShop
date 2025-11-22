// src/pages/users/ordersPage/index.jsx
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import { formatter } from "../../../utils/fomater";
import {
  API,
  addToCart,
  cancelOrder,
  confirmDelivered,
} from "../../../component/redux/apiRequest";
import OrderStatusTag, { normalizeOrderStatus } from "../../../component/orders/OrderStatusTag";
import OrderActions from "../../../component/orders/OrderActions";
import { ROUTERS } from "../../../utils/router";
import "./style.scss";

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
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth?.login?.currentUser);

  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({ id: null, key: "" });
  const [pendingCountdownMs, setPendingCountdownMs] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const orderDetailRef = useRef(null);

  const setActionLoading = (id, key) => setActionState({ id, key });
  const clearActionLoading = () => setActionState({ id: null, key: "" });

  const tokenHeader = useMemo(() => {
    const bearer = user?.accessToken ? `Bearer ${user.accessToken}` : "";
    return bearer ? { Authorization: bearer } : {};
  }, [user?.accessToken]);

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/order/me", {
        headers: tokenHeader,
        validateStatus: () => true,
      });
      if (res.status === 200 && Array.isArray(res.data)) {
        setOrders(res.data);
      } else {
        const msg = res?.data?.message || `Không tải được danh sách đơn (HTTP ${res.status}).`;
        setError(msg);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Lỗi tải đơn hàng.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.accessToken) {
      navigate(ROUTERS.ADMIN.LOGIN, { replace: true });
      return;
    }
    fetchOrders();
  }, [user?.accessToken, reloadTick]);

  const selectedOrder = useMemo(
    () => orders.find((o) => String(o._id || o.id || "") === selectedOrderId),
    [orders, selectedOrderId]
  );
  const selectedOrderKey = selectedOrder ? String(selectedOrder._id || selectedOrder.id || "") : "";
  const selectedOrderTimestamp = selectedOrder?.createdAt || selectedOrder?.updatedAt;
  const detailActionKey = actionState.id === selectedOrderKey ? actionState.key : "";

  const refresh = () => setReloadTick((t) => t + 1);

  const handleConfirmReceived = async (orderId) => {
    try {
      setActionLoading(orderId, "confirm");
      await confirmDelivered(orderId, user?.accessToken);
      alert("Đã xác nhận hoàn tất đơn hàng.");
      refresh();
    } catch (err) {
      alert(err?.message || "Xác nhận thất bại.");
    } finally {
      clearActionLoading();
    }
  };

const handleCancelOrder = async (orderId) => {
    if (!orderId) return;
    if (!window.confirm("Bạn chắc chắn muốn hủy đơn này?")) return;
    try {
      setActionLoading(orderId, "cancel");
      await cancelOrder(orderId, user?.accessToken);
      alert("Đã hủy đơn hàng.");
      setSelectedOrderId(null);
      refresh();
    } catch (err) {
      alert(err?.message || "Hủy đơn thất bại.");
    } finally {
      clearActionLoading();
    }
  };

const handleRepeatOrder = async (orderOrId, maybeOrder) => {
    const order = maybeOrder || orderOrId;
    if (!order) return;
    const id = String(order._id || order.id || orderOrId || "");
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
      alert("Đơn hàng không có sản phẩm để đặt lại.");
      return;
    }

    setActionLoading(id, "reorder");
    try {
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
        alert(cartSnapshot?.data?.message || "Không thể đồng bộ giỏ hàng.");
        return;
      }

      const cartItems = Array.isArray(cartSnapshot.data?.items) ? cartSnapshot.data.items : [];
      const matchedIds = cartItems
        .map((line) => String(line?.product?._id || line?.product?.id || line?.product || line?.id || ""))
        .filter((pid) => pid && selectedIds.includes(pid));

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
          paymentMethod:
            typeof order.payment === "object" ? order.payment?.gateway : order.payment || "COD",
        },
      };

      navigate(ROUTERS.USER.CHECKOUT, { state: repeatState });
    } catch (err) {
      alert(err?.message || "Không thể chuẩn bị đơn mới, vui lòng thử lại.");
    } finally {
      clearActionLoading();
    }
  };

const handleReviewOrder = (orderOrId, maybeOrder) => {
    const order = maybeOrder || orderOrId;
    const firstItem = order?.items?.[0];
    const productId = firstItem?.product?._id || firstItem?.product?.id || firstItem?.product || firstItem?.id;
    if (!productId) {
      alert("Không tìm thấy sản phẩm để đánh giá.");
      return;
    }
    navigate(`/product/detail/${productId}`);
  };

const toggleOpen = (id) => {
    setSelectedOrderId((prev) => (prev === id ? null : id));
  };

  const orderStats = useMemo(() => {
    const summary = { total: orders.length, active: 0, completed: 0 };
    orders.forEach((order) => {
      const status = normalizeOrderStatus(order?.status);
      if (["pending", "processing", "shipping", "delivered"].includes(status)) {
        summary.active += 1;
      }
      if (status === "completed") {
        summary.completed += 1;
      }
    });
    return summary;
  }, [orders]);

  const detailStatus = normalizeOrderStatus(selectedOrder?.status);
  const cancelReason = selectedOrder?.paymentMeta?.cancelReason || selectedOrder?.cancelReason || "";
  const locationState = location.state;
  const presetOrderId = locationState?.selectedOrderId;

  useEffect(() => {
    if (presetOrderId) {
      const { selectedOrderId: _preset, ...restState } = locationState || {};
      setSelectedOrderId(String(presetOrderId));
      navigate(location.pathname, { replace: true, state: restState });
    }
  }, [presetOrderId, locationState, location.pathname, navigate]);

  useEffect(() => {
    if (selectedOrder) {
      document.body.classList.add("orders-modal-open");
    } else {
      document.body.classList.remove("orders-modal-open");
    }
    return () => document.body.classList.remove("orders-modal-open");
  }, [selectedOrder]);

  const closeDetail = () => setSelectedOrderId(null);

  useEffect(() => {
    if (!selectedOrder) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeDetail();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedOrder]);

  useEffect(() => {
    if (orderDetailRef.current) {
      orderDetailRef.current.scrollTop = 0;
    }
  }, [selectedOrderKey]);

  useEffect(() => {
    if (!selectedOrder || detailStatus !== "pending") {
      setPendingCountdownMs(null);
      return undefined;
    }
    const deadline = selectedOrder.autoConfirmAt || selectedOrder.paymentDeadline;
    if (!deadline) {
      setPendingCountdownMs(null);
      return undefined;
    }
    const target = new Date(deadline).getTime();
    const tick = () => {
      setPendingCountdownMs(Math.max(0, target - Date.now()));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [selectedOrder, detailStatus]);

  const formatRemainingTime = (ms) => {
    if (ms === null || ms === undefined) return null;
    if (ms <= 0) return "Đã hết hạn";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${String(minutes).padStart(2, "0")}m`);
    parts.push(`${String(seconds).padStart(2, "0")}s`);
    return parts.join(" ");
  };

  const goToPayment = () => {
    if (!selectedOrderKey) return;
    navigate(ROUTERS.USER.PAYMENT.replace(":id", selectedOrderKey));
  };

  return (
    <>
      <Breadcrumb paths={[{ label: "Đơn mua" }]} />
      <section className="orders-page">
        <div className="container orders-page__container">
          <header className="orders-page__header">
            <div className="orders-page__heading">
              <p className="orders-page__eyebrow">Trung tâm đơn hàng</p>
              <h2 className="orders-page__title">Đơn hàng của tôi</h2>
              <p className="orders-page__subtitle">
                Theo dõi trạng thái và quản lý tất cả đơn mua của bạn tại một nơi.
              </p>
            </div>
            <div className="orders-page__metrics">
              <div className="orders-metric">
                <span>Đơn hoạt động</span>
                <strong>{orderStats.active}</strong>
              </div>
              <div className="orders-metric">
                <span>Đơn hoàn tất</span>
                <strong>{orderStats.completed}</strong>
              </div>
              <div className="orders-metric">
                <span>Tổng đơn</span>
                <strong>{orderStats.total}</strong>
              </div>
            </div>
          </header>

          {loading && <p>Đang tải đơn hàng...</p>}
          {!loading && error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && (!orders || orders.length === 0) && (
            <div className="empty-state">
              <p>Bạn chưa có đơn hàng nào.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(ROUTERS.USER.PRODUCTS)}
              >
                Mua sắm ngay
              </button>
            </div>
          )}

          {!loading && !error && orders && orders.length > 0 && (
            <div className="orders-layout">
              <table className="orders-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th className="text-right">Tổng tiền</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const id = String(o._id || o.id || "");
                  const total = o?.amount?.total ?? o?.amount ?? 0;
                  const normalizedRowStatus = normalizeOrderStatus(o?.status);
                  return (
                    <tr key={id}>
                      <td>
                        <div className="code">{id.slice(-8).toUpperCase()}</div>
                      </td>
                      <td>{formatDateTime(o?.createdAt || o?.updatedAt || "")}</td>
                      <td>
                        {normalizedRowStatus ? (
                          <OrderStatusTag status={normalizedRowStatus} />
                        ) : (
                          <span className="status-placeholder">—</span>
                        )}
                      </td>
                      <td>{o?.payment || "COD"}</td>
                      <td className="text-right fw-bold">{formatter(total)}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => toggleOpen(id)}
                        >
                          {selectedOrderId === id ? "Đóng" : "Xem chi tiết"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}
          {selectedOrder && (
            <div className="order-detail-overlay" onClick={closeDetail}>
              <div
                className="order-detail-panel"
                onClick={(e) => e.stopPropagation()}
                ref={orderDetailRef}
                role="dialog"
                aria-modal="true"
              >
                <div className={`order-detail-card${detailStatus ? ` order-detail-card--${detailStatus}` : ""}`}>
                  <div className="order-detail-header">
                    <div className="order-detail-header__meta">
                      <div>
                        <p className="order-detail-code">
                          Đơn #{String(selectedOrder._id || selectedOrder.id).slice(-8).toUpperCase()}
                        </p>
                        {selectedOrderTimestamp && (
                          <span className="order-detail-date">{formatDateTime(selectedOrderTimestamp)}</span>
                        )}
                      </div>
                      <div className="order-detail-header__actions">
                        <OrderStatusTag status={selectedOrder.status} />
                        <button
                          type="button"
                          className="btn btn-secondary btn-close"
                          onClick={closeDetail}
                          aria-label="Đóng chi tiết"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="order-detail-body">
                    {detailStatus === "cancelled" && (
                      <div className="order-cancel-reason">
                        <strong>Ly do huy:</strong> {cancelReason || "Khong co ly do"}
                      </div>
                    )}
                    <section className="detail-section detail-section--grid">
                      <div className="section-header">
                        <h4 className="detail-section__title">Thông tin người nhận</h4>
                        <div className="section-meta">
                          {selectedOrder?.customer?.phone && <span>{selectedOrder.customer.phone}</span>}
                          {selectedOrder?.customer?.email && <span>{selectedOrder.customer.email}</span>}
                        </div>
                      </div>
                      <div className="detail-info-grid">
                        <div className="info-item">
                          <span className="info-label">Tên</span>
                          <span className="info-value">{selectedOrder?.customer?.name}</span>
                        </div>
                        <div className="info-item info-item--full">
                          <span className="info-label">Địa chỉ</span>
                          <span className="info-value">{selectedOrder?.customer?.address}</span>
                        </div>
                        {selectedOrder?.customer?.note && (
                          <div className="info-item info-item--full">
                            <span className="info-label">Ghi chú</span>
                            <span className="info-value">{selectedOrder.customer.note}</span>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="detail-section detail-section--summary">
                      <div className="summary-cards">
                        <div className="summary-card">
                          <span>Phương thức thanh toán</span>
                          <strong>{selectedOrder?.payment || "COD"}</strong>
                        </div>
                        {selectedOrder?.amount?.total && (
                          <div className="summary-card summary-card--highlight">
                            <span>Tổng thanh toán</span>
                            <strong>{formatter(selectedOrder.amount.total)}</strong>
                          </div>
                        )}
                        {selectedOrder?.paymentCompletedAt && (
                          <div className="summary-card">
                            <span>Hoàn tất lúc</span>
                            <strong>{formatDateTime(selectedOrder.paymentCompletedAt)}</strong>
                          </div>
                        )}
                      </div>
                      {detailStatus === "pending" && (selectedOrder?.autoConfirmAt || selectedOrder?.paymentDeadline) && (
                        <div className="pending-payment">
                          <div className="pending-payment__info">
                            <span>Thời gian còn lại</span>
                            <strong>{formatRemainingTime(pendingCountdownMs)}</strong>
                          </div>
                          <button type="button" className="btn btn-primary" onClick={goToPayment}>
                            Đi tới thanh toán
                          </button>
                        </div>
                      )}
                    </section>

                    <section className="detail-section">
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Sản phẩm</th>
                              <th className="text-right">Đơn giá</th>
                              <th className="text-right">SL</th>
                              <th className="text-right">Thành tiền</th>
                              {detailStatus === "completed" && <th className="text-center">Đánh giá</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedOrder?.items || []).map((it) => {
                              const productId = it?.product?._id || it?.product?.id || it?.product || it?.id || "";
                              const imgSrc = Array.isArray(it.image) ? (it.image[0] || "") : it.image || "";
                              return (
                                <tr key={`${productId}-${it.name}`}>
                                  <td className="item-cell">
                                    {imgSrc && <img src={imgSrc} alt={it.name} />}
                                    <span>{it.name}</span>
                                  </td>
                                  <td className="text-right">{formatter(it.price)}</td>
                                  <td className="text-right">{it.quantity}</td>
                                  <td className="text-right fw-bold">{formatter(it.total ?? it.price * it.quantity)}</td>
                                  {detailStatus === "completed" && (
                                    <td className="text-center">
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => navigate(`/product/detail/${productId}`)}
                                      >
                                        ✩ Đánh giá
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
                              <td className="text-right"><b>Tạm tính</b></td>
                              <td className="text-right">{formatter(selectedOrder?.amount?.subtotal ?? 0)}</td>
                            </tr>
                            <tr>
                              <td colSpan="2" />
                              <td className="text-right"><b>Vận chuyển</b></td>
                              <td className="text-right">{formatter(selectedOrder?.amount?.shipping ?? 0)}</td>
                            </tr>
                            {(selectedOrder?.amount?.discount ?? 0) > 0 && (
                              <tr>
                                <td colSpan="2" />
                                <td className="text-right"><b>Giảm giá</b></td>
                                <td className="text-right text-danger">-{formatter(selectedOrder?.amount?.discount ?? 0)}</td>
                              </tr>
                            )}
                            <tr className="total-row">
                              <td colSpan="2" />
                              <td className="text-right"><b>Tổng thanh toán</b></td>
                              <td className="text-right"><b>{formatter(selectedOrder?.amount?.total ?? 0)}</b></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </section>

                    <OrderActions
                      order={selectedOrder}
                      role="user"
                      onConfirmReceived={handleConfirmReceived}
                      onReorder={handleRepeatOrder}
                      onCancel={handleCancelOrder}
                      onReview={handleReviewOrder}
                      loadingAction={detailActionKey}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default memo(OrdersPage);
