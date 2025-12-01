import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import {
  fetchShipperOrders,
  shipperAcceptOrder,
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

const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({ id: null, key: "" });
  const [cancelDialog, setCancelDialog] = useState(false);
  const [selectedReason, setSelectedReason] = useState(DEFAULT_SHIPPER_CANCEL_REASON_VALUE);
  const [customReason, setCustomReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [deliverDialog, setDeliverDialog] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");
  const [proofError, setProofError] = useState("");
  const [proofUploading, setProofUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (proofPreview) URL.revokeObjectURL(proofPreview);
    };
  }, [proofPreview]);


  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchShipperOrders([
        "processing",
        "shipping",
        "delivered",
        "completed",
        "cancelled",
      ]);
      const found = (res.orders || []).find((o) => String(o._id) === String(id));
      if (!found) {
        setError("Không tìm thấy đơn hàng.");
      }
      setOrder(found || null);
    } catch (e) {
      setError(e?.message || "Không thể tải đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [id]);

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
  const actionKey = actionState.id === id ? actionState.key : "";

  const handleAccept = async () => {
    try {
      setActionState({ id, key: "accept" });
      await shipperAcceptOrder(id);
      await load();
    } catch (e) {
      alert(e?.message || "Nhận đơn thất bại.");
    } finally {
      resetAction();
    }
  };

  const handleDelivered = async () => {
    setDeliverDialog(true);
    setProofError("");
  };

  const handleCancel = () => {
    setCancelDialog(true);
    setSelectedReason(DEFAULT_SHIPPER_CANCEL_REASON_VALUE);
    setCustomReason("");
    setCancelError("");
  };

  const clearProofSelection = () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(null);
    setProofPreview("");
    setProofError("");
  };

  const handleProofChange = (e) => {
    const file = e.target.files?.[0] || null;
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
    try {
      setActionState({ id, key: "delivered" });
      let proofUrls = [];
      if (proofFile) {
        setProofUploading(true);
        try {
          const uploadedUrl = await uploadImageFile(proofFile, {});
          proofUrls = [uploadedUrl];
        } catch (err) {
          setProofError(err?.message || "Tải ảnh thất bại, vui lòng thử lại.");
          return;
        } finally {
          setProofUploading(false);
        }
      }
      await shipperDeliveredOrder(id, proofUrls);
      await load();
      clearProofSelection();
      setDeliverDialog(false);
    } catch (e) {
      alert(e?.message || "Cập nhật giao hàng thất bại.");
    } finally {
      resetAction();
    }
  };

  const closeCancelDialog = () => {
    setCancelDialog(false);
    setCancelError("");
    setCustomReason("");
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
      setActionState({ id, key: "fail" });
      await shipperCancelOrder(id, reasonText);
      await load();
      closeCancelDialog();
    } catch (e) {
      alert(e?.message || "Hủy đơn thất bại.");
    } finally {
      resetAction();
    }
  };

  const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order]);
  const proofList = useMemo(
    () => (Array.isArray(order?.deliveryProof) ? order.deliveryProof : []),
    [order]
  );

  if (loading) return <p>Đang tải đơn...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!order) return <p>Không có dữ liệu.</p>;

  return (
    <div className="shipper-detail">
      <div className="shipper-detail__back">
        <Link to={ROUTERS.SHIPPER.ORDERS}>Quay lại danh sách</Link>
      </div>

      <div className="shipper-detail__header">
        <div>
          <p className="shipper-detail__code">Đơn #{String(order._id).slice(-8).toUpperCase()}</p>
          <p className="shipper-detail__time">
            {new Date(order.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <OrderStatusTag status={order.status} />
      </div>

      <div className="shipper-detail__addresses">
        <div className="shipper-detail__info-section">
          <h4>Địa điểm lấy hàng</h4>
          <div className="shipper-detail__meta">
            <p className="shipper-detail__meta-address">
              <span>Kho</span>
              <strong>{order.pickupAddress || "Chưa có địa chỉ"}</strong>
            </p>
          </div>
        </div>

        <div className="shipper-detail__info-section">
          <h4>Địa điểm giao hàng</h4>
          <div className="shipper-detail__meta">
            <p className="shipper-detail__meta-address">
              <span>Giao đến</span>
              <strong>{order.customer?.address}</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="shipper-detail__info-section">
        <h4>Thông tin khách hàng</h4>
        <div className="shipper-detail__meta">
          <p>
            <span>Họ tên</span>
            <strong>{order.customer?.name}</strong>
          </p>
          <p>
            <span>Điện thoại</span>
            <strong>{order.customer?.phone}</strong>
          </p>
          <p>
            <span>Email</span>
            <strong>{order.customer?.email || "Không có"}</strong>
          </p>
          <p>
            <span>Hình thức thanh toán</span>
            <strong>{order.paymentMethod || order.paymentType || "COD"}</strong>
          </p>
          <p>
            <span>Tổng thanh toán</span>
            <strong className="shipper-detail__total">
              {formatter(order.amount?.total || 0)}
            </strong>
          </p>
          <p>
            <span>Thu nhập</span>
            <strong className="shipper-detail__income">
              {formatter(order.shipperIncome || 0)}
            </strong>
          </p>
          {order.customer?.note && (
            <p className="shipper-detail__meta-address">
              <span>Ghi chú</span>
              <strong>{order.customer.note}</strong>
            </p>
          )}
        </div>
      </div>

      {proofList.length > 0 && (
        <div className="shipper-proof-existing">
          <h4>Ảnh đã gửi</h4>
          <div className="shipper-proof-grid">
            {proofList.map((proof) => (
              <a
                key={proof.url}
                href={proof.url}
                target="_blank"
                rel="noreferrer"
                className="shipper-proof-card"
              >
                <img src={proof.url} alt="Delivery proof" />
                <span>
                  {(proof.uploadedByName || "Shipper") +
                    " • " +
                    (proof.uploadedAt ? new Date(proof.uploadedAt).toLocaleString("vi-VN") : "—")}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="shipper-detail__info-section">
        <h4>Sản phẩm</h4>
        <ul className="shipper-detail__items">
          {items.map((it, idx) => (
            <li key={idx}>
              <span className="shipper-detail__item-name">{it.name}</span>
              <span className="shipper-detail__item-qty">
                {it.quantity} x {formatter(it.price)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="shipper-detail__actions">
        <OrderActions
          order={order}
          role="shipper"
          onAccept={handleAccept}
          onMarkDelivered={handleDelivered}
          onMarkFailed={handleCancel}
          loadingAction={actionKey}
        />
      </div>

      {deliverDialog && (
        <div className="shipper-proof-dialog">
          <div className="shipper-proof-dialog__panel">
            <h4>Xác nhận giao hàng</h4>
            {proofPreview ? (
              <div className="shipper-proof-dialog__preview">
                <img src={proofPreview} alt="Ảnh bàn giao" />
                <button type="button" className="shipper-proof-dialog__remove" onClick={clearProofSelection}>
                  Xóa ảnh
                </button>
              </div>
            ) : (
              <label className="shipper-proof-dialog__input">
                <span>Tải ảnh bàn giao (tùy chọn)</span>
                <input type="file" accept="image/*" onChange={handleProofChange} />
              </label>
            )}
            {proofUploading && <p className="shipper-proof-dialog__hint">Đang tải ảnh...</p>}
            {proofError && <p className="shipper-proof-dialog__error">{proofError}</p>}
            <div className="shipper-proof-dialog__actions">
              <button type="button" className="btn btn-secondary" onClick={() => { clearProofSelection(); setDeliverDialog(false); }}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmDelivered}
                disabled={proofUploading}
              >
                Xác nhận giao
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelDialog && (
        <div className="shipper-cancel-dialog">
          <div className="shipper-cancel-dialog__panel">
            <h3>Chọn lý do hủy đơn</h3>
            <div className="shipper-cancel-dialog__options">
              {SHIPPER_CANCEL_REASONS.map((reason) => (
                <label key={reason.value} className="shipper-cancel-dialog__option">
                  <input
                    type="radio"
                    name="detailCancelReason"
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

export default OrderDetail;
