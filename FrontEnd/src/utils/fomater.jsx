// src/utils/formater.jsx

export const formatter = (number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(number);
};

// Format price range cho sản phẩm có nhiều lô
export const formatPriceRange = (priceRange) => {
  if (!priceRange) return 'Tạm hết hàng';
  
  if (priceRange.hasMultiplePrices) {
    return `${formatter(priceRange.min)} - ${formatter(priceRange.max)}`;
  } else {
    return formatter(priceRange.min);
  }
};
