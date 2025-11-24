import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchShipperOrders } from "../../../component/redux/apiRequest";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";
import { subscribeOrderUpdates } from "../../../utils/orderRealtime";
import "../theme.scss";
import "./style.scss";

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchShipperOrders();
      setOrders(res.orders || []);
    } catch (e) {
      setError(e?.message || "Không thể tải đơn hàng.");
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

  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    const summary = {
      processing: 0,
      shipping: 0,
      deliveredToday: 0,
      cancelled: 0,
      codOutstanding: 0,
      deliveredTodayValue: 0,
    };

    orders.forEach((o) => {
      const status = String(o.status || "").toLowerCase();
      const total = Number(o.amount?.total || 0);
      const paymentMethod = (o.paymentMethod || o.paymentType || "COD").toUpperCase();

      if (status === "processing") summary.processing += 1;
      if (status === "shipping") summary.shipping += 1;
      if (status === "cancelled") summary.cancelled += 1;

      if ((status === "shipping" || status === "processing") && paymentMethod === "COD") {
        summary.codOutstanding += total;
      }

      if (status === "delivered" || status === "completed") {
        const deliveredAt = o.deliveredAt || o.updatedAt || o.createdAt;
        if (deliveredAt && new Date(deliveredAt).toDateString() === today) {
          summary.deliveredToday += 1;
          summary.deliveredTodayValue += total;
        }
      }
    });

    return summary;
  }, [orders]);

  const shippingOrders = useMemo(
    () => orders.filter((o) => String(o.status).toLowerCase() === "shipping"),
    [orders]
  );

  if (loading) return <p>Dang tai du lieu...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="shipper-page">
      <h1 className="shipper-heading">Shipper Dashboard</h1>
      <p className="shipper-dashboard__hint">Theo dõi tiến độ giao hàng theo thời gian thực.</p>
      <div className="shipper-stats">
        <div className="shipper-card">
          <div className="shipper-card__label">Chờ nhận</div>
          <div className="shipper-card__value">{metrics.processing || 0}</div>
        </div>
        <div className="shipper-card">
          <div className="shipper-card__label">Đang giao</div>
          <div className="shipper-card__value">{metrics.shipping || 0}</div>
        </div>
        <div className="shipper-card">
          <div className="shipper-card__label">Đã giao hôm nay</div>
          <div className="shipper-card__value">{metrics.deliveredToday || 0}</div>
        </div>
        <div className="shipper-card">
          <div className="shipper-card__label">Đơn bị hủy</div>
          <div className="shipper-card__value">{metrics.cancelled || 0}</div>
        </div>
        <div className="shipper-card">
          <div className="shipper-card__label">COD đang giao</div>
          <div className="shipper-card__value">{formatter(metrics.codOutstanding || 0)}</div>
        </div>
        <div className="shipper-card">
          <div className="shipper-card__label">Giá trị giao hôm nay</div>
          <div className="shipper-card__value">
            {formatter(metrics.deliveredTodayValue || 0)}
          </div>
        </div>
      </div>
      <div className="shipper-section">
        <div className="shipper-section__header">
          <h2>Đơn cần xử lý</h2>
          <Link to={ROUTERS.SHIPPER.ORDERS}>Xem tất cả</Link>
        </div>
        {orders.length === 0 && <p>Không có đơn hàng.</p>}
        {orders.length > 0 && (
          <table className="shipper-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Khách hàng</th>
                <th>Trạng thái</th>
                <th>Tổng</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o) => (
                <tr key={o._id}>
                  <td>#{String(o._id).slice(-8).toUpperCase()}</td>
                  <td>{o.customer?.name}</td>
                  <td>
                    <OrderStatusTag status={o.status} />
                  </td>
                  <td>{formatter(o.amount?.total || 0)}</td>
                  <td>
                    <Link className="shipper-detail-link" to={`${ROUTERS.SHIPPER.ORDERS}/${o._id}`}>
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {shippingOrders.length > 0 && (
        <div className="shipper-section">
          <div className="shipper-section__header">
            <h2>Đơn đang giao</h2>
            <Link to={ROUTERS.SHIPPER.DELIVERING}>Xem</Link>
          </div>
          <ul className="shipper-list">
            {shippingOrders.map((o) => (
              <li key={o._id}>
                #{String(o._id).slice(-8).toUpperCase()} - {o.customer?.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
