import { normalizeOrderStatus } from "./OrderStatusTag";
import "./orderStatus.scss";

const ONLINE_BLOCKLIST = ["COD"];

const resolvePaymentCode = (payment) => {
  if (!payment) return "";
  if (typeof payment === "string") return payment.toUpperCase();
  return (
    payment.gateway ||
    payment.method ||
    payment.type ||
    payment.code ||
    ""
  ).toString().toUpperCase();
};

const hasSuccessfulOnlinePayment = (order) => {
  if (!order) return false;
  const paymentCode = resolvePaymentCode(order.payment);
  if (!paymentCode || ONLINE_BLOCKLIST.includes(paymentCode)) return false;
  const paymentMetaStatus = String(order?.paymentMeta?.status || "").toLowerCase();
  const paidFlags = [
    Boolean(order?.paymentCompletedAt),
    Boolean(order?.paymentMeta?.paidAt),
    Boolean(order?.paymentMeta?.completedAt),
    ["paid", "success", "completed"].includes(paymentMetaStatus),
  ];
  return paidFlags.some(Boolean);
};

const noop = () => {};

const OrderActions = ({
  order,
  role = "user",
  onAccept = noop,
  onMarkDelivered = noop,
  onMarkFailed = noop,
  onConfirmReceived = noop,
  onReorder = noop,
  onReview = noop,
  onCancel = noop,
  loadingAction = "",
  compact = false,
}) => {
  const id = order?._id || order?.id;
  if (!id) return null;

  const status = normalizeOrderStatus(order?.status);
  const paidOnline = hasSuccessfulOnlinePayment(order);
  const actions = [];
  const baseClass = compact ? "action-btn action-btn--compact" : "action-btn";

  const pushAction = (key, label, extraClass, handler) => {
    actions.push(
      <button
        key={key}
        type="button"
        className={`${baseClass} ${extraClass}`}
        onClick={() => handler(id, order)}
        disabled={!!loadingAction && loadingAction !== key}
      >
        {loadingAction === key ? "Đang xử lý..." : label}
      </button>
    );
  };

  if (role === "shipper") {
    if (status === "processing") {
      pushAction("accept", "Nhận đơn", "action-btn--accept", onAccept);
    }
    if (status === "shipping") {
      pushAction("delivered", "Giao thành công", "action-btn--delivered", onMarkDelivered);
      pushAction("fail", "Khách không nhận", "action-btn--fail", onMarkFailed);
    }
  } else {
    if (status === "delivered") {
      pushAction("confirm", "Đã nhận được hàng", "action-btn--confirm", onConfirmReceived);
    }
    if (status === "completed" && onReview !== noop) {
      pushAction("review", "Đánh giá sản phẩm", "action-btn--review", onReview);
    }
    const reorderableStatuses = ["completed", "cancelled", "expired"];
    if (reorderableStatuses.includes(status) && onReorder !== noop) {
      pushAction("reorder", "Đặt lại đơn này", "action-btn--reorder", onReorder);
    }
    const cancellableStatuses = ["pending", "pending_payment"];
    if (!paidOnline && cancellableStatuses.includes(status) && onCancel !== noop) {
      pushAction("cancel", "Hủy đơn", "action-btn--cancel", onCancel);
    }
  }

  if (!actions.length) return null;

  return <div className="order-actions">{actions}</div>;
};

export default OrderActions;
