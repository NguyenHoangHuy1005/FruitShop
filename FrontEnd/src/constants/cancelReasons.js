export const SHIPPER_CANCEL_REASONS = [
  { value: "customer_refused", label: "Khách không nhận hàng" },
  { value: "cannot_contact", label: "Không liên hệ được khách" },
  { value: "address_wrong", label: "Sai địa chỉ / không tìm thấy" },
  { value: "delay_request", label: "Quá thời gian nhận hàng" },
  { value: "other", label: "Lý do khác" },
];

export const USER_CANCEL_REASONS = [
  { value: "wrong_address", label: "Nhập sai địa chỉ nhận hàng" },
  { value: "change_coupon", label: "Thay đổi mã giảm giá" },
  { value: "change_mind", label: "Đổi ý mua hàng" },
  { value: "wrong_info", label: "Nhập sai thông tin" },
  { value: "change_payment", label: "Đổi phương thức thanh toán" },
  { value: "other", label: "Lý do khác" },
];

export const DEFAULT_SHIPPER_CANCEL_REASON_VALUE =
  SHIPPER_CANCEL_REASONS[0]?.value || "customer_refused";
export const DEFAULT_SHIPPER_CANCEL_REASON_TEXT =
  SHIPPER_CANCEL_REASONS[0]?.label || "Khách không nhận hàng";

export const DEFAULT_USER_CANCEL_REASON_VALUE =
  USER_CANCEL_REASONS[0]?.value || "wrong_address";
export const DEFAULT_USER_CANCEL_REASON_TEXT =
  USER_CANCEL_REASONS[0]?.label || "Nhập sai địa chỉ nhận hàng";

export const resolveCancelReasonText = (
  value,
  customReason = "",
  reasons = SHIPPER_CANCEL_REASONS
) => {
  if (value === "other") {
    return customReason.trim();
  }
  const source = Array.isArray(reasons) && reasons.length ? reasons : SHIPPER_CANCEL_REASONS;
  return source.find((reason) => reason.value === value)?.label || source[0]?.label || "";
};
