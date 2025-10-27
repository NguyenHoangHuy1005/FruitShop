import React, { memo, useEffect, useState } from "react";
import "./style.scss";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { getOrderStats } from "../../../component/redux/apiRequest";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(""); // "" = all, "2025-01" = Jan 2025

  useEffect(() => {
    (async () => {
      try {
        const data = await getOrderStats();
        setStats(data);
      } catch (e) {
        console.error("Load stats fail:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>⏳ Đang tải dữ liệu...</p>;
  if (!stats) return <p>❌ Không có dữ liệu thống kê.</p>;

  // ===== Format data cho chart =====
  const revenueData = Object.entries(stats.revenueByMonth || {}).map(
    ([period, revenue]) => ({ period, revenue })
  );

  // 🔥 Lọc orderByStatus theo tháng
  const orderData = (() => {
    if (!selectedMonth) {
      // Hiển thị tất cả
      return Object.entries(stats.orderByStatus || {}).map(
        ([status, value]) => ({ status, value })
      );
    }
    
    // Lọc theo tháng (cần backend hỗ trợ orderByStatusAndMonth)
    const monthData = stats.orderByStatusAndMonth?.[selectedMonth] || {};
    return Object.entries(monthData).map(
      ([status, value]) => ({ status, value })
    );
  })();

  // 🔥 Lọc topProducts theo tháng
  const productData = (() => {
    if (!selectedMonth) {
      return stats.topProducts || [];
    }
    
    // Lọc theo tháng (cần backend hỗ trợ topProductsByMonth)
    return stats.topProductsByMonth?.[selectedMonth] || [];
  })();

  // (Traffic demo)
  const trafficData = [
    { source: "Google", visits: 400 },
    { source: "Facebook", visits: 300 },
    { source: "Direct", visits: 200 },
    { source: "Other", visits: 100 },
  ];

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
      <div className="filter-section" style={{ 
        marginBottom: '20px', 
        padding: '16px', 
        background: 'linear-gradient(135deg, #f8f9fa, #ffffff)',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <label style={{ 
          fontWeight: '700', 
          marginRight: '12px', 
          fontSize: '14px',
          color: '#334155'
        }}>
          🗓️ Lọc theo tháng:
        </label>
        <select 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '2px solid #e2e8f0',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            minWidth: '180px'
          }}
        >
          <option value="">Tất cả thời gian</option>
          {revenueData.map((item) => (
            <option key={item.period} value={item.period}>
              {item.period}
            </option>
          ))}
        </select>
      </div>

      {/* Top Stats */}
      <div className="stats">
        <div className="card highlight blue">
          <h3>Doanh Thu</h3>
          <p className="value">{stats.totalRevenue.toLocaleString()} VNĐ</p>
          <span className="trend up">Tổng doanh thu</span>
        </div>

        <div className="card highlight green">
          <h3>Đơn Hàng</h3>
          <p className="value">{stats.countOrders}</p>
          <span className="trend up">Tổng số đơn</span>
        </div>

        <div className="card highlight purple">
          <h3>Top SP</h3>
          <p className="value">
            {productData[0] ? productData[0].name : "N/A"}
          </p>
          <span className="trend up">Bán chạy nhất</span>
        </div>

        <div className="card highlight orange">
          <h3>Trạng Thái</h3>
          <p className="value">{orderData.length}</p>
          <span className="trend warning">Số loại trạng thái đơn</span>
        </div>
      </div>

      {/* 📊 Charts Section */}
      <div className="charts">
        {/* Doanh thu theo thời gian */}
        <div className="chart">
          <h3>📊 Doanh Thu Theo Thời Gian</h3>
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
                stroke="#3F51B5"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Đơn hàng theo trạng thái */}
        <div className="chart">
          <h3>📊 Trạng Thái Đơn Hàng</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={orderData}
                dataKey="value"
                nameKey="status"
                innerRadius={60}
                outerRadius={100}
                label={({ name, value, percent }) =>
                  `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                }
              >
                {orderData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={statusColors[entry.status] || "#999"}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v} đơn`} />
              <Legend
                formatter={(value) => (
                  <span className={`legend-item legend-item-${value.toLowerCase()}`}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Traffic Website */}
        <div className="chart">
          <h3>📊 Lượng Truy Cập Website</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trafficData}>
              <XAxis dataKey="source" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="visits" fill="#00BCD4" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top sản phẩm */}
        <div className="chart">
          <h3>📊 Top Sản Phẩm Bán Chạy</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={productData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="sales" fill="#9C27B0" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default memo(Dashboard);
