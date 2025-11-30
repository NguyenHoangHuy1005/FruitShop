import { useCallback, useEffect, useMemo, useState } from "react";
import OrderStatusTag from "../../../component/orders/OrderStatusTag";
import { fetchShipperIncomeHistory, fetchShipperIncomeSummary } from "../../../component/redux/apiRequest";
import { formatter } from "../../../utils/fomater";
import "../theme.scss";
import "./style.scss";

const formatTime = (ts) => (ts ? new Date(ts).toLocaleString("vi-VN") : "--");

const ShipperIncome = () => {
  const [summary, setSummary] = useState({
    todayIncome: 0,
    monthIncome: 0,
    totalIncome: 0,
    totalDelivered: 0,
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, historyRes] = await Promise.all([
        fetchShipperIncomeSummary(),
        fetchShipperIncomeHistory({ from, to }),
      ]);
      const summaryData = summaryRes?.data || summaryRes?.summary || summaryRes || {};
      setSummary({
        todayIncome: summaryData.todayIncome || 0,
        monthIncome: summaryData.monthIncome || 0,
        totalIncome: summaryData.totalIncome || 0,
        totalDelivered: summaryData.totalDelivered || 0,
      });
      setRows(historyRes?.data || historyRes?.orders || historyRes?.list || []);
    } catch (e) {
      setError(e?.message || "Khong the tai thu nhap.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const totalIncome = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.shipperIncome || r.shippingFeeActual || 0), 0),
    [rows]
  );

  const handleClearFilters = () => {
    setFrom("");
    setTo("");
  };

  return (
    <div className="shipper-page shipper-income-page">
      <div className="shipper-income-page__header">
        <div>
          <h1>Thu nhập</h1>
          <p className="shipper-income-page__hint">Thống kê thu nhập theo đơn đã giao.</p>
        </div>
        <button type="button" className="shipper-refresh" onClick={load} disabled={loading}>
          Làm mới
        </button>
      </div>

      <div className="shipper-income-page__summary">
        <div className="shipper-card">
          <div className="shipper-card__label">Hôm nay</div>
          <div className="shipper-card__value">{formatter(summary.todayIncome || 0)}</div>
        </div>
        <div className="shipper-card">
          <div className="shipper-card__label">Tháng nay</div>
          <div className="shipper-card__value">{formatter(summary.monthIncome || 0)}</div>
        </div>
        <div className="shipper-card">
          <div className="shipper-card__label">Tổng thu nhập</div>
          <div className="shipper-card__value">{formatter(summary.totalIncome || 0)}</div>
        </div>
        <div className="shipper-card">
          <div className="shipper-card__label">Tổng đơn đã giao</div>
          <div className="shipper-card__value">{summary.totalDelivered || 0}</div>
        </div>
      </div>

      <div className="shipper-income-page__filters">
        <div className="shipper-filters__group">
          <label>Từ ngày</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="shipper-filters__group">
          <label>Đến ngày</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" className="shipper-refresh" onClick={load} disabled={loading}>
          Áp dụng
        </button>
        <button
          type="button"
          className="shipper-refresh shipper-refresh--secondary"
          onClick={handleClearFilters}
          disabled={loading}
        >
          Xóa lọc
        </button>
        <div className="shipper-income-page__total">
          <span>Tổng thu nhập trong danh sách:</span>
          <strong className="shipper-income__total-value">{formatter(totalIncome)}</strong>
        </div>
      </div>

      {loading && <p>Đang tải dữ liệu...</p>}
      {!loading && error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="shipper-empty">
          <p>Chưa có thu nhập nào trong khoảng ngày chọn.</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="shipper-income-page__table">
          <table className="shipper-table">
            <thead>
              <tr>
                <th>Đơn</th>
                <th>Ngày giao</th>
                <th>Phí ship nhận</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>#{String(row._id).slice(-8).toUpperCase()}</td>
                  <td>{formatTime(row.deliveredAt || row.updatedAt || row.createdAt)}</td>
                  <td className="shipper-income__number">
                    {formatter(row.shipperIncome || row.shippingFeeActual || 0)}
                  </td>
                  <td>
                    <OrderStatusTag status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ShipperIncome;
