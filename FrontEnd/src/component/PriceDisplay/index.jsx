import { memo } from 'react';
import { formatter } from '../../utils/fomater';
import { usePriceRange } from '../../hooks/usePriceRange';
import './PriceDisplay.scss';

const PriceDisplay = memo(({ 
  productId, 
  className = "", 
  showLoading = true,
  showOutOfStock = true,
  fallbackPrice = null,  // Giá fallback từ Product model
  fallbackDiscount = 0   // Discount % từ Product model
}) => {
  const { priceRange, loading, error } = usePriceRange(productId);

  if (loading && showLoading) {
    return (
      <div className={`price-display loading ${className}`}>
        <span className="loading-text">Đang tải giá...</span>
      </div>
    );
  }

  // Nếu không có priceRange từ batch, dùng fallback price từ Product
  if (!priceRange || (priceRange.min === 0 && priceRange.max === 0)) {
    // Có fallback price → hiển thị giá từ Product model
    if (fallbackPrice && fallbackPrice > 0) {
      const discountPct = Number(fallbackDiscount) || 0;
      const finalPrice = Math.round(fallbackPrice * (100 - discountPct) / 100);
      
      return (
        <div className={`price-display single fallback ${className}`}>
          <div className="price-single">
            {formatter(finalPrice)}
          </div>
          {discountPct > 0 && (
            <div className="price-note">
              Giá tạm thời (chưa có lô hàng)
            </div>
          )}
        </div>
      );
    }
    
    // Không có fallback → hiển thị "tạm hết hàng"
    if (showOutOfStock) {
      const displayText = error && error.includes('chưa có lô hàng') 
        ? 'Chưa có lô hàng' 
        : 'Tạm hết hàng';
      
      return (
        <div className={`price-display out-of-stock ${className}`}>
          <span className="out-of-stock-text">{displayText}</span>
        </div>
      );
    }
    return null;
  }

  if (priceRange.hasMultiplePrices) {
    return (
      <div className={`price-display range ${className}`}>
        <div className="price-range">
          {formatter(priceRange.min)} - {formatter(priceRange.max)}
        </div>
        <div className="price-note">
          Giá tùy theo lô hàng có sẵn
        </div>
      </div>
    );
  }

  return (
    <div className={`price-display single ${className}`}>
      <div className="price-single">
        {formatter(priceRange.min)}
      </div>
    </div>
  );
});

PriceDisplay.displayName = 'PriceDisplay';

export default PriceDisplay;