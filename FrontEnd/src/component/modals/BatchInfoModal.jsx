import { useState, useEffect } from "react";
import "./BatchInfoModal.scss";

const BatchInfoModal = ({ productId, productName, onClose, onPriceUpdate }) => {
  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingBatch, setEditingBatch] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  
  // Focus management
  useEffect(() => {
    // Focus on modal when it opens
    const modalElement = document.querySelector('.batch-info-modal');
    if (modalElement) {
      modalElement.focus();
    }
  }, []);

  useEffect(() => {
    if (productId) {
      fetchBatches();
    }
  }, [productId]);

  // Keyboard support for ESC key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3000/api/stock/batches/${productId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error('Không thể lấy thông tin lô hàng');
      }

      const data = await response.json();

      // Normalize batches and compute status based on expiry date (not quantity)
      const rawBatches = data.batches || data || [];
      const now = new Date();
        // Use date-only comparison (ignore time-of-day) to avoid timezone / partial-day issues
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        const processed = (rawBatches || []).map((b) => {
          const expiryDate = b.expiryDate ? new Date(b.expiryDate) : null;
          let daysLeft = null;
          // If batch has no remaining units, mark as 'empty' and don't count as expired
          const remaining = Number(b.remainingQuantity || 0);
          let status = 'valid';
          if (remaining <= 0) {
            status = 'empty';
          } else if (expiryDate) {
            const expiryDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
            daysLeft = Math.floor((expiryDay - today) / MS_PER_DAY);
            if (daysLeft < 0) status = 'expired';
            else if (daysLeft <= 7) status = 'expiring';
          }

          return {
            ...b,
            expiryDate: b.expiryDate,
            daysLeft,
            status,
            // number of units in this batch that are expired (only count remaining units)
            expiredQuantity: (status === 'expired' && remaining > 0) ? remaining : 0,
          };
        });

      setBatches(processed);

      // Always derive totals from processed batches (merge with backend summary if present)
      const totalBatches = processed.length;
      const totalImported = processed.reduce((s, x) => s + (Number(x.batchQuantity) || 0), 0);
      const totalSold = processed.reduce((s, x) => s + (Number(x.soldQuantity) || 0), 0);
  const totalDamaged = processed.reduce((s, x) => s + (Number(x.damagedQuantity) || 0), 0);
  const totalExpired = processed.reduce((s, x) => s + (Number(x.expiredQuantity || 0)), 0);
      // totalRemaining: sum of remainingQuantity only for non-expired batches
      const totalRemaining = processed.reduce((s, x) => {
        if (!x.expiryDate) return s + (Number(x.remainingQuantity) || 0);
        const exp = new Date(x.expiryDate);
        return exp > now ? s + (Number(x.remainingQuantity) || 0) : s;
      }, 0);

      const derived = {
        totalBatches,
        totalImported,
        totalSold,
        totalDamaged,
        totalExpired,
        totalRemaining,
      };

      setSummary({ ...(data.summary || {}), ...derived });
    } catch (error) {
      console.error('Error fetching batches:', error);
      alert('Lỗi khi lấy thông tin lô hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrice = (batch) => {
    // Allow editing price even for expired batches so admin can correct price/stock/status
    setEditingBatch(batch._id);
    setEditPrice((batch.sellingPrice ?? 0).toString());
  };

  const handleSavePrice = async (batchId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/stock/batch/${batchId}/selling-price`, {
        method: 'PUT',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({ sellingPrice: Number(editPrice) })
      });

      if (!response.ok) {
        throw new Error('Không thể cập nhật giá bán');
      }

      // Refresh batches
      await fetchBatches();
      setEditingBatch(null);
      setEditPrice('');
      
      // Call parent component refresh callback
      if (onPriceUpdate) {
        await onPriceUpdate();
      }
      
      alert('Cập nhật giá bán thành công!');
    } catch (error) {
      console.error('Error updating selling price:', error);
      alert('Lỗi cập nhật giá bán: ' + error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingBatch(null);
    setEditPrice('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Không có';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getStatusBadge = (batch) => {
    const { status, daysLeft } = batch;
    
    let className = 'status-badge ';
    let text = '';
    
    switch (status) {
      case 'expired':
        className += 'expired';
        text = 'Hết hạn';
        break;
      case 'expiring':
        className += 'expiring';
        text = `Sắp hết hạn (${daysLeft} ngày)`;
        break;
      case 'empty':
        className += 'empty';
        text = 'Đã hết';
        break;
      default:
        className += 'valid';
        text = daysLeft ? `Còn ${daysLeft} ngày` : 'Còn hạn';
    }
    
    return <span className={className}>{text}</span>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="batch-info-modal" 
        onClick={(e) => e.stopPropagation()}
        tabIndex="-1"
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 id="modal-title">Thông tin lô hàng - {productName}</h3>
          <button 
            className="btn-close" 
            onClick={onClose}
            aria-label="Đóng modal"
            title="Đóng"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading">Đang tải thông tin lô hàng...</div>
          ) : batches.length === 0 ? (
            <div className="no-batches">Chưa có lô hàng nào cho sản phẩm này</div>
          ) : (
            <div>
              {/* Thông tin tổng hợp */}
              {summary && (
                <div className="batch-summary">
                  <h4>Tổng hợp thông tin kho</h4>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <label>Tổng số lô:</label>
                      <span>{summary.totalBatches}</span>
                    </div>
                    <div className="summary-item">
                      <label>Tổng nhập:</label>
                      <span>{summary.totalImported}</span>
                    </div>
                    <div className="summary-item">
                      <label>Đã bán:</label>
                      <span>{summary.totalSold}</span>
                    </div>
                    <div className="summary-item expired">
                      <label>Tổng hết hạn:</label>
                      <span style={{color: '#ef4444', fontWeight: '700'}}>{(summary.totalExpired || 0).toLocaleString()}</span>
                    </div>
                    <div className="summary-item damaged">
                      <label>Tổng hư hại:</label>
                      <span style={{color: '#ef4444', fontWeight: '700'}}>{(summary.totalDamaged || 0).toLocaleString()}</span>
                    </div>
                    <div className="summary-item remaining">
                      <label>Tồn kho còn lại:</label>
                      <span style={{color: '#059669', fontWeight: '700'}}>{(summary.totalRemaining || 0).toLocaleString()}</span>
                    </div>
                    
                  </div>
                </div>
              )}
              
              <div className="batches-list">
                {batches.map((batch, index) => (
                  <div key={batch._id} className={`batch-item ${batch.status} ${batch.isActive ? 'active-batch' : ''}`}>
                    <div className="batch-header">
                      <div className="batch-title">
                        <span className="batch-number">Lô #{index + 1}</span>
                        {batch.isActive && (
                          <span className="active-badge">Đang hiệu lực</span>
                        )}
                      </div>
                      <div className="batch-status">
                        {getStatusBadge(batch)}
                      </div>
                    </div>

                    <div className="batch-info">
                      <div className="info-left">
                        <div className="info-row">
                          <label>Nhà cung cấp:</label>
                          <span>{batch.supplierName}</span>
                        </div>
                        
                        <div className="info-row">
                          <label>Ngày nhập:</label>
                          <span>{formatDate(batch.importDate)}</span>
                        </div>
                        
                        <div className="info-row">
                          <label>Hạn sử dụng:</label>
                          <span>{formatDate(batch.expiryDate)}</span>
                        </div>
                        
                        <div className="info-row">
                          <label>Giá nhập:</label>
                          <span>{formatCurrency(batch.unitPrice)}</span>
                        </div>
                      </div>
                      
                      <div className="vertical-divider"></div>
                      
                      <div className="info-right">
                        <div className="info-row">
                          <label>Số lượng nhập:</label>
                          <span>{batch.batchQuantity}</span>
                        </div>
                        <div className="info-row">
                          <label>Đã bán:</label>
                          <span className="sold">{batch.soldQuantity}</span>
                        </div>
                        <div className="info-row">
                          <label>Hư hại:</label>
                          <span className="damaged" style={{color: '#ef4444', fontWeight: 700}}>{(batch.damagedQuantity || 0).toLocaleString()}</span>
                        </div>
                        <div className="info-row">
                          <label>Còn lại:</label>
                          <span className="remaining">{batch.remainingQuantity}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="info-row selling-price-row">
                      <label>Giá bán:</label>
                      {editingBatch === batch._id ? (
                        <div className="price-edit">
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            min="0"
                            step="1000"
                          />
                          <button 
                            className="btn-save"
                            onClick={() => handleSavePrice(batch._id)}
                          >
                            ✓
                          </button>
                          <button 
                            className="btn-cancel"
                            onClick={handleCancelEdit}
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <div className="price-display">
                          <span>{formatCurrency(batch.sellingPrice)}</span>
                          {batch.status !== 'expired' ? (
                            <button 
                              className="btn-edit-price"
                              onClick={() => handleEditPrice(batch)}
                            >
                              Sửa
                            </button>
                          ) : (
                            <span className="expired-notice">Hết hạn</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-close-modal" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchInfoModal;