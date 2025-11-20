import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../redux/apiRequest";
import { ROUTERS } from "../../utils/router";
import "./style.scss";

const ExpiryAlert = memo(() => {
    const navigate = useNavigate();
    const [expiringItems, setExpiringItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);

    useEffect(() => {
        fetchExpiringItems();
    }, []);

    const fetchExpiringItems = async () => {
        setLoading(true);
        try {
            // API endpoint để lấy các sản phẩm sắp hết hạn
            // Backend đã sắp xếp: sắp hết hạn lên trên, đã hết hạn xuống dưới
            const response = await API.get('/stock/expiring-items?days=7');
            const items = response.data || [];
            
            setExpiringItems(items);
            setShow(items.length > 0);
        } catch (error) {
            console.error('Error fetching expiring items:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDaysUntilExpiry = (expiryDate) => {
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getAlertLevel = (days) => {
        if (days <= 0) return 'expired';
        if (days <= 2) return 'critical';
        if (days <= 5) return 'warning';
        return 'info';
    };

    const formatExpiryDate = (dateStr) => {
        try {
            return new Date(dateStr).toLocaleDateString('vi-VN');
        } catch {
            return dateStr;
        }
    };

    const handleNavigateToStock = () => {
        navigate(ROUTERS.ADMIN.STOCK);
    };

    const handleItemClick = (item) => {
        // Chuyển đến trang quản lý kho và có thể lọc theo sản phẩm cụ thể
        navigate(ROUTERS.ADMIN.STOCK, { 
            state: { 
                filterProduct: item.productName,
                highlightExpiring: true 
            } 
        });
    };

    if (loading) return null;
    if (!show || expiringItems.length === 0) return null;

    return (
        <div className="expiry-alert-container">
            <div className="expiry-alert">
                <div className="alert-header">
                    <h3>⚠️ Cảnh báo hạn sử dụng</h3>
                    <button 
                        className="close-btn" 
                        onClick={() => setShow(false)}
                        title="Đóng cảnh báo"
                    >
                        ×
                    </button>
                </div>
                
                <div className="alert-content">
                    <p className="alert-summary">
                        Có <strong>{expiringItems.length}</strong> lô hàng cần chú ý
                    </p>
                    
                    <div className="expiring-items-scroll">
                        {expiringItems.map((item, index) => {
                            const daysLeft = getDaysUntilExpiry(item.expiryDate);
                            const alertLevel = getAlertLevel(daysLeft);
                            
                            return (
                                <div 
                                    key={item._id || index} 
                                    className={`expiry-item ${alertLevel}`}
                                    onClick={() => handleItemClick(item)}
                                    style={{ cursor: 'pointer' }}
                                    title="Nhấn để xem chi tiết lô hàng"
                                >
                                    <div className="item-info">
                                        <strong>{item.productName}</strong>
                                        <span className="supplier">NCC: {item.supplierName}</span>
                                    </div>
                                    <div className="expiry-info">
                                        <span className="expiry-date">
                                            HSD: {formatExpiryDate(item.expiryDate)}
                                        </span>
                                        <span className={`days-left ${alertLevel}`}>
                                            {daysLeft <= 0 ? 'Đã hết hạn' : 
                                             daysLeft === 1 ? '1 ngày' : 
                                             `${daysLeft} ngày`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div className="alert-actions">
                    <button 
                        className="btn primary"
                        onClick={handleNavigateToStock}
                    >
                        Xem chi tiết
                    </button>
                    <button 
                        className="btn secondary"
                        onClick={() => setShow(false)}
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
});

ExpiryAlert.displayName = 'ExpiryAlert';

export default ExpiryAlert;