import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import { fetchShipperOrders, shipperAcceptOrder, shipperDeliveredOrder, shipperCancelOrder } from "../../../component/redux/apiRequest";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";
import OrderActions from "../../../component/orders/OrderActions";
import "../theme.scss";
import "./style.scss";

const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({ id: null, key: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchShipperOrders(["processing", "shipping", "delivered", "completed", "cancelled"]);
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
  };

  useEffect(() => {
    load();
  }, [id]);

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

  const handleCancel = async () => {
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

  const items = useMemo(() => Array.isArray(order?.items) ? order.items : [], [order]);

  if (loading) return <p>Đang tải đơn...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!order) return <p>Không có dữ liệu.</p>;

  return (
    <div className="shipper-page shipper-detail">
      <div className="shipper-detail__back">
        <Link to={ROUTERS.SHIPPER.ORDERS}>➜ Quay lại</Link>
      </div>
      <div className="shipper-detail__meta">
        <div>
          <p className="shipper-detail__code">Đơn #{String(order._id).slice(-8).toUpperCase()}</p>
          <p className="shipper-detail__time">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <OrderStatusTag status={order.status} />
      </div>

      <div className="shipper-detail__meta">
        <p><span>Khách hàng</span><strong>{order.customer?.name}</strong></p>
        <p><span>Điện thoại</span><strong>{order.customer?.phone}</strong></p>
        <p className="shipper-detail__meta-address"><span>Địa chỉ</span><strong>{order.customer?.address}</strong></p>
        <p><span>Tổng</span><strong>{formatter(order.amount?.total || 0)}</strong></p>
      </div>

      <h3>Sản phẩm</h3>
      <ul className="shipper-detail__items">
        {items.map((it, idx) => (
          <li key={idx}>
            {it.name} - {it.quantity} x {formatter(it.price)}
          </li>
        ))}
      </ul>

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
    </div>
  );
};

export default OrderDetail;
