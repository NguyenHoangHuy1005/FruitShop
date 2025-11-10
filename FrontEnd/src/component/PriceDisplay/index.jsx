import { memo } from 'react';
import { formatter } from '../../utils/fomater';
import { usePriceRange } from '../../hooks/usePriceRange';
import './PriceDisplay.scss';

const PriceDisplay = memo(({ 
  productId, 
  className = "", 
  showLoading = true,
  showOutOfStock = true 
}) => {
  const { priceRange, loading, error } = usePriceRange(productId);

  if (loading && showLoading) {
    return (
      <div className={`price-display loading ${className}`}>
        <span className="loading-text">Đang tải giá...</span>
      </div>
    );
  }

  if (!priceRange) {
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