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
    return orders.filter((o) => statuses.includes(String(o.status).toLowerCase()));
  }, [orders, activeTab]);

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
              <th>Trạng thái</th>
              <th>Tổng</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((o) => {
              const orderId = o._id || o.id;
              const actionKey = actionState.id === orderId ? actionState.key : "";
              return (
                <tr key={orderId}>
                  <td>#{String(orderId).slice(-8).toUpperCase()}</td>
                  <td>{o.customer?.name}</td>
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
