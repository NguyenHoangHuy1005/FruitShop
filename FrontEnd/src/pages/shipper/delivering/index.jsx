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

const DEFAULT_CANCEL_REASON = "Khách không nhận hàng";

const Delivering = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({ id: null, key: "" });

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

  const handleCancel = async (id) => {
    try {
      setActionState({ id, key: "fail" });
      const value = window.prompt("Nhập lý do hủy đơn", DEFAULT_CANCEL_REASON);
      if (value === null) {
        resetAction();
        return;
      }
      const reason = value.trim();
      if (!reason) {
        alert("Vui lòng nhập lý do hợp lệ.");
        resetAction();
        return;
      }
      await shipperCancelOrder(id, reason);
      await load();
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
        <Link to={ROUTERS.SHIPPER.ORDERS}>Quay lại danh sách</Link>
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
    </div>
  );
};

export default Delivering;
