import React, { memo, useEffect, useState } from "react";
import "./style.scss";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LabelList
} from "recharts";
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
  const successOrders = (orderByStatus.completed || 0) + (orderByStatus.shipped || 0) + (orderByStatus.paid || 0);
  const failedOrders = orderByStatus.cancelled || 0;
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
    paid: "#9C27B0",
    shipped: "#4CAF50",
    completed: "#2196F3",
    cancelled: "#F44336",
  };

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

        <div className="card highlight blue">
          <h3>📦 Đơn Hàng</h3>
          <p className="value">{countOrders}</p>
          <span className="trend up">
            Thành công: {successRate}% | Thất bại: {failedRate}%
          </span>
        </div>

        <div className="card highlight purple">
          <h3>👥 Lượng Truy Cập</h3>
          <p className="value">{displayedVisits.toLocaleString()}</p>
          <span className="trend up">
            {selectedMonth ? `Trong tháng ${selectedMonth}` : 'Tổng lượt đăng nhập'}
          </span>
        </div>

        <div className="card highlight orange">
          <h3>⚠️ Sắp Hết Kho</h3>
          <p className="value">{lowStockProductCount}</p>
          <span className="trend warning">
            Lô dưới {LOW_STOCK_THRESHOLD} đơn vị
          </span>
        </div>
      </div>

      {/* 📊 Charts Section */}
      <div className="charts">
        {/* Doanh thu theo thời gian */}
        <div className="chart">
          <h3>Doanh Thu Theo Thời Gian</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueData} margin={{ top: 20, right: 30, left: 50, bottom: 20 }}>
              <XAxis dataKey="period"  />
              <YAxis 
                tick={{ fontSize: 15 }} 
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value) => `${Number(value).toLocaleString()} VND`}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tỉ lệ đơn hàng thành công vs thất bại */}
        <div className="chart">
          <h3>Tỉ Lệ Đơn Hàng (Thành công / Thất bại)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={orderSuccessData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name}: ${percent}%`}
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip formatter={(v) => `${v} đơn`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sản phẩm sắp hết kho */}
        <div className="chart">
          <h3>Sản Phẩm Sắp Hết Kho (Dưới {LOW_STOCK_THRESHOLD})</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={lowStockData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="name" 
                angle={-15}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`Còn: ${Number(value).toLocaleString()}`, 'Số lượng khả dụng']}
              />
              <Bar dataKey="displayStock" radius={[8, 8, 0, 0]}>
                {lowStockData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.displayStock < LOW_STOCK_THRESHOLD ? '#ef4444' : '#f59e0b'} 
                  />
                ))}
                <LabelList dataKey="displayStock" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top sản phẩm */}
        <div className="chart">
          <h3>Top Sản Phẩm Bán Chạy</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={productData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="name" 
                angle={-15}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
              />
              <YAxis />
              <Tooltip formatter={(v) => `${v} đã bán`} />
              <Bar dataKey="sales" fill="#9C27B0" radius={[8, 8, 0, 0]}>
                <LabelList dataKey="sales" position="top" />
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
                         order.status === 'paid' ? '💳 Đã thanh toán' :
                         order.status === 'shipped' ? '🚚 Đang giao' :
                         order.status === 'completed' ? '✅ Hoàn thành' :
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
      </div>
    </div>
  );
};

export default memo(Dashboard);
