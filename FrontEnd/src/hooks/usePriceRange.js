import { useState, useEffect } from 'react';
import { getPriceRange } from '../component/redux/apiRequest';

export const usePriceRange = (productId) => {
  const [priceRange, setPriceRange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getPriceRange(productId)
      .then((data) => {
        console.log('📊 Price range response for product', productId, ':', data);
        // Backend trả về { minPrice, maxPrice, hasRange, availablePrices }
        if (data && (data.minPrice !== undefined || data.maxPrice !== undefined)) {
          const priceData = {
            min: data.minPrice || 0,
            max: data.maxPrice || 0,
            hasMultiplePrices: data.hasRange || false,
            availablePrices: data.availablePrices || []
          };
          console.log('✅ Formatted price range:', priceData);
          setPriceRange(priceData);
        } else {
          console.warn('⚠️ Unexpected response format, trying fallback');
          // Fallback for old format
          setPriceRange(data.priceRange || null);
        }
      })
      .catch((err) => {
        console.error('Error getting price range:', err);
        // Nếu không tìm thấy lô hàng, không phải là lỗi nghiêm trọng
        if (err.message.includes('Không tìm thấy lô hàng') || err.message.includes('Không có lô hàng')) {
          setError('Sản phẩm chưa có lô hàng nào');
        } else {
          setError(err.message);
        }
        setPriceRange(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [productId]);

  return { priceRange, loading, error };
};