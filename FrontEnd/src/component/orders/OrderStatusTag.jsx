import "./orderStatus.scss";

const STATUS_LABELS = {
  pending: "Chờ thanh toán",
  expired: "Hết hạn",
  processing: "Chờ nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

export const normalizeOrderStatus = (status) => {
  const raw = String(status || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "shipped") return "shipping";
  if (raw === "complete" || raw === "completed") return "completed";
  if (raw === "delivery" || raw === "delivering") return "shipping";
  return STATUS_LABELS[raw] ? raw : "";
};

const OrderStatusTag = ({ status, size = "md" }) => {
  const normalized = normalizeOrderStatus(status);
  if (!normalized) return null;
  const label = STATUS_LABELS[normalized] || normalized;
  const classes = [
    "order-status-tag",
    `order-status-tag--${normalized}`,
    `order-status-tag--${size}`,
  ].join(" ");

  return <span className={classes}>{label}</span>;
};

export { STATUS_LABELS };
export default OrderStatusTag;
