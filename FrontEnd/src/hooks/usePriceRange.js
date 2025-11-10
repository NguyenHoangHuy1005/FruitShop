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
        setPriceRange(data.priceRange);
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