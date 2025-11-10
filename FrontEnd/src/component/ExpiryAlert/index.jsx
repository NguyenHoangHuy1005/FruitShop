import { memo, useEffect, useState } from "react";
import { API } from "../redux/apiRequest";
import "./style.scss";

const ExpiryAlert = memo(() => {
    const [expiringItems, setExpiringItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);

    useEffect(() => {
        fetchExpiringItems();
    }, []);

    const fetchExpiringItems = async () => {
        setLoading(true);
        try {
            // API endpoint để lấy các sản phẩm sắp hết hạn (trong 7 ngày tới)
            const response = await API.get('/stock/expiring-items?days=7');
            const items = response.data || [];
            
            // Sắp xếp theo mức độ ưu tiên (đảm bảo thêm lần nữa)
            const sortedItems = items.sort((a, b) => {
                const now = new Date();
                const aExpiry = new Date(a.expiryDate);
                const bExpiry = new Date(b.expiryDate);
                
                const aDaysLeft = Math.ceil((aExpiry - now) / (24 * 60 * 60 * 1000));
                const bDaysLeft = Math.ceil((bExpiry - now) / (24 * 60 * 60 * 1000));
                
                const getStatus = (daysLeft) => {
                    if (daysLeft <= 0) return 'expired';
                    if (daysLeft <= 7) return 'expiring';
                    return 'valid';
                };
                
                const aStatus = getStatus(aDaysLeft);
                const bStatus = getStatus(bDaysLeft);
                
                const statusPriority = { 'expired': 0, 'expiring': 1, 'valid': 2 };
                
                if (aStatus !== bStatus) {
                    return statusPriority[aStatus] - statusPriority[bStatus];
                }
                
                return aExpiry - bExpiry;
            });
            
            setExpiringItems(sortedItems);
            setShow(sortedItems.length > 0);
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
                        Có <strong>{expiringItems.length}</strong> lô hàng sắp hết hạn sử dụng
                    </p>
                    
                    <div className="expiring-items">
                        {expiringItems.slice(0, 5).map((item, index) => {
                            const daysLeft = getDaysUntilExpiry(item.expiryDate);
                            const alertLevel = getAlertLevel(daysLeft);
                            
                            return (
                                <div key={index} className={`expiry-item ${alertLevel}`}>
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
                        
                        {expiringItems.length > 5 && (
                            <div className="more-items">
                                +{expiringItems.length - 5} lô hàng khác...
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="alert-actions">
                    <button 
                        className="btn primary"
                        onClick={() => {/* Navigate to stock page */}}
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