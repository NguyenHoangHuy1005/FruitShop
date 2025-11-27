import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchShipperOrders, fetchShipperIncomeSummary } from "../../../component/redux/apiRequest";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";
import { subscribeOrderUpdates } from "../../../utils/orderRealtime";
import "../theme.scss";
import "./style.scss";

const StatCard = ({ icon, label, value, iconClass }) => (
  <div className="shipper-dashboard__stat-card">
    <div className={`icon ${iconClass}`}>{icon}</div>
    <div className="shipper-dashboard__stat-card__info">
      <div className="shipper-dashboard__stat-card__info__label">{label}</div>
      <div className="shipper-dashboard__stat-card__info__value">{value}</div>
    </div>
  </div>
);

const Icons = {
  Processing: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 108-8" />
    </svg>
  ),
  Shipping: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Delivered: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Cancelled: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Cod: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm4-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Value: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" />
    </svg>
  ),
  Income: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  )
};

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [income, setIncome] = useState({
    todayIncome: 0,
    monthIncome: 0,
    totalIncome: 0,
    totalDelivered: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchShipperOrders();
      setOrders(res.orders || []);
      try {
        const incomeRes = await fetchShipperIncomeSummary();
        const summaryData = incomeRes?.data || incomeRes?.summary || incomeRes || {};
        setIncome({
          todayIncome: summaryData.todayIncome || 0,
          monthIncome: summaryData.monthIncome || 0,
          totalIncome: summaryData.totalIncome || 0,
          totalDelivered: summaryData.totalDelivered || 0,
        });
      } catch (summaryErr) {
        console.error(summaryErr);
      }
    } catch (e) {
      setError(e?.message || "Không thể tải đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, []);;

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

  if (loading) return <p>Đang tải dữ liệu...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="shipper-dashboard">
      <div className="shipper-dashboard__header">
        <h1>Trang chủ người giao hàng</h1>
        <p>Theo dõi tiến độ giao hàng theo thời gian thực.</p>
      </div>

      <div className="shipper-dashboard__stats-grid">
        <StatCard icon={Icons.Processing} label="Chờ nhận" value={metrics.processing} iconClass="icon-processing" />
        <StatCard icon={Icons.Shipping} label="Đang giao" value={metrics.shipping} iconClass="icon-shipping" />
        <StatCard icon={Icons.Delivered} label="Đã giao hôm nay" value={metrics.deliveredToday} iconClass="icon-delivered" />
        <StatCard icon={Icons.Cancelled} label="Đơn bị hủy" value={metrics.cancelled} iconClass="icon-cancelled" />
        <StatCard icon={Icons.Cod} label="COD đang giao" value={formatter(metrics.codOutstanding)} iconClass="icon-cod" />
        <StatCard icon={Icons.Value} label="Giá trị giao hôm nay" value={formatter(metrics.deliveredTodayValue)} iconClass="icon-value" />
      </div>

      <div className="shipper-dashboard__stats-grid">
        <StatCard icon={Icons.Income} label="Thu nhập hôm nay" value={formatter(income.todayIncome)} iconClass="icon-income-today" />
        <StatCard icon={Icons.Income} label="Thu nhập tháng nay" value={formatter(income.monthIncome)} iconClass="icon-income-month" />
        <StatCard icon={Icons.Income} label="Tổng thu nhập" value={formatter(income.totalIncome)} iconClass="icon-income-total" />
        <StatCard icon={Icons.Delivered} label="Tổng đơn đã giao" value={income.totalDelivered} iconClass="icon-delivered-total" />
      </div>

      <div className="shipper-dashboard__income-link">
        <Link to={ROUTERS.SHIPPER.INCOME}>Xem thu nhập chi tiết</Link>
      </div>

      <div className="shipper-dashboard__section">
        <div className="shipper-dashboard__section__header">
          <h2>Đơn cần xử lý</h2>
          <Link to={ROUTERS.SHIPPER.ORDERS}>Xem tất cả</Link>
        </div>
        {orders.length === 0 ? <p>Không có đơn hàng.</p> : (
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
        <div className="shipper-dashboard__section">
          <div className="shipper-dashboard__section__header">
            <h2>Đơn đang giao</h2>
            <Link to={ROUTERS.SHIPPER.DELIVERING}>Xem</Link>
          </div>
          <ul className="shipper-dashboard__list">
            {shippingOrders.map((o) => (
              <li key={o._id}>
                <span className="icon">{Icons.Shipping}</span>
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
