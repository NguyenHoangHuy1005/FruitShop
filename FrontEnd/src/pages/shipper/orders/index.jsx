import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import {
  fetchShipperOrders,
  shipperAcceptOrder,
  shipperDeliveredOrder,
  shipperCancelOrder,
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

const tabs = {
  processing: { label: "Chờ nhận", statuses: ["processing"] },
  shipping: { label: "Đang giao", statuses: ["shipping"] },
  history: { label: "Lịch sử", statuses: ["delivered", "completed", "cancelled"] },
};

const paymentOptions = [
  { value: "all", label: "Tất cả" },
  { value: "COD", label: "COD" },
  { value: "online", label: "Thanh toán online" },
];

const extractAddressForMap = (address = "") => {
  if (!address) return "";
  let result = address.trim();

  result = result.replace(/\b(SDT|Phone|Tel|Hotline)\s*[:：]?\s*\+?\d[\d\s-]+/gi, "").trim();
  result = result.replace(/[-|]\s*\+?\d[\d\s-]+$/g, "").trim();

  const parts = result
    .split(/[\n|]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    result = parts[parts.length - 1];
  } else if (result.includes(" - ")) {
    const dashParts = result
      .split(" - ")
      .map((part) => part.trim())
      .filter(Boolean);
    result =
      [...dashParts]
        .reverse()
        .find((part) => /(\d+|duong|phuong|quan|street|road)/i.test(part)) ||
      dashParts[dashParts.length - 1] ||
      result;
  }

  return result;
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("processing");
  const [actionState, setActionState] = useState({ id: null, key: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [cancelDialog, setCancelDialog] = useState({ open: false, orderId: null });
  const [selectedReason, setSelectedReason] = useState(DEFAULT_SHIPPER_CANCEL_REASON_VALUE);
  const [customReason, setCustomReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const normalizedArea = areaFilter.trim().toLowerCase();

  const load = useCallback(
    async (tabKey = activeTab, overrides = {}) => {
      setLoading(true);
      setError("");
      try {
        const statuses = tabs[tabKey]?.statuses || [];
        const res = await fetchShipperOrders(statuses, {
          fromDate: overrides.fromDate ?? fromDate,
          toDate: overrides.toDate ?? toDate,
        });
        setOrders(res.orders || []);
      } catch (e) {
        setError(e?.message || "Không thể tải danh sách đơn hàng.");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, fromDate, toDate]
  );

  useEffect(() => {
    load(activeTab);
  }, [activeTab, load]);

  useEffect(() => {
    const interval = setInterval(() => {
      load(activeTab);
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, load]);

  useEffect(() => {
    const unsub = subscribeOrderUpdates(() => {
      load();
    });
    return unsub;
  }, [load]);

  const resetAction = () => setActionState({ id: null, key: "" });

  const openCancelDialog = (id) => {
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

  const handleAccept = async (id) => {
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
    openCancelDialog(id);
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

  const handleRefresh = () => load(activeTab);

  const handleClearFilters = () => {
    setSearchTerm("");
    setPaymentFilter("all");
    setAreaFilter("");
    setFromDate("");
    setToDate("");
    load(activeTab, { fromDate: "", toDate: "" });
  };

  const handleCopyAddress = (address) => {
    if (!address || !navigator?.clipboard) return;
    navigator.clipboard.writeText(address).catch(() => {});
  };

  const handleOpenMap = (address) => {
    const cleanedAddress = extractAddressForMap(address);
    if (!cleanedAddress) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanedAddress)}`;
    window.open(url, "_blank", "noopener");
  };

  const visibleOrders = useMemo(() => {
    const statuses = tabs[activeTab]?.statuses;
    if (!statuses) return orders;

    return orders
      .filter((o) => statuses.includes(String(o.status).toLowerCase()))
      .filter((o) => {
        if (paymentFilter === "all") return true;
        const method = (o.paymentMethod || o.paymentType || "COD").toUpperCase();
        if (paymentFilter === "COD") return method === "COD";
        return method !== "COD";
      })
      .filter((o) => {
        if (!normalizedArea) return true;
        const pickup = o.pickupAddress?.toLowerCase?.() || "";
        const delivery = o.customer?.address?.toLowerCase?.() || "";
        return pickup.includes(normalizedArea) || delivery.includes(normalizedArea);
      })
      .filter((o) => {
        if (!normalizedSearch) return true;
        const customerName = o.customer?.name?.toLowerCase?.() || "";
        const orderId = String(o._id || o.id || "").toLowerCase();
        return customerName.includes(normalizedSearch) || orderId.includes(normalizedSearch);
      });
  }, [orders, activeTab, paymentFilter, normalizedArea, normalizedSearch]);

  return (
    <div className="shipper-page">
      <h1>Đơn hàng</h1>

      <div className="shipper-tabs">
        {Object.entries(tabs).map(([key, tab]) => (
          <button
            key={key}
            type="button"
            className={`shipper-tab${activeTab === key ? " shipper-tab--active" : ""}`}
            onClick={() => setActiveTab(key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="shipper-filters">
        <div className="shipper-filters__group">
          <label htmlFor="shipper-search">Tìm kiếm</label>
          <input
            id="shipper-search"
            type="text"
            placeholder="Tên khách, mã đơn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="shipper-filters__group">
          <label htmlFor="shipper-payment">Thanh toán</label>
          <select
            id="shipper-payment"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            {paymentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="shipper-filters__group">
          <label htmlFor="shipper-area">Khu vực</label>
          <input
            id="shipper-area"
            type="text"
            placeholder="Quận, phường, tỉnh..."
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          />
        </div>
        <div className="shipper-filters__group">
          <label htmlFor="shipper-from">Từ ngày</label>
          <input
            type="date"
            id="shipper-from"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="shipper-filters__group">
          <label htmlFor="shipper-to">Đến ngày</label>
          <input
            type="date"
            id="shipper-to"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="shipper-refresh"
          onClick={handleRefresh}
          disabled={loading}
        >
          Làm mới
        </button>
        <button
          type="button"
          className="shipper-refresh shipper-refresh--secondary"
          onClick={handleClearFilters}
          disabled={loading}
        >
          Xóa lọc
        </button>
      </div>

      {loading && <p>Đang tải đơn hàng...</p>}
      {!loading && error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && visibleOrders.length === 0 && (
        <div className="shipper-empty">
          <p>Không có đơn nào.</p>
        </div>
      )}

      {!loading && !error && visibleOrders.length > 0 && (
        <table className="shipper-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Thanh toán</th>
              <th>Trạng thái</th>
              <th>Điểm lấy hàng</th>
              <th>Tổng</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((o) => {
              const orderId = o._id || o.id;
              const actionKey = actionState.id === orderId ? actionState.key : "";
              const paymentMethod = (o.paymentMethod || o.paymentType || "COD").toUpperCase();
              const paymentClass = paymentMethod === "COD" ? "payment-cod" : "payment-online";

              return (
                <tr key={orderId}>
                  <td>#{String(orderId).slice(-8).toUpperCase()}</td>
                  <td>{o.customer?.name}</td>
                  <td>
                    <span className={`payment-badge ${paymentClass}`}>
                      {paymentMethod === "COD" ? " COD" : `Đã ${paymentMethod}`}
                    </span>
                  </td>
                  <td>
                    <OrderStatusTag status={o.status} />
                  </td>
                  <td>
                    {o.pickupAddress ? (
                      <div className="shipper-address">
                        <span>{o.pickupAddress}</span>
                        <div className="shipper-address__actions">
                          <button type="button" onClick={() => handleCopyAddress(o.pickupAddress)}>
                            Sao chép
                          </button>
                          <button type="button" onClick={() => handleOpenMap(o.pickupAddress)}>
                            Map
                          </button>
                        </div>
                      </div>
                    ) : (
                      <em>Chưa có</em>
                    )}
                  </td>
                  <td>{formatter(o.amount?.total || 0)}</td>
                  <td className="shipper-orders__actions">
                   <Link to={`${ROUTERS.SHIPPER.ORDERS}/${orderId}`}>Chi tiết</Link>
                    <OrderActions
                      order={o}
                      role="shipper"
                      onAccept={handleAccept}
                      onMarkDelivered={handleDelivered}
                      onMarkFailed={handleCancel}
                      loadingAction={actionKey}
                      compact
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {cancelDialog.open && (
        <div className="shipper-cancel-dialog">
          <div className="shipper-cancel-dialog__panel">
            <h3>Chọn lý do hủy đơn</h3>
            <div className="shipper-cancel-dialog__options">
              {SHIPPER_CANCEL_REASONS.map((reason) => (
                <label key={reason.value} className="shipper-cancel-dialog__option">
                  <input
                    type="radio"
                    name="cancelReason"
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

export default Orders;
