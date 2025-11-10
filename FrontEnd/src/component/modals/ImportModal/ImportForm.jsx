import { memo, useState, useEffect } from "react";
import "./ImportForm.scss";

const ImportForm = memo(({
    suppliers = [],
    productName = "",
    onSubmit,
    onCancel,
    busy = false
}) => {
    const [formData, setFormData] = useState({
        supplierId: "",
        quantity: "",
        unitPrice: "",
        importDate: new Date().toISOString().split('T')[0], // Ngày hôm nay
        expiryDate: "",
        note: ""
    });

    // Reset form khi component được mount lại
    useEffect(() => {
        setFormData({
            supplierId: "",
            quantity: "",
            unitPrice: "",
            importDate: new Date().toISOString().split('T')[0],
            expiryDate: "",
            note: ""
        });
    }, [productName]); // Reset khi productName thay đổi (modal mở cho sản phẩm mới)

    // Tính tổng tiền
    const quantity = parseInt(formData.quantity, 10) || 0;
    const unitPrice = parseFloat(formData.unitPrice) || 0;
    const totalAmount = quantity * unitPrice;

    // Format tiền tệ
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const validateForm = () => {
        if (!formData.supplierId) return "Vui lòng chọn nhà cung cấp!";
        
        const quantity = parseInt(formData.quantity, 10);
        if (!formData.quantity || quantity <= 0) return "Số lượng phải lớn hơn 0!";
        
        const unitPrice = parseFloat(formData.unitPrice);
        if (!formData.unitPrice || unitPrice <= 0) return "Đơn giá phải lớn hơn 0!";
        
        if (!formData.importDate) return "Vui lòng chọn ngày nhập!";
        
        // Validate dates
        if (formData.expiryDate && formData.importDate && 
            new Date(formData.expiryDate) <= new Date(formData.importDate)) {
            return "Hạn sử dụng phải sau ngày nhập!";
        }
        
        return "";
    };

    const handleSubmit = () => {
        const error = validateForm();
        if (error) {
            alert(error);
            return;
        }
        
        // Chuyển đổi dữ liệu về số trước khi gửi
        const submitData = {
            ...formData,
            quantity: parseInt(formData.quantity, 10),
            unitPrice: parseFloat(formData.unitPrice)
        };
        
        onSubmit(submitData);
    };

    return (
        <div className="import-form">
            <h3>Nhập kho từ Nhà cung cấp</h3>
            
            {productName && (
                <div className="product-info">
                    <strong>Sản phẩm: </strong>
                    <span>{productName}</span>
                </div>
            )}

            <div className="form-group">
                <label>Nhà cung cấp: <span className="required">*</span></label>
                <div className="supplier-select">
                    <select 
                        value={formData.supplierId} 
                        onChange={(e) => handleInputChange('supplierId', e.target.value)}
                        disabled={busy}
                    >
                        <option value="">-- Chọn nhà cung cấp --</option>
                        {suppliers.map((s) => (
                            <option key={s._id} value={s._id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label>Số lượng: <span className="required">*</span></label>
                    <input
                        type="number"
                        min={1}
                        step="1"
                        value={formData.quantity}
                        onChange={(e) => handleInputChange('quantity', e.target.value)}
                        disabled={busy}
                        placeholder="Nhập số lượng"
                    />
                </div>

                <div className="form-group">
                    <label>Đơn giá nhập: <span className="required">*</span></label>
                    <input
                        type="number"
                        min="0"
                        step="100"
                        value={formData.unitPrice}
                        onChange={(e) => handleInputChange('unitPrice', e.target.value)}
                        disabled={busy}
                        placeholder="Nhập đơn giá"
                    />
                </div>
            </div>

            {/* Hiển thị tính toán tổng tiền */}
            {(quantity > 0 && unitPrice > 0) && (
                <div className="calculation-summary">
                    <div className="calculation-row">
                        <span className="label">Số lượng:</span>
                        <span className="value">{quantity.toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="calculation-row">
                        <span className="label">Đơn giá:</span>
                        <span className="value">{formatCurrency(unitPrice)}</span>
                    </div>
                    <div className="calculation-row total">
                        <span className="label">Tổng tiền:</span>
                        <span className="value">{formatCurrency(totalAmount)}</span>
                    </div>
                </div>
            )}

            <div className="form-row">
                <div className="form-group">
                    <label>Ngày nhập: <span className="required">*</span></label>
                    <input
                        type="date"
                        value={formData.importDate}
                        onChange={(e) => handleInputChange('importDate', e.target.value)}
                        disabled={busy}
                    />
                </div>

                <div className="form-group">
                    <label>Hạn sử dụng:</label>
                    <input
                        type="date"
                        value={formData.expiryDate}
                        onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                        min={formData.importDate} // Không thể chọn ngày trước ngày nhập
                        disabled={busy}
                        placeholder="Để trống nếu không có HSD"
                    />
                    <small className="help-text">Để trống nếu sản phẩm không có hạn sử dụng</small>
                </div>
            </div>

            <div className="form-group">
                <label>Ghi chú:</label>
                <textarea 
                    value={formData.note} 
                    onChange={(e) => handleInputChange('note', e.target.value)}
                    placeholder="Nhập ghi chú thêm về lô hàng này..."
                    disabled={busy}
                />
            </div>

            <div className="modal-actions">
                <button 
                    className="btn special" 
                    onClick={handleSubmit}
                    disabled={busy}
                >
                    {busy ? "Đang xử lý..." : "Lưu phiếu nhập"}
                </button>
                <button 
                    className="btn outline" 
                    onClick={onCancel}
                    disabled={busy}
                >
                    Hủy
                </button>
            </div>
        </div>
    );
});

ImportForm.displayName = 'ImportForm';

export default ImportForm;