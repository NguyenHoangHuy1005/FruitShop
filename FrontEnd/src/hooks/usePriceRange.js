import { useState, useEffect } from 'react';
import { getPriceRange } from '../component/redux/apiRequest';

const normalizeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const CACHE_TTL_MS = 60 * 1000; // 1 minute stale window
const priceRangeCache = new Map(); // productId -> { data, timestamp }
const inflightRequests = new Map(); // productId -> Promise

const getCachedRange = (productId) => {
  const entry = priceRangeCache.get(productId);
  if (!entry) return undefined;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    priceRangeCache.delete(productId);
    return undefined;
  }

  return entry.data;
};

const setCachedRange = (productId, data) => {
  priceRangeCache.set(productId, { data, timestamp: Date.now() });
};

const parsePriceRangePayload = (data) => {
  if (data && (data.minPrice !== undefined || data.maxPrice !== undefined)) {
    const normalizedEntries = Array.isArray(data.priceEntries) ? data.priceEntries : [];
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

    const hasAvailableBatch = normalizedEntries.some(
      (entry) => Number(entry?.remainingQuantity || 0) > 0
    );

    return {
      minFinal,
      maxFinal,
      minBase,
      maxBase,
      hasMultiplePrices: Boolean(data.hasRange),
      priceEntries: normalizedEntries,
      availablePrices: data.availablePrices || [],
      hasDiscount: Boolean(
        data.hasDiscount ||
        (minBase > minFinal)
      ),
      hasAvailableBatch,
      isOutOfStock: !hasAvailableBatch,
    };
  }

  console.warn('Unexpected price range response, using fallback shape');
  return data?.priceRange || null;
};

const fetchPriceRange = (productId) => {
  if (inflightRequests.has(productId)) {
    return inflightRequests.get(productId);
  }

  const promise = getPriceRange(productId)
    .then(parsePriceRangePayload)
    .finally(() => {
      if (inflightRequests.get(productId) === promise) {
        inflightRequests.delete(productId);
      }
    });

  inflightRequests.set(productId, promise);
  return promise;
};

const resolvePriceRange = (productId) => {
  if (!productId) return Promise.resolve(null);
  return fetchPriceRange(productId)
    .then((data) => {
      setCachedRange(productId, data ?? null);
      return data ?? null;
    })
    .catch((err) => {
      if (!priceRangeCache.has(productId)) {
        setCachedRange(productId, null);
      }
      throw err;
    });
};

export const usePriceRange = (productId) => {
  const [priceRange, setPriceRange] = useState(null);
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const assignPriceRange = (value) => {
      setPriceRange((prev) => (prev === value ? prev : value));
    };

    if (!productId) {
      assignPriceRange(null);
      setError(null);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const cachedValue = getCachedRange(productId);
    if (cachedValue !== undefined) {
      assignPriceRange(cachedValue);
      setError(null);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    setError(null);

    resolvePriceRange(productId)
      .then((data) => {
        if (!isMounted) return;

        assignPriceRange(data ?? null);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;

        const message = err?.message || 'Không thể lấy giá';
        console.error('Error getting price range:', message);

        if (message.includes('Không tìm thấy lô hàng') || message.includes('Không có lô hàng')) {
          setError('Sản phẩm chưa có lô hàng nào');
        } else {
          setError(message);
        }

        assignPriceRange(null);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  return { priceRange, loading, error };
};

export const peekPriceRange = (productId) => getCachedRange(productId);

export const prefetchPriceRange = (productId) => {
  if (!productId) return Promise.resolve(null);

  const cached = getCachedRange(productId);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  return resolvePriceRange(productId).catch(() => null);
};
