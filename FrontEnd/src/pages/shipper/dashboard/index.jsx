import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchShipperOrders, fetchShipperIncomeSummary } from "../../../component/redux/apiRequest";
import { formatter } from "../../../utils/fomater";
import { ROUTERS } from "../../../utils/router";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";
import { subscribeOrderUpdates } from "../../../utils/orderRealtime";
import "../theme.scss";
import "./style.scss";

const Icon = ({ children, className = "" }) => (
  <div className={`sd-icon ${className}`}>{children}</div>
);

const Bar = ({ label, value, max }) => {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar">
      <div className="bar__label">{label}</div>
      <div className="bar__track">
        <div className="bar__fill" style={{ width: `${width}%` }} />
      </div>
      <div className="bar__value">{formatter(value)}</div>
    </div>
  );
};

const Icons = {
  Flash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7z" />
    </svg>
  ),
  Truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3zM14 9h4l3 3v4h-7zM7 18a2 2 0 11-4 0 2 2 0 014 0zm12 0a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.418-3.134 8-7 8s-7-3.582-7-8V7l7-4z" />
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  ),
  Wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M17 12h4" />
    </svg>
  ),
  List: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
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
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useSelector((state) => state.auth?.login?.currentUser);

  const myId = useMemo(() => {
    if (!user) return "";
    return (
      user?._id ||
      user?.id ||
      user?.userId ||
      user?.user?._id ||
      user?.user?.id ||
      ""
    ).toString();
  }, [user]);

  const normalizeId = useCallback((val) => {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (val._id) return val._id.toString();
    if (val.id) return val.id.toString();
    return val.toString();
  }, []);

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

  const myOrders = useMemo(() => {
    if (!myId) return orders;
    return orders.filter((o) => normalizeId(o.shipperId) === myId);
  }, [orders, myId, normalizeId]);

  const shippingOrders = useMemo(
    () => myOrders.filter((o) => String(o.status).toLowerCase() === "shipping"),
    [myOrders]
  );
  const waitingOrders = useMemo(
    () => orders.filter((o) => String(o.status).toLowerCase() === "processing").slice(0, 5),
    [orders]
  );

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

    myOrders.forEach((o) => {
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
  }, [myOrders]);

  const performance = useMemo(() => {
    const assigned = myOrders.length;
    const done = myOrders.filter((o) => ["delivered", "completed"].includes(String(o.status).toLowerCase())).length;
    const cancelled = myOrders.filter((o) => String(o.status).toLowerCase() === "cancelled").length;
    const successRate = assigned > 0 ? Math.round((done / assigned) * 100) : 0;
    const inCity = myOrders.filter((o) => o.isInCity).length;
    const outCity = myOrders.length - inCity;
    return { assigned, done, cancelled, successRate, inCity, outCity };
  }, [myOrders]);

  if (loading) return <p>Đang tải dữ liệu...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="shipper-dashboard">
      <div className="shipper-dashboard__header">
        <div>
          <p className="eyebrow">Shipper workspace</p>
          <h1>Bảng điều khiển giao hàng</h1>
        </div>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label="Mở menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={`shipper-dashboard__cta ${menuOpen ? "is-open" : ""}`}>
          <Link to={ROUTERS.SHIPPER.DELIVERING} className="btn-primary">
            <span>Tiếp tục giao</span>
            <Icon>{Icons.Flash}</Icon>
          </Link>
          <Link to={ROUTERS.SHIPPER.INCOME} className="btn-secondary">Xem thu nhập</Link>
        </div>
      </div>

      <div className="shipper-dashboard__highlight-grid">
        <div className="highlight-card">
          <Icon className="accent">{Icons.Wallet}</Icon>
          <div className="highlight-card__label">Thu nhập hôm nay</div>
          <div className="highlight-card__value">{formatter(income.todayIncome)}</div>
          <div className="highlight-card__muted">Đã xác nhận giao</div>
        </div>
        <div className="highlight-card">
          <Icon className="warning">{Icons.Truck}</Icon>
          <div className="highlight-card__label">Đơn đang giao</div>
          <div className="highlight-card__value">{metrics.shipping}</div>
          <div className="highlight-card__muted">{formatter(metrics.codOutstanding)} COD chưa thu</div>
        </div>
        <div className="highlight-card">
          <Icon className="success">{Icons.Shield}</Icon>
          <div className="highlight-card__label">Tỉ lệ thành công</div>
          <div className="highlight-card__value">{performance.successRate}%</div>
          <div className="highlight-card__muted">{performance.done}/{performance.assigned} đơn</div>
        </div>
        <div className="highlight-card">
          <Icon className="info">{Icons.List}</Icon>
          <div className="highlight-card__label">Hoàn tất hôm nay</div>
          <div className="highlight-card__value">{metrics.deliveredToday}</div>
          <div className="highlight-card__muted">Giá trị {formatter(metrics.deliveredTodayValue)}</div>
        </div>
      </div>

      <div className="shipper-dashboard__grid">
        <div className="panel">
          <div className="panel__header">
            <h2>Hiệu suất</h2>
            <div className="panel__tags">
              <span className="tag">COD {formatter(metrics.codOutstanding)}</span>
              <span className="tag muted">{performance.cancelled} hủy</span>
            </div>
          </div>
          <div className="panel__metrics">
            <div>
              <span>Thu nhập tháng</span>
              <strong>{formatter(income.monthIncome)}</strong>
            </div>
            <div>
              <span>Tổng thu nhập</span>
              <strong>{formatter(income.totalIncome)}</strong>
            </div>
            <div>
              <span>Tổng đơn đã giao</span>
              <strong>{income.totalDelivered}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <h2>Đơn cần nhận</h2>
            <Link to={ROUTERS.SHIPPER.ORDERS} className="link">Xem tất cả</Link>
          </div>
          {waitingOrders.length === 0 ? (
            <p className="empty">Không có đơn chờ nhận.</p>
          ) : (
            <ul className="task-list">
              {waitingOrders.map((o) => (
                <li key={o._id}>
                  <div>
                    <p className="task-title">#{String(o._id).slice(-8).toUpperCase()} - {o.customer?.name}</p>
                    <p className="task-meta">{formatter(o.amount?.total || 0)} • {o.customer?.phone}</p>
                  </div>
                  <Link className="btn-ghost" to={`${ROUTERS.SHIPPER.ORDERS}/${o._id}`}>Nhận</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <h2>Đang giao</h2>
          <Link to={ROUTERS.SHIPPER.DELIVERING} className="link">Xem</Link>
        </div>
        {shippingOrders.length === 0 ? (
          <p className="empty">Chưa có đơn đang giao.</p>
        ) : (
          <ul className="shipper-dashboard__list">
            {shippingOrders.map((o) => (
              <li key={o._id}>
                <div>
                  <p className="task-title">#{String(o._id).slice(-8).toUpperCase()} - {o.customer?.name}</p>
                  <p className="task-meta">{formatter(o.amount?.total || 0)}</p>
                </div>
                <span className="pill live">Đang giao</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel chart-panel">
        <div className="panel__header">
          <h2>Phân tích nhanh</h2>
        </div>
        <div className="charts-grid">
          <div className="mini-chart">
            <div className="mini-chart__title">Khu vực</div>
            <div className="mini-chart__bars">
              <Bar label="Nội thành" value={performance.inCity} max={performance.assigned || 1} />
              <Bar label="Ngoại thành" value={performance.outCity} max={performance.assigned || 1} />
            </div>
          </div>
          <div className="mini-chart">
            <div className="mini-chart__title">Thu nhập</div>
            <div className="mini-chart__bars">
              <Bar label="Hôm nay" value={income.todayIncome} max={Math.max(income.todayIncome, income.monthIncome)} />
              <Bar label="Tháng" value={income.monthIncome} max={Math.max(income.monthIncome, income.totalIncome)} />
            </div>
          </div>
          <div className="mini-chart">
            <div className="mini-chart__title">Trạng thái đơn</div>
            <div className="mini-chart__bars">
              <Bar label="Chờ nhận" value={metrics.processing} max={myOrders.length || 1} />
              <Bar label="Đang giao" value={metrics.shipping} max={myOrders.length || 1} />
              <Bar label="Hủy" value={metrics.cancelled} max={myOrders.length || 1} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
