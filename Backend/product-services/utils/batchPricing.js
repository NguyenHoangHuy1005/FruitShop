const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, Math.round(num)));
};

const normalizeDate = (value) => {
  if (!value) return null;
  const d = (value instanceof Date) ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isDiscountWindowActive = (startDate, endDate, now = new Date()) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

/**
 * Determine which discount (batch-level or product-level) should be applied.
 * Returns metadata describing origin and effective percent.
 */
const resolveDiscount = (batch = {}, product = {}, now = new Date()) => {
  const batchPercent = clampPercent(batch.discountPercent);
  const batchActive = batchPercent > 0 && isDiscountWindowActive(batch.discountStartDate, batch.discountEndDate, now);

  if (batchActive) {
    return {
      percent: batchPercent,
      source: "batch",
      active: true,
      startDate: normalizeDate(batch.discountStartDate),
      endDate: normalizeDate(batch.discountEndDate),
    };
  }

  const productPercent = clampPercent(product.discountPercent);
  if (productPercent > 0) {
    const productActive = isDiscountWindowActive(product.discountStartDate, product.discountEndDate, now);
    if (productActive) {
      return {
        percent: productPercent,
        source: "product",
        active: true,
        startDate: normalizeDate(product.discountStartDate),
        endDate: normalizeDate(product.discountEndDate),
      };
    }
  }

  return {
    percent: 0,
    source: null,
    active: false,
    startDate: null,
    endDate: null,
  };
};

/**
 * Calculate base & final prices for a batch, factoring in discount metadata.
 */
const computeBatchPricing = (batch = {}, product = {}) => {
  const basePrice = Math.max(
    0,
    Number(
      batch.sellingPrice ??
      batch.unitPrice ??
      product.price ??
      0
    ) || 0
  );

  const discount = resolveDiscount(batch, product);
  const finalPrice = discount.percent > 0
    ? Math.max(0, Math.round(basePrice * (100 - discount.percent) / 100))
    : basePrice;

  return {
    basePrice,
    finalPrice,
    discountPercent: discount.percent,
    discountSource: discount.source,
    discountActive: discount.active,
    discountStartDate: discount.startDate,
    discountEndDate: discount.endDate,
  };
};

module.exports = {
  clampPercent,
  computeBatchPricing,
  resolveDiscount,
};
