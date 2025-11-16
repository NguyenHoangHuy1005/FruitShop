import { useState, useEffect } from 'react';
import { getPriceRange } from '../component/redux/apiRequest';

const normalizeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const usePriceRange = (productId) => {
  const [priceRange, setPriceRange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      setPriceRange(null);
      return;
    }

    setLoading(true);
    setError(null);

    getPriceRange(productId)
      .then((data) => {
        if (data && (data.minPrice !== undefined || data.maxPrice !== undefined)) {
          const minFinal = normalizeNumber(data.minPrice);
          const maxFinal = normalizeNumber(
            data.maxPrice !== undefined ? data.maxPrice : data.minPrice,
            minFinal
          );
          const minBase = normalizeNumber(
            data.minBasePrice !== undefined ? data.minBasePrice : data.minPrice,
            minFinal
          );
          const maxBase = normalizeNumber(
            data.maxBasePrice !== undefined ? data.maxBasePrice : data.maxPrice,
            maxFinal
          );

          setPriceRange({
            minFinal,
            maxFinal,
            minBase,
            maxBase,
            hasMultiplePrices: Boolean(data.hasRange),
            priceEntries: Array.isArray(data.priceEntries) ? data.priceEntries : [],
            availablePrices: data.availablePrices || [],
            hasDiscount: Boolean(
              data.hasDiscount ||
              (minBase > minFinal)
            ),
          });
        } else {
          console.warn('Unexpected price range response, using fallback shape');
          setPriceRange(data?.priceRange || null);
        }
      })
      .catch((err) => {
        const message = err?.message || 'Không thể lấy giá';
        console.error('Error getting price range:', message);

        if (message.includes('Không tìm thấy lô hàng') || message.includes('Không có lô hàng')) {
          setError('Sản phẩm chưa có lô hàng nào');
        } else {
          setError(message);
        }

        setPriceRange(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [productId]);

  return { priceRange, loading, error };
};
