import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import {
  fetchShipperOrders,
  shipperDeliveredOrder,
  shipperCancelOrder,
} from "../../../component/redux/apiRequest";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";
import OrderActions from "../../../component/orders/OrderActions";
import { subscribeOrderUpdates } from "../../../utils/orderRealtime";
import "../theme.scss";
import "./style.scss";

const CANCEL_REASONS = [
  { value: "customer_refused", label: "Khách không nhận hàng" },
  { value: "cannot_contact", label: "Không liên hệ được khách" },
  { value: "address_wrong", label: "Sai địa chỉ / không tìm thấy" },
  { value: "delay_request", label: "Khách yêu cầu giao lại lúc khác" },
  { value: "other", label: "Lý do khác" },
];
const DEFAULT_CANCEL_REASON = CANCEL_REASONS[0].label;

const Delivering = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({ id: null, key: "" });
  const [cancelDialog, setCancelDialog] = useState({ open: false, orderId: null });
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0].value);
  const [customReason, setCustomReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchShipperOrders(["shipping"]);
      setOrders(res.orders || []);
    } catch (e) {
      setError(e?.message || "Không thể tải đơn đang giao.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribeOrderUpdates(() => {
      load();
    });
    return unsub;
  }, [load]);

  const resetAction = () => setActionState({ id: null, key: "" });

  const handleDelivered = async (id) => {
    try {
      setActionState({ id, key: "delivered" });
      await shipperDeliveredOrder(id);
      await load();
    } catch (e) {
      alert(e?.message || "Cập nhật giao hàng thất bại.");
    } finally {
      resetAction();
    }
  };

  const handleCancel = (id) => {
    setCancelDialog({ open: true, orderId: id });
    setSelectedReason(CANCEL_REASONS[0].value);
    setCustomReason("");
    setCancelError("");
  };

  const closeCancelDialog = () => {
    setCancelDialog({ open: false, orderId: null });
    setCustomReason("");
    setCancelError("");
  };

  const handleConfirmCancel = async () => {
    const reasonText =
      selectedReason === "other"
        ? customReason.trim()
        : CANCEL_REASONS.find((r) => r.value === selectedReason)?.label || DEFAULT_CANCEL_REASON;

    if (!reasonText) {
      setCancelError("Vui lòng nhập lý do hợp lệ.");
      return;
    }

    try {
      setActionState({ id: cancelDialog.orderId, key: "fail" });
      await shipperCancelOrder(cancelDialog.orderId, reasonText);
      await load();
      closeCancelDialog();
    } catch (e) {
      alert(e?.message || "Hủy đơn thất bại.");
    } finally {
      resetAction();
    }
  };

  if (loading) return <p>Đang tải...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  if (!orders.length) {
    return (
      <div className="shipper-page shipper-delivering">
        <h1>Đơn đang giao</h1>
        <p>Không có đơn nào đang giao.</p>
        <Link className="shipper-backlink" to={ROUTERS.SHIPPER.ORDERS}>
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="shipper-page shipper-delivering">
      <h1>Đơn đang giao</h1>
      <table className="shipper-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Khách hàng</th>
            <th>Địa chỉ</th>
            <th>Tổng</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const key = actionState.id === o._id ? actionState.key : "";
            return (
              <tr key={o._id}>
                <td>#{String(o._id).slice(-8).toUpperCase()}</td>
                <td>{o.customer?.name}</td>
                <td>{o.customer?.address}</td>
                <td>{formatter(o.amount?.total || 0)}</td>
                <td>
                  <OrderStatusTag status={o.status} />
                </td>
                <td className="shipper-orders__actions">
                  <OrderActions
                    order={o}
                    role="shipper"
                    onMarkDelivered={handleDelivered}
                    onMarkFailed={handleCancel}
                    loadingAction={key}
                    compact
                  />
                </td>
              </tr>
            );
          })}
       </tbody>
     </table>

      {cancelDialog.open && (
        <div className="shipper-cancel-dialog">
          <div className="shipper-cancel-dialog__panel">
            <h3>Chọn lý do hủy đơn</h3>
            <div className="shipper-cancel-dialog__options">
              {CANCEL_REASONS.map((reason) => (
                <label key={reason.value} className="shipper-cancel-dialog__option">
                  <input
                    type="radio"
                    name="deliverCancelReason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={() => {
                      setSelectedReason(reason.value);
                      setCancelError("");
                    }}
                  />
                  <span>{reason.label}</span>
                </label>
              ))}
              {selectedReason === "other" && (
                <textarea
                  rows={3}
                  placeholder="Nhập lý do khác..."
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value);
                    setCancelError("");
                  }}
                />
              )}
            </div>
            {cancelError && <p className="shipper-cancel-dialog__error">{cancelError}</p>}
            <div className="shipper-cancel-dialog__actions">
              <button type="button" onClick={closeCancelDialog}>
                Đóng
              </button>
              <button type="button" className="confirm" onClick={handleConfirmCancel}>
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Delivering;
