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

  // 🔥 Tính tỉ lệ đơn hàng thành công vs thất bại THEO THÁNG ĐÃ CHỌN
  const calculateOrderRates = () => {
    let successOrders = 0;
    let failedOrders = 0;
    let totalOrders = 0;

    if (!selectedMonth) {
      // Tất cả thời gian
      successOrders = (stats.orderByStatus?.completed || 0) + 
                      (stats.orderByStatus?.shipped || 0) + 
                      (stats.orderByStatus?.paid || 0);
      failedOrders = stats.orderByStatus?.cancelled || 0;
      totalOrders = stats.countOrders;
    } else {
      // Theo tháng cụ thể
      const monthData = stats.orderByStatusAndMonth?.[selectedMonth] || {};
      successOrders = (monthData.completed || 0) + 
                      (monthData.shipped || 0) + 
                      (monthData.paid || 0);
      failedOrders = monthData.cancelled || 0;
      totalOrders = Object.values(monthData).reduce((sum, val) => sum + val, 0);
    }

    const successRate = totalOrders > 0 
      ? ((successOrders / totalOrders) * 100).toFixed(1) 
      : 0;
    const failedRate = totalOrders > 0 
      ? ((failedOrders / totalOrders) * 100).toFixed(1) 
      : 0;

    return {
      successOrders,
      failedOrders,
      successRate,
      failedRate,
      totalOrders,
    };
  };

  const orderRates = calculateOrderRates();

  const orderSuccessData = [
    { name: "Thành công", value: orderRates.successOrders, percent: orderRates.successRate },
    { name: "Thất bại", value: orderRates.failedOrders, percent: orderRates.failedRate },
  ];

  // 🔥 Lọc topProducts theo tháng
  const productData = (() => {
    if (!selectedMonth) {
      return stats.topProducts || [];
    }
    
    // Lọc theo tháng (cần backend hỗ trợ topProductsByMonth)
    return stats.topProductsByMonth?.[selectedMonth] || [];
  })();

  // Sản phẩm sắp hết kho
  const lowStockData = stats.lowStockProducts || [];
  const criticalStockCount = lowStockData.filter(p => p.onHand < 10).length;

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
        <div className="card highlight green">
          <h3>💰 Doanh Thu</h3>
          <p className="value">{stats.totalRevenue.toLocaleString()} VNĐ</p>
          <span className="trend up">Tổng doanh thu</span>
        </div>

        <div className="card highlight blue">
          <h3>📦 Đơn Hàng</h3>
          <p className="value">{selectedMonth ? orderRates.totalOrders : stats.countOrders}</p>
          <span className="trend up">
            Thành công: {orderRates.successRate}% | Thất bại: {orderRates.failedRate}%
          </span>
        </div>

        <div className="card highlight purple">
          <h3>👥 Lượng Truy Cập</h3>
          <p className="value">{(stats.websiteVisits || 0).toLocaleString()}</p>
          <span className="trend up">Tổng lượt đăng nhập</span>
        </div>

        <div className="card highlight orange">
          <h3>⚠️ Sắp Hết Kho</h3>
          <p className="value">{lowStockData.length}</p>
          <span className="trend warning">
            {criticalStockCount} sản phẩm dưới 10
          </span>
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
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tỉ lệ đơn hàng thành công vs thất bại */}
        <div className="chart">
          <h3>📊 Tỉ Lệ Đơn Hàng (Thành công / Thất bại)</h3>
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
                <Cell fill="#3b82f6" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip formatter={(v) => `${v} đơn`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sản phẩm sắp hết kho */}
        <div className="chart">
          <h3>⚠️ Sản Phẩm Sắp Hết Kho (Dưới 20)</h3>
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
                formatter={(value, name) => {
                  if (name === 'onHand') return [`Còn: ${value}`, 'Số lượng'];
                  return [value, name];
                }}
              />
              <Bar dataKey="onHand" radius={[8, 8, 0, 0]}>
                {lowStockData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.onHand < 10 ? '#ef4444' : '#f59e0b'} 
                  />
                ))}
                <LabelList dataKey="onHand" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top sản phẩm */}
        <div className="chart">
          <h3>📊 Top Sản Phẩm Bán Chạy</h3>
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
    </div>
  );
};

export default memo(Dashboard);
