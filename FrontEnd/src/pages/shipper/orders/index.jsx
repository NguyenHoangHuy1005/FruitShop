import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import { fetchShipperOrders, shipperAcceptOrder, shipperDeliveredOrder, shipperCancelOrder } from "../../../component/redux/apiRequest";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";
import OrderActions from "../../../component/orders/OrderActions";
import "../theme.scss";
import "./style.scss";

const tabs = {
  processing: { label: "Chờ nhận", statuses: ["processing"] },
  shipping: { label: "Đang giao", statuses: ["shipping"] },
  history: { label: "Lịch sử", statuses: ["delivered", "completed", "cancelled"] },
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("processing");
  const [actionState, setActionState] = useState({ id: null, key: "" });
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterText, setFilterText] = useState("");

  const load = async (tabKey = activeTab) => {
    setLoading(true);
    setError("");
    try {
      const statuses = tabs[tabKey]?.statuses || [];
      const res = await fetchShipperOrders(statuses);
      setOrders(res.orders || []);
    } catch (e) {
      setError(e?.message || "Không thể tải đơn hàng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeTab);
  }, [activeTab]);

  const resetAction = () => setActionState({ id: null, key: "" });

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

  const handleCancel = async (id) => {
    try {
      setActionState({ id, key: "fail" });
      await shipperCancelOrder(id);
      await load();
    } catch (e) {
      alert(e?.message || "Hủy đơn thất bại.");
    } finally {
      resetAction();
    }
  };

  const visibleOrders = useMemo(() => {
    const statuses = tabs[activeTab]?.statuses;
    if (!statuses) return orders;
    const byStatus = orders.filter((o) => statuses.includes(String(o.status).toLowerCase()));

    // Filter by district selection (HCM) or free-text address filter
    if (!filterDistrict && !filterText) return byStatus;

    const districtNorm = (filterDistrict || "").trim().toLowerCase();
    const textNorm = (filterText || "").trim().toLowerCase();

    return byStatus.filter((o) => {
      const addr = (o.customer?.address || "" ).toString().toLowerCase();
      let ok = true;
      if (districtNorm) {
        ok = addr.includes(districtNorm);
      }
      if (ok && textNorm) {
        ok = addr.includes(textNorm);
      }
      return ok;
    });
  }, [orders, activeTab, filterDistrict, filterText]);

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

      {/* Area filter for HCM - select common districts + free text */}
      <div className="shipper-filters" style={{ margin: '12px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontWeight: 600 }}>Lọc khu vực HCM:</label>
        <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="quận 1">Quận 1</option>
          <option value="quận 3">Quận 3</option>
          <option value="quận 4">Quận 4</option>
          <option value="quận 5">Quận 5</option>
          <option value="quận 7">Quận 7</option>
          <option value="quận 10">Quận 10</option>
          <option value="quận tân bình">Quận Tân Bình</option>
          <option value="quận bình thạnh">Quận Bình Thạnh</option>
          <option value="thủ đức">Thủ Đức</option>
          <option value="quận gò vấp">Quận Gò Vấp</option>
          <option value="quận phú nhuận">Quận Phú Nhuận</option>
          <option value="quận tân phú">Quận Tân Phú</option>
          <option value="quận bình tân">Quận Bình Tân</option>
          <option value="huyện nhà bè">Huyện Nhà Bè</option>
          <option value="huyện hóc môn">Huyện Hóc Môn</option>
          <option value="huyện bình chánh">Huyện Bình Chánh</option>
        </select>

        <label style={{ fontWeight: 600 }}>Tìm theo địa chỉ:</label>
        <input
          type="text"
          placeholder="nhập phường/quận hoặc địa chỉ..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ padding: '6px 8px' }}
        />

        <button type="button" onClick={() => { setFilterDistrict(''); setFilterText(''); }} style={{ marginLeft: 8 }}>Xóa lọc</button>
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
              <th>Mã</th>
              <th>Khách hàng</th>
              <th>Thanh toán</th>
              <th>Trạng thái</th>
              <th>Tổng</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((o) => {
              const orderId = o._id || o.id;
              const actionKey = actionState.id === orderId ? actionState.key : "";
              const paymentMethod = o.paymentMethod || o.paymentType || 'COD';
              const paymentLabel = paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : `Thanh toán trực tuyến (${paymentMethod})`;
              const paymentClass = paymentMethod === 'COD' ? 'payment-cod' : 'payment-online';
              
              return (
                <tr key={orderId}>
                  <td>#{String(orderId).slice(-8).toUpperCase()}</td>
                  <td>{o.customer?.name}</td>
                  <td>
                    <span className={`payment-badge ${paymentClass}`}>
                      {paymentMethod === 'COD' ? '💵 COD' : `💳 ${paymentMethod}`}
                    </span>
                  </td>
                  <td><OrderStatusTag status={o.status} /></td>
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
    </div>
  );
};

export default Orders;
