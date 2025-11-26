import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import {
  fetchShipperOrders,
  shipperDeliveredOrder,
  shipperCancelOrder,
  uploadImageFile,
} from "../../../component/redux/apiRequest";
import {
  SHIPPER_CANCEL_REASONS,
  DEFAULT_SHIPPER_CANCEL_REASON_TEXT,
  DEFAULT_SHIPPER_CANCEL_REASON_VALUE,
  resolveCancelReasonText,
} from "../../../constants/cancelReasons";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";
import OrderActions from "../../../component/orders/OrderActions";
import { subscribeOrderUpdates } from "../../../utils/orderRealtime";
import "../theme.scss";
import "./style.scss";

const Delivering = () => {
  const dispatch = useDispatch();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({ id: null, key: "" });
  const [cancelDialog, setCancelDialog] = useState({ open: false, orderId: null });
  const [selectedReason, setSelectedReason] = useState(DEFAULT_SHIPPER_CANCEL_REASON_VALUE);
  const [customReason, setCustomReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [deliverDialog, setDeliverDialog] = useState({ open: false, order: null });
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");
  const [proofError, setProofError] = useState("");
  const [proofUploading, setProofUploading] = useState(false);

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

  useEffect(() => () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
  }, [proofPreview]);

  const clearProofSelection = () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(null);
    setProofPreview("");
    setProofError("");
  };

  const openDeliverDialog = (order) => {
    clearProofSelection();
    setDeliverDialog({ open: true, order });
  };

  const closeDeliverDialog = () => {
    clearProofSelection();
    setDeliverDialog({ open: false, order: null });
  };

  const handleDelivered = async (_id, order) => {
    openDeliverDialog(order);
  };

  const handleCancel = (id) => {
    setCancelDialog({ open: true, orderId: id });
    setSelectedReason(DEFAULT_SHIPPER_CANCEL_REASON_VALUE);
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
      resolveCancelReasonText(selectedReason, customReason, SHIPPER_CANCEL_REASONS) ||
      DEFAULT_SHIPPER_CANCEL_REASON_TEXT;

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

  const handleProofChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      clearProofSelection();
      return;
    }
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setProofError("");
  };

  const handleConfirmDelivered = async () => {
    const orderId = deliverDialog.order?._id;
    if (!orderId) return;
    try {
      setActionState({ id: orderId, key: "delivered" });
      let proofUrls = [];
      if (proofFile) {
        setProofUploading(true);
        try {
          const uploadedUrl = await uploadImageFile(proofFile, { dispatch });
          proofUrls = [uploadedUrl];
        } catch (err) {
          setProofError(err?.message || "Tải ảnh thất bại, vui lòng thử lại.");
          return;
        } finally {
          setProofUploading(false);
        }
      }
      await shipperDeliveredOrder(orderId, proofUrls);
      await load();
      clearProofSelection();
      closeDeliverDialog();
    } catch (e) {
      alert(e?.message || "Cập nhật giao hàng thất bại.");
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
              {SHIPPER_CANCEL_REASONS.map((reason) => (
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

      {deliverDialog.open && (
        <div className="shipper-proof-dialog">
          <div className="shipper-proof-dialog__panel">
            <h3>Ảnh bàn giao</h3>
            <p>Đơn #{String(deliverDialog.order?._id || "").slice(-8).toUpperCase()}</p>
            {proofPreview ? (
              <div className="shipper-proof-dialog__preview">
                <img src={proofPreview} alt="Ảnh bàn giao" />
                <button type="button" onClick={() => handleProofChange({ target: { files: [] } })}>
                  Chọn ảnh khác
                </button>
              </div>
            ) : (
              <label className="shipper-proof-dialog__input">
                <input type="file" accept="image/*" onChange={handleProofChange} />
                <span>Chọn ảnh (tùy chọn)</span>
              </label>
            )}
            {proofUploading && <p className="shipper-proof-dialog__hint">Đang tải ảnh...</p>}
            {proofError && <p className="shipper-proof-dialog__error">{proofError}</p>}
            <div className="shipper-proof-dialog__actions">
              <button type="button" onClick={closeDeliverDialog}>
                Đóng
              </button>
              <button
                type="button"
                className="confirm"
                disabled={proofUploading}
                onClick={handleConfirmDelivered}
              >
                Xác nhận giao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Delivering;
