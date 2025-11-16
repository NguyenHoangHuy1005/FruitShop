import { memo } from 'react';
import { formatter } from '../../utils/fomater';
import { usePriceRange } from '../../hooks/usePriceRange';
import './PriceDisplay.scss';

const formatRange = (min, max) => {
  if (min === max) return formatter(min);
  return `${formatter(min)} - ${formatter(max)}`;
};

const PriceDisplay = memo(({
  productId,
  className = '',
  showLoading = true,
  showOutOfStock = true,
  fallbackPrice = null,
  fallbackDiscount = 0,
}) => {
  const { priceRange, loading, error } = usePriceRange(productId);

  if (loading && !priceRange) {
    if (!(fallbackPrice && fallbackPrice > 0)) {
      if (!showLoading) return null;

      return (
        <div className={['price-display', 'loading', className].filter(Boolean).join(' ')}>
          <span className="loading-text">Đang tải giá...</span>
        </div>
      );
    }
  }

  if (priceRange) {
    const {
      minFinal,
      maxFinal,
      minBase,
      maxBase,
      hasMultiplePrices,
    } = priceRange;

    const hasDiscount = minBase > minFinal;
    const useRange = hasMultiplePrices && maxFinal !== minFinal;

    return (
      <div
        className={[
          'price-display',
          useRange ? 'range' : 'single',
          hasDiscount ? 'has-discount' : '',
          className,
        ].filter(Boolean).join(' ')}
      >
        {hasDiscount && (
          <div className="price-original">
            {formatRange(minBase, maxBase)}
          </div>
        )}
        <div className="price-current">
          {formatRange(minFinal, maxFinal)}
        </div>
        {useRange && (
          <div className="price-note">
            Giá tùy theo lô hàng còn
          </div>
        )}
      </div>
    );
  }

  if (fallbackPrice && fallbackPrice > 0) {
    const discountPct = Number(fallbackDiscount) || 0;
    const hasDiscount = discountPct > 0;
    const finalPrice = hasDiscount
      ? Math.max(0, Math.round(fallbackPrice * (100 - discountPct) / 100))
      : fallbackPrice;

    return (
      <div
        className={[
          'price-display',
          'single',
          'fallback',
          hasDiscount ? 'has-discount' : '',
          className,
        ].filter(Boolean).join(' ')}
      >
        {hasDiscount && (
          <div className="price-original">
            {formatter(fallbackPrice)}
          </div>
        )}
        <div className="price-current">
          {formatter(finalPrice)}
        </div>
        <div className="price-note">
          Giá tạm thời (chưa có lô hàng)
        </div>
      </div>
    );
  }

  if (showOutOfStock) {
    const displayText = error?.includes('lô hàng')
      ? 'Chưa có lô hàng'
      : 'Tạm hết hàng';

    return (
      <div className={['price-display', 'out-of-stock', className].filter(Boolean).join(' ')}>
        <span className="out-of-stock-text">{displayText}</span>
      </div>
    );
  }

  return null;
});

PriceDisplay.displayName = 'PriceDisplay';

export default PriceDisplay;
