import Breadcrumb from "../theme/breadcrumb";
import { formatter } from "../../../utils/fomater";
import "./style.scss";
import { memo, useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { placeOrder, validateCoupon } from "../../../component/redux/apiRequest";
import { useNavigate, useLocation } from "react-router-dom";
import { ROUTERS } from "../../../utils/router";
import { setCoupon } from "../../../component/redux/cartSlice";


const CheckoutPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const repeatOrder = location.state?.repeatOrder || null;
    const selectedProductIds = repeatOrder?.selectedProductIds || location.state?.selectedProductIds || null;

    const cart = useSelector((s) => s.cart?.data);
    const user = useSelector((s) => s.auth?.login?.currentUser);
    const getId = (it) =>
        typeof it.product === "object" && it.product
        ? String(it.product._id || it.product.id || it.product)
        : String(it.product);

    const itemsToShow = (cart?.items || []).filter(
        (it) => !selectedProductIds || selectedProductIds.includes(getId(it))
    );

    const subtotal = itemsToShow.reduce(
        (s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0
    );
    const SHIPPING_FEE = 30000;
    const shipping = subtotal >= 199000 ? 0 : SHIPPING_FEE;

    const derivedCoupon = repeatOrder?.coupon?.code || location.state?.coupon?.code || cart?.coupon?.code || "";
    const derivedDiscount = repeatOrder?.coupon?.discount || location.state?.coupon?.discount || cart?.coupon?.discount || 0;

    const repeatFormDefaults = useMemo(() => ({
        fullName: repeatOrder?.form?.fullName || "",
        address: repeatOrder?.form?.address || "",
        phone: repeatOrder?.form?.phone || "",
        email: repeatOrder?.form?.email || "",
        note: repeatOrder?.form?.note || "",
    }), [repeatOrder]);

    const [form, setForm] = useState(repeatFormDefaults);
    const [paymentMethod, setPaymentMethod] = useState(repeatOrder?.paymentMethod || "COD");
    const [couponCode, setCouponCode] = useState((derivedCoupon || ""));
    const [discountValue, setDiscountValue] = useState(Number(derivedDiscount) || 0);
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
    const [couponInsights, setCouponInsights] = useState([]);

    useEffect(() => {
        setForm(repeatFormDefaults);
        setPaymentMethod(repeatOrder?.paymentMethod || "COD");
    }, [repeatFormDefaults, repeatOrder]);

    useEffect(() => {
        const normalized = (derivedCoupon || "").trim();
        setCouponCode(normalized);
        setDiscountValue(Number(derivedDiscount) || 0);
    }, [derivedCoupon, derivedDiscount]);

    useEffect(() => {
        const normalized = (derivedCoupon || "").trim();
        if (!normalized || !(Number(derivedDiscount) > 0)) return;

        setCouponInsights((prev) => {
            const entry = {
                code: normalized,
                discount: Number(derivedDiscount) || 0,
                success: true,
                message: "Áp dụng sẵn từ giỏ hàng",
            };
            const existing = prev.find(
                (it) => it.code === entry.code && it.discount === entry.discount && it.success === entry.success
            );
            if (existing) return prev;

            const filtered = prev.filter((it) => it.code !== entry.code);
            const next = [entry, ...filtered];
            next.sort((a, b) => Number(b.discount || 0) - Number(a.discount || 0));
            return next.slice(0, 5);
        });
    }, [derivedCoupon, derivedDiscount]);

    const couponSuggestions = useMemo(() => {
        const pools = [
            repeatOrder?.availableCoupons,
            location.state?.availableCoupons,
            cart?.availableCoupons,
        ].filter(Boolean);

        if (!pools.length) return [];

        const merged = pools
            .flat()
            .filter(Boolean)
            .map((it) =>
                typeof it === "string"
                    ? { code: it, discount: 0 }
                    : {
                        code: (it.code || "").toString(),
                        discount: Number(it.discount) || 0,
                        note: it.note || it.description || "",
                    }
            );

        const unique = [];
        const seen = new Set();
        merged.forEach((entry) => {
            const code = (entry.code || "").toString();
            if (!code || seen.has(code)) return;
            seen.add(code);
            unique.push({ ...entry, code });
        });

        unique.sort((a, b) => Number(b.discount || 0) - Number(a.discount || 0));
        return unique;
    }, [repeatOrder, location.state, cart?.availableCoupons]);

    const handleApplyCoupon = async () => {
        const trimmed = (couponCode || "").trim();
        if (!trimmed) {
            toast.warn("Vui lòng nhập mã giảm giá.");
            return;
        }

        if (!(itemsToShow?.length > 0)) {
            toast.warn("Chưa có sản phẩm nào để áp dụng mã.");
            return;
        }

        setIsApplyingCoupon(true);
        try {
            const res = await validateCoupon(trimmed, subtotal);
            const normalized = (res?.code || trimmed);

            if (res?.ok) {
                setDiscountValue(Number(res.discount) || 0);
                setCouponCode(normalized);
                dispatch(setCoupon({ code: normalized, discount: res.discount }));
                toast.success(res?.message || "Áp dụng mã giảm giá thành công!");
            } else {
                setDiscountValue(0);
                setCouponCode(normalized);
                dispatch(setCoupon(null));
                toast.error(res?.message || "Mã giảm giá không hợp lệ.");
            }

            setCouponInsights((prev) => {
                const entry = {
                    code: normalized,
                    discount: Number(res?.discount) || 0,
                    success: !!res?.ok,
                    message: res?.message || (res?.ok ? "" : "Không phù hợp với đơn hiện tại"),
                };
                const filtered = prev.filter((it) => it.code !== entry.code);
                const next = [entry, ...filtered];
                next.sort((a, b) => Number(b.discount || 0) - Number(a.discount || 0));
                return next.slice(0, 5);
            });
        } catch (error) {
            toast.error(error?.message || "Không thể áp dụng mã giảm giá.");
        } finally {
            setIsApplyingCoupon(false);
        }
    };

    const paymentOptions = [
        {
            value: "COD",
            label: "Thanh toán khi nhận hàng (COD)",
            description: "Quý khách thanh toán trực tiếp cho shipper khi nhận hàng.",
            badge: "Phổ biến",
            extra: "Phù hợp khi bạn muốn kiểm tra sản phẩm trước khi thanh toán.",
        },
        {
            value: "BANK",
            label: "Chuyển khoản ngân hàng",
            description: "Đặt cọc online và hoàn tất trong 10 phút.",
            badge: "Tiết kiệm 5k",
            extra: "Ưu tiên xử lý nhanh, giữ đơn hàng trong vòng 10 phút kể từ khi tạo.",
        },
    ];

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!(itemsToShow?.length > 0)) {
            alert("Chưa có sản phẩm nào để đặt hàng.");
            return;
        }
        const result = await placeOrder(
            { ...form, couponCode: couponCode?.trim(), selectedProductIds, paymentMethod },
            user?.accessToken,
            dispatch
        );

        if (!result) return;

        if (result.requiresPayment && result.orderId) {
            const paymentPath = ROUTERS.USER.PAYMENT.replace(":id", result.orderId);
            navigate(paymentPath, { replace: true });
        } else {
            navigate(ROUTERS.USER.ORDERS, { replace: true });
        }
    };

    return (
        <>
        <Breadcrumb paths={[{ label: "Thanh toán" }]} />
        <div className="container">
            <form className="checkout__form row" onSubmit={onSubmit}>
                <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12">
                    <div className="checkout__panel checkout__panel--form">
                        <div className="checkout__panel__header">
                            <h2>Thông tin khách hàng</h2>
                            <p>Vui lòng cung cấp thông tin chính xác để thuận tiện cho việc giao hàng.</p>
                        </div>
                        <div className="checkout__input">
                            <label>
                                Họ và tên: <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Nhập họ và tên"
                                value={form.fullName}
                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="checkout__input">
                            <label>
                                Địa chỉ: <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Nhập địa chỉ"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                required
                            />
                        </div>
                        <div className="checkout__input__group">
                            <div className="checkout__input">
                                <label>
                                    Số điện thoại: <span className="required">*</span>
                                </label>
                                <input
                                    type="tel"
                                    placeholder="Nhập số điện thoại"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    required
                                />
                            </div>
                        <div className="checkout__input">
                                <label>
                                    Email: <span className="required">*</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="Nhập email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                />
                                </div>
                        </div>
                        <div className="checkout__input">
                            <label>Ghi chú:</label>
                            <textarea
                                rows={8}
                                placeholder="Yêu cầu giao hàng, thời gian mong muốn..."
                                value={form.note}
                                onChange={(e) => setForm({ ...form, note: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12">
                    <div className="checkout__panel checkout__panel--summary">
                        <div className="checkout__panel__header">
                            <h2>Đơn hàng</h2>
                            <span className="checkout__order__count">{itemsToShow.length} sản phẩm</span>
                        </div>
                        <div className="checkout__coupon">
                            <div className="checkout__coupon__intro">
                                <h4>Ưu đãi &amp; mã giảm giá</h4>
                                <p>Nhập mã của bạn hoặc so sánh các gợi ý để chọn ưu đãi tốt nhất.</p>
                            </div>
                            <div className="checkout__coupon__control">
                                <input
                                    placeholder="Nhập mã giảm giá"
                                    value={couponCode || ""}
                                    onChange={(e) => setCouponCode(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyCoupon}
                                    disabled={isApplyingCoupon}
                                >
                                    {isApplyingCoupon ? "Đang áp dụng..." : "Áp dụng"}
                                </button>
                            </div>
                            {(couponSuggestions.length > 0 || couponInsights.length > 0) && (
                                <div className="checkout__coupon__insights">
                                    {couponSuggestions.length > 0 && (
                                        <div className="checkout__coupon__tips">
                                            <span className="checkout__coupon__tips-title">Gợi ý phù hợp</span>
                                            <div className="checkout__coupon__tips-list">
                                                {couponSuggestions.slice(0, 3).map((suggestion) => (
                                                    <button
                                                        type="button"
                                                        key={suggestion.code}
                                                        onClick={() => setCouponCode((suggestion.code || ""))}
                                                    >
                                                        <span className="code">{suggestion.code}</span>
                                                        {suggestion.discount > 0 && (
                                                            <span className="save">Tiết kiệm {formatter(suggestion.discount)}</span>
                                                        )}
                                                        {suggestion.note && <small>{suggestion.note}</small>}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {couponInsights.length > 0 && (
                                        <div className="checkout__coupon__compare">
                                            <span className="checkout__coupon__tips-title">So sánh nhanh</span>
                                            <ul>
                                                {couponInsights.map((entry, index) => (
                                                    <li
                                                        key={entry.code}
                                                        className={`${entry.success ? "is-valid" : "is-invalid"} ${
                                                            index === 0 && entry.success ? "is-best" : ""
                                                        }`}
                                                    >
                                                        <div className="code">{entry.code}</div>
                                                        <div className="meta">
                                                            {entry.success ? (
                                                                <strong>Tiết kiệm {formatter(entry.discount)}</strong>
                                                            ) : (
                                                                <strong>Không phù hợp</strong>
                                                            )}
                                                            {entry.message && <small>{entry.message}</small>}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <ul className="checkout__order__items">
                            {(itemsToShow || []).map((it) => (
                                <li key={getId(it)}>
                                    <div>
                                        <span className="checkout__order__item-name">{it.name}</span>
                                        <span className="checkout__order__item-qty">x{it.quantity}</span>
                                    </div>
                                    <b>{formatter((Number(it.price) || 0) * (Number(it.quantity) || 0))}</b>
                                </li>
                            ))}

                            {discountValue > 0 && (
                                <li className="checkout__order__discount">
                                    <div>
                                        <h4>Mã giảm giá</h4>
                                        <span className="checkout__order__coupon">{couponCode}</span>
                                    </div>
                                    <b>-{formatter(discountValue)}</b>
                                </li>
                            )}

                            <li className="checkout__order__shipping">
                                <div>
                                    <h4>Phí vận chuyển</h4>
                                    <p>Miễn phí cho đơn từ 199.000đ</p>
                                </div>
                            {subtotal >= 199000 ? (
                                    <div className="shipping-free">
                                        <span className="old">{formatter(SHIPPING_FEE)}</span>
                                        <span className="free-text">Miễn phí</span>
                                    </div>
                                ) : (
                                    <b>{formatter(SHIPPING_FEE)}</b>
                                )}
                            </li>

                            <li className="checkout__order__subtotal">
                                <div>
                                    <h3>Tổng tiền</h3>
                                    <span className="checkout__order__summary-note">Đã bao gồm phí và ưu đãi</span>
                                </div>
                                <b>{formatter(Math.max(0, subtotal + shipping - discountValue))}</b>
                            </li>
                        </ul>
                        <div className="checkout__payment">
                            <h4>Phương thức thanh toán</h4>
                            <div className="checkout__payment__options">
                                {paymentOptions.map((opt) => {
                                    const isActive = paymentMethod === opt.value;
                                    return (
                                        <label
                                            key={opt.value}
                                            className={`payment-option ${isActive ? "active" : ""}`}
                                        >
                                            <span className="payment-option__indicator" aria-hidden="true" />
                                            <input
                                                type="radio"
                                                name="paymentMethod"
                                                value={opt.value}
                                                checked={isActive}
                                                onChange={() => setPaymentMethod(opt.value)}
                                            />
                                            <div className="payment-option__content">
                                                <div className="payment-option__heading">
                                                    <span className="payment-option__title">{opt.label}</span>
                                                    {opt.badge && <span className="payment-option__badge">{opt.badge}</span>}
                                                </div>
                                                <span className="payment-option__desc">{opt.description}</span>
                                                {isActive && opt.extra && (
                                                    <span className="payment-option__extra">{opt.extra}</span>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            <p className="checkout__payment__hint">
                                Thanh toán online cần hoàn tất trong vòng 10 phút, quá thời gian hệ thống sẽ tự hủy đơn.
                            </p>
                        </div>
                        <div className="checkout__actions">
                            <button type="submit" className="button-submit">
                                Đặt hàng
                            </button>
                            <span className="checkout__actions__secure">Thanh toán an toàn &amp; bảo mật</span>
                        </div>
                    </div>
                </div>
            </form>
        </div>
        </>
    );
};

export default memo(CheckoutPage);
