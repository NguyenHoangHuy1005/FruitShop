import React, { memo } from "react";
import "./style.scss";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";

const Dashboard = () => {
  // Fake Data
  const revenueData = [
    { period: "Jan", revenue: 4000 },
    { period: "Feb", revenue: 3200 },
    { period: "Mar", revenue: 5000 },
    { period: "Apr", revenue: 4200 },
    { period: "May", revenue: 6000 },
    { period: "Jun", revenue: 7500 },
  ];

  const orderData = [
    { status: "Đang xử lý", value: 35 },
    { status: "Đã giao", value: 50 },
    { status: "Đã hủy", value: 15 },
  ];
  const orderColors = ["#FF9800", "#4CAF50", "#F44336"];

  const trafficData = [
    { source: "Google", visits: 400 },
    { source: "Facebook", visits: 300 },
    { source: "Direct", visits: 200 },
    { source: "Other", visits: 100 },
  ];

  const productData = [
    { name: "MacBook Pro", sales: 120 },
    { name: "iPhone 14", sales: 200 },
    { name: "iPad Pro", sales: 90 },
    { name: "AirPods", sales: 150 },
  ];

  return (
    <div className="dashboard">
      {/* 🔥 Top Stats */}
      <div className="stats">
        {/* 🟦 Doanh thu */}
        <div className="card highlight blue">
          <h3>Doanh Thu</h3>
          <p className="value">$7,500</p>
          <span className="trend up">+12% so với tháng trước</span>
        </div>

        {/* 🟩 Đơn hàng */}
        <div className="card highlight green">
          <h3>Đơn Hàng</h3>
          <p className="value">1,245</p>
          <span className="trend up">+8% so với tuần trước</span>
        </div>

        {/* 🟪 Người dùng */}
        <div className="card highlight purple">
          <h3>Người Dùng</h3>
          <p className="value">5,432</p>
          <span className="trend down">+120 mới đăng ký hôm nay</span>
        </div>

        {/* 🟧 Sản phẩm */}
        <div className="card highlight orange">
          <h3>Sản Phẩm</h3>
          <p className="value">320</p>
          <span className="trend warning">15 sản phẩm sắp hết hàng</span>
        </div>
      </div>

      {/* 📊 Charts Section */}
      <div className="charts">
        {/* Doanh thu theo thời gian */}
        <div className="chart">
          <h3>📊 Doanh Thu Theo Thời Gian</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueData}>
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#3F51B5" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Đơn hàng theo trạng thái */}
        <div className="chart">
          <h3>📊 Trạng Thái Đơn Hàng</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={orderData}
                dataKey="value"
                innerRadius={50}
                outerRadius={100}
                label
              >
                {orderData.map((entry, index) => (
                  <Cell key={index} fill={orderColors[index]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
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
