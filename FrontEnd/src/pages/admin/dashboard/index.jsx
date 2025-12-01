import React, { memo, useEffect, useState } from "react";
import "./style.scss";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LabelList,
  CartesianGrid, Area, AreaChart, RadialBarChart, RadialBar
} from "recharts";
import { Link } from "react-router-dom";
import { getOrderStats } from "../../../component/redux/apiRequest";
import ExpiryAlert from "../../../component/ExpiryAlert";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(""); // YYYY-MM format

  const loadStats = async (month = "") => {
    try {
      setLoading(true);
      const data = await getOrderStats(month);
      setStats(data);
    } catch (e) {
      console.error("Load stats fail:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats(selectedMonth);
  }, [selectedMonth]);

  if (loading) return <p>⏳ Đang tải dữ liệu...</p>;
  if (!stats) return <p>❌ Không có dữ liệu thống kê.</p>;

  // ===== Format data cho chart =====
  const revenueData = Object.entries(stats.revenueByMonth || {}).map(
    ([period, revenue]) => ({ period, revenue })
  );

  // Use backend-calculated metrics
  const totalRevenue = stats.totalRevenue || 0;
  const totalProfit = stats.totalProfit || 0;
  const totalCost = stats.totalCost || 0;
  const countOrders = stats.countOrders || 0;

  // Calculate order success rate
  const orderByStatus = stats.orderByStatus || {};
  const successOrders = (orderByStatus.completed || 0) + (orderByStatus.shipping || 0) + (orderByStatus.processing || 0) + (orderByStatus.delivered || 0);
  const failedOrders = (orderByStatus.cancelled || 0) + (orderByStatus.expired || 0);
  const successRate = countOrders > 0 ? ((successOrders / countOrders) * 100).toFixed(1) : 0;
  const failedRate = countOrders > 0 ? ((failedOrders / countOrders) * 100).toFixed(1) : 0;

  const orderSuccessData = [
    { name: "Thành công", value: successOrders, percent: successRate },
    { name: "Thất bại", value: failedOrders, percent: failedRate },
  ];

  // Top products data
  const productData = stats.topProducts || [];

  // Lượng truy cập theo tháng
  const visitsByMonth = stats.visitsByMonth || {};
  const displayedVisits = selectedMonth
    ? (visitsByMonth[selectedMonth] ?? stats.websiteVisits ?? 0)
    : (stats.websiteVisits ?? 0);

  // Sản phẩm sắp hết kho (dựa trên displayStock từ lô hàng)
  const LOW_STOCK_THRESHOLD = 10;
  const lowStockProducts = stats.lowStockProducts || [];
  const lowStockData = lowStockProducts.map((item) => ({
    ...item,
    displayStock: Number(item.displayStock ?? item.onHand ?? 0),
  }));
  const lowStockProductCount = stats.lowStockProductCount || lowStockProducts.length;

  // Tính tổng số đơn vị sắp hết kho để hiển thị chi tiết
  const totalLowStockUnits = lowStockData.reduce((sum, p) => sum + p.displayStock, 0);

  // 🎨 màu cố định theo trạng thái
  const statusColors = {
    pending: "#FF9800",
    processing: "#9C27B0",
    shipping: "#4CAF50",
    delivered: "#009688",
    completed: "#2196F3",
    expired: "#795548",
    cancelled: "#F44336",
  };

  // Custom tooltip cho biểu đồ
  const CustomTooltip = ({ active, payload, label, formatter }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {formatter ? formatter(entry.value, entry.name) : `${entry.name}: ${entry.value.toLocaleString()}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Gradient definitions
  const gradientOffset = () => {
    const dataMax = Math.max(...revenueData.map((i) => i.revenue));
    const dataMin = Math.min(...revenueData.map((i) => i.revenue));
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();

  return (
    <div className="dashboard">
      {/* 🔥 Filter Section */}
      <div className="filter-section">
        <div className="filter-group">
          <label>📅 Bộ lọc:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="month-select"
          >
            <option value="">Tất cả thời gian</option>
            {revenueData.map((item) => (
              <option key={item.period} value={item.period}>
                {item.period}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Stats */}
      <div className="stats">
        <div className="card highlight green">
          <h3>💰 Doanh Thu</h3>
          <p className="value">{totalRevenue.toLocaleString()} VNĐ</p>
          <span className="trend up">Tổng doanh thu</span>
        </div>

        <div className="card highlight profit">
          <h3>💎 Lợi Nhuận</h3>
          <p className="value">{totalProfit.toLocaleString()} VNĐ</p>
          <span className="trend up">
            Chi phí: {totalCost.toLocaleString()} VNĐ
          </span>
        </div>

        <Link to="/admin/orders" className="no-style">
          <div className="card highlight blue">
            <h3>📦 Đơn Hàng</h3>
            <p className="value">{countOrders}</p>
            <span className="trend up">
              Thành công: {successRate}% | Thất bại: {failedRate}%
            </span>
          </div>
        </Link>


        <div className="card highlight purple">
          <h3>👥 Lượng Truy Cập</h3>
          <p className="value">{displayedVisits.toLocaleString()}</p>
          <span className="trend up">
            {selectedMonth ? `Trong tháng ${selectedMonth}` : 'Tổng lượt đăng nhập'}
          </span>
        </div>

        <Link to="/admin/stock" className="no-style">
          <div className="card highlight orange">
            <h3>⚠️ Sắp Hết Kho</h3>
            <p className="value">{lowStockProductCount}</p>
            <span className="trend warning">
              Lô dưới {LOW_STOCK_THRESHOLD} đơn vị
            </span>
          </div>
        </Link>

      </div>

      {/* 📊 Charts Section */}
      <div className="charts">
        {/* Doanh thu theo thời gian - Area Chart với Gradient */}
        <div className="chart revenue-chart">
          <h3>💰 Doanh Thu Theo Thời Gian</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <Tooltip
                content={<CustomTooltip formatter={(value) => [`${value.toLocaleString()} VNĐ`, 'Doanh thu']} />}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tỉ lệ đơn hàng thành công vs thất bại - Radial Bar Chart */}
        <div className="chart success-rate-chart">
          <h3>📊 Tỉ Lệ Đơn Hàng</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <defs>
                <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={1} />
                </linearGradient>
              </defs>
              <Pie
                data={orderSuccessData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                label={({ name, percent }) => `${name}: ${percent}%`}
                labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                animationDuration={1000}
              >
                <Cell fill="url(#successGradient)" />
                <Cell fill="url(#failedGradient)" />
              </Pie>
              <Tooltip
                content={<CustomTooltip formatter={(v, name) => [`${v} đơn`, name]} />}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '14px', fontWeight: '600' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sản phẩm sắp hết kho - Gradient Bar Chart */}
        <div className="chart low-stock-chart">
          <h3>⚠️ Sản Phẩm Sắp Hết Kho (Dưới {LOW_STOCK_THRESHOLD})</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={lowStockData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <defs>
                <linearGradient id="lowStockGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                  <stop offset="100%" stopColor="#fca5a5" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="warningStockGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                angle={-25}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <Tooltip
                content={<CustomTooltip formatter={(value) => [`Còn: ${value.toLocaleString()}`, 'Số lượng']} />}
              />
              <Bar
                dataKey="displayStock"
                radius={[12, 12, 0, 0]}
                animationDuration={1200}
              >
                {lowStockData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.displayStock < LOW_STOCK_THRESHOLD ? 'url(#lowStockGradient)' : 'url(#warningStockGradient)'}
                  />
                ))}
                <LabelList
                  dataKey="displayStock"
                  position="top"
                  style={{ fontSize: '12px', fontWeight: 'bold', fill: '#374151' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top sản phẩm - Gradient Bar Chart */}
        <div className="chart top-products-chart">
          <h3>🏆 Top Sản Phẩm Bán Chạy</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <defs>
                <linearGradient id="topProductGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                angle={-25}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <Tooltip
                content={<CustomTooltip formatter={(v) => [`${v} đã bán`, 'Số lượng']} />}
              />
              <Bar
                dataKey="sales"
                fill="url(#topProductGradient)"
                radius={[12, 12, 0, 0]}
                animationDuration={1200}
              >
                <LabelList
                  dataKey="sales"
                  position="top"
                  style={{ fontSize: '12px', fontWeight: 'bold', fill: '#374151' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expiry Alert Component */}
      <ExpiryAlert />

      {/* 📋 Recent Orders Table */}
      <div className="recent-orders-section">
        <h3>📋 Đơn Hàng Gần Nhất {selectedMonth ? '(Đã lọc theo tháng)' : ''}</h3>
        <div className="table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Khách Hàng</th>
                <th>Tổng Tiền</th>
                <th>Chi Phí</th>
                <th>Lợi Nhuận</th>
                <th>Trạng Thái</th>
                <th>Ngày Tạo</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recentOrders || []).length > 0 ? (
                (stats.recentOrders || []).map((order) => (
                  <tr key={order._id}>
                    <td className="order-number">{order.orderNumber}</td>
                    <td>
                      <div className="customer-info">
                        <span className="name">{order.customer}</span>
                        {order.email && <span className="email">{order.email}</span>}
                      </div>
                    </td>
                    <td className="amount">{order.totalAmount.toLocaleString()} ₫</td>
                    <td className="cost">
                      {order.cost.toLocaleString()} ₫
                    </td>
                    <td className={`profit ${order.profit > 0 ? 'positive' : order.profit < 0 ? 'negative' : ''}`}>
                      {order.profit.toLocaleString()} ₫
                    </td>
                    <td>
                      <span className={`status-badge ${order.status}`}>
                        {order.status === 'pending' ? '⏳ Chờ' :
                          order.status === 'processing' ? '🛠️ Đang xử lý' :
                            order.status === 'shipping' || order.status === 'shipped' ? '🚚 Đang giao' :
                              order.status === 'delivered' ? '📦 Đã giao' :
                                order.status === 'completed' ? '✅ Hoàn thành' :
                                  order.status === 'expired' ? '⏰ Hết hạn' :
                                    order.status === 'cancelled' ? '❌ Đã hủy' : order.status}
                      </span>
                    </td>
                    <td className="date">
                      {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-data">Không có đơn hàng nào</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="recent-orders-footer">
          <Link to="/admin/orders" className="view-more-btn">
            Xem thêm
          </Link>
        </div>
      </div>
    </div>
  );
};

export default memo(Dashboard);
