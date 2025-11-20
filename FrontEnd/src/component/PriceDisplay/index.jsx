import { memo, useMemo } from 'react';
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
  const computedRange = useMemo(() => {
    if (!priceRange || priceRange.hasAvailableBatch === false) return null;

    const {
      minFinal,
      maxFinal,
      minBase,
      maxBase,
      hasMultiplePrices,
    } = priceRange;

    const hasDiscount = minBase > minFinal;
    const useRange = hasMultiplePrices && maxFinal !== minFinal;

    return {
      hasDiscount,
      useRange,
      currentText: formatRange(minFinal, maxFinal),
      originalText: hasDiscount ? formatRange(minBase, maxBase) : null,
    };
  }, [priceRange]);

  const fallbackInfo = useMemo(() => {
    if (!(fallbackPrice && fallbackPrice > 0)) return null;

    const discountPct = Number(fallbackDiscount) || 0;
    const hasDiscount = discountPct > 0;
    const finalPrice = hasDiscount
      ? Math.max(0, Math.round(fallbackPrice * (100 - discountPct) / 100))
      : fallbackPrice;

    return {
      hasDiscount,
      currentText: formatter(finalPrice),
      originalText: hasDiscount ? formatter(fallbackPrice) : null,
    };
  }, [fallbackPrice, fallbackDiscount]);

  if (priceRange && priceRange.hasAvailableBatch === false) {
    return (
      <div className={['price-display', 'out-of-stock', className].filter(Boolean).join(' ')}>
        <span className="out-of-stock-text">Đã hết hàng</span>
      </div>
    );
  }

  if (loading && !computedRange) {
    if (!fallbackInfo) {
      if (!showLoading) return null;

      return (
        <div className={['price-display', 'loading', className].filter(Boolean).join(' ')}>
          <span className="loading-text">Đang tải giá...</span>
        </div>
      );
    }
  }

  if (computedRange) {
    const containerClass = [
      'price-display',
      computedRange.useRange ? 'range' : 'single',
      computedRange.hasDiscount ? 'has-discount' : '',
      className,
    ].filter(Boolean).join(' ');
    return (
      <div
        className={containerClass}
      >
        {computedRange.hasDiscount && computedRange.originalText && (
          <div className="price-original">{computedRange.originalText}</div>
        )}
        <div className="price-current">
          {computedRange.currentText}
        </div>
        {computedRange.useRange && (
          <div className="price-note">
            Giá tùy theo lô hàng còn
          </div>
        )}
      </div>
    );
  }

  if (fallbackInfo) {
    return (
      <div
        className={[
          'price-display',
          'single',
          'fallback',
          fallbackInfo.hasDiscount ? 'has-discount' : '',
          className,
        ].filter(Boolean).join(' ')}
      >
        {fallbackInfo.hasDiscount && fallbackInfo.originalText && (
          <div className="price-original">{fallbackInfo.originalText}</div>
        )}
        <div className="price-current">
          {fallbackInfo.currentText}
        </div>
        <div className="price-note">
          Giá tạm thời (chưa có lô hàng)
        </div>
      </div>
    );
  }

  if (showOutOfStock) {
    return (
      <div className={['price-display', 'out-of-stock', className].filter(Boolean).join(' ')}>
        <span className="out-of-stock-text">Đã hết hàng</span>
      </div>
    );
  }

  return null;
});

PriceDisplay.displayName = 'PriceDisplay';

export default PriceDisplay;
