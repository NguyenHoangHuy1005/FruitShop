import Breadcrumb from '../theme/breadcrumb';
import { Link } from "react-router-dom";
import { formatter } from "../../../utils/fomater";
import { AiOutlineClose } from "react-icons/ai";
import "./style.scss";
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';
import { ROUTERS } from '../../../utils/router';
import { useDispatch, useSelector } from "react-redux";
import { ensureCart, updateCartItem, removeCartItem, validateCoupon, getMyReservation, releaseReservation } from "../../../component/redux/apiRequest";
import { setCoupon } from "../../../component/redux/cartSlice";


const ShoppingCart = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const cart = useSelector((s) => s.cart?.data);
    const user = useSelector((s) => s.auth?.login?.currentUser);
    const [couponCode, setCouponCode] = useState("");
    const [discount, setDiscount] = useState(0);

    const FREE_SHIPPING_THRESHOLD = 199000;
    //test thanh toán nên đưa về 0
    const SHIPPING_FEE = 0; //30k
    // NEW: quản lý chọn sp
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Mặc định chọn tất cả
    // useEffect(() => {
    //     const ids = (cart?.items || []).map(getId);
    //     setSelectedIds(new Set(ids));
    // }, [cart?.items]);

    const getId = (it) => {
        if (typeof it.product === "object" && it.product) {
            return String(it.product._id || it.product.id || it.product);
        }
        return String(it.product);
    };

    const toggleOne = (id) => {
        setSelectedIds((prev) => {
            const s = new Set(prev);
            if (s.has(id)) s.delete(id);
            else s.add(id);
            return s;
        });
    };

    const allRowIds = (cart?.items || []).map(getId);
    const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedIds.has(id));
    const toggleAll = () => {
        setSelectedIds(() => {
            if (allSelected) return new Set();
            return new Set(allRowIds);
        });
    };

    useEffect(() => {
        const currentIds = new Set((cart?.items || []).map(getId));
        setSelectedIds((prev) => {
            const next = new Set();
            let changed = false;

            prev.forEach((id) => {
                if (currentIds.has(id)) {
                    next.add(id);
                } else {
                    changed = true;
                }
            });

            if (!changed && prev.size === next.size) {
                return prev;
            }

            return next;
        });
    }, [cart?.items]);

    // NEW: danh sách mục đã chọn + tổng tiền theo mục chọn
    const selectedItems = (cart?.items || []).filter((it) => selectedIds.has(getId(it)));
    const selectedSubtotal = selectedItems.reduce(
        (sum, it) => {
            // Sử dụng lockedPrice nếu có, nếu không dùng price
            const basePrice = Number(it.lockedPrice) || Number(it.price) || 0;
            // Áp dụng discount từ item nếu có
            const discountPct = Number(it.discountPercent) || 0;
            const finalPrice = discountPct > 0
                ? Math.round(basePrice * (100 - discountPct) / 100)
                : basePrice;
            return sum + finalPrice * (Number(it.quantity) || 0);
        }, 0
    );
    const selectedTotalQty = selectedItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    // Shipping theo tổng đã chọn
    const shippingBySelection = selectedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const freeShipPercent = Math.round(Math.min(1, selectedSubtotal / FREE_SHIPPING_THRESHOLD) * 100);
    const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - selectedSubtotal);
    const grandTotal = Math.max(0, selectedSubtotal + shippingBySelection - discount);

    // Debounce timers theo từng productId
    const timersRef = useRef({});

    useEffect(() => { ensureCart(dispatch); }, [dispatch]);

    const handleQtyChange = (productId, raw) => {
        const q = Math.max(0, parseInt(raw, 10) || 0);

        // // Nếu nhập 0 -> hỏi trước khi xoá
        // if (q === 0) {
        // const ok = window.confirm("Số lượng = 0 sẽ xoá sản phẩm khỏi giỏ. Tiếp tục?");
        // if (!ok) return; // không gọi API
        // }

        // Debounce 300ms
        if (timersRef.current[productId]) clearTimeout(timersRef.current[productId]);
        timersRef.current[productId] = setTimeout(() => {
            updateCartItem(productId, q, dispatch);
        }, 300);
    };

    const applyCoupon = async () => {
        try {
            if (!couponCode.trim()) {
                toast.warn("Vui lòng nhập mã giảm giá.");
                return;
            }
            if (selectedItems.length === 0) {
                toast.warn("Hãy chọn sản phẩm trước khi áp mã.");
                return;
            }

            // 🔥 Gửi cartItems để backend kiểm tra sản phẩm áp dụng
            const cartItems = selectedItems.map(item => ({
                productId: getId(item),
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0
            }));

            const res = await validateCoupon(couponCode, selectedSubtotal, cartItems);

            if (res?.ok) {
                setDiscount(res.discount || 0);
                setCouponCode(res.code || couponCode);
                dispatch(setCoupon({ code: res.code || couponCode, discount: res.discount }));

                // 🔥 Hiển thị thông tin chi tiết về coupon
                let message = res.message || "Áp dụng mã giảm giá thành công!";
                if (res.applicableProductCount !== undefined && res.applicableProductCount < selectedItems.length) {
                    message += ` (Áp dụng cho ${res.applicableProductCount}/${selectedItems.length} sản phẩm)`;
                }
                toast.success(message);
            } else {
                setDiscount(0);
                dispatch(setCoupon(null));
                toast.error(res.message || "Mã giảm giá không hợp lệ.");
            }
        } catch (err) {
            setDiscount(0);
            dispatch(setCoupon(null));
            toast.error(err.message || "Không thể áp dụng mã giảm giá.");
        }
    };

    const handleCheckout = () => {
        if (!user) {
            toast.warning(" Bạn phải đăng nhập để thanh toán!", {
                position: "top-center",
                style: { background: "#ff4d4f", color: "#fff", fontWeight: "600" },
                icon: "🔑",
            });
            navigate(ROUTERS.ADMIN?.LOGIN || "/admin/login");
            return;
        }

        if (selectedItems.length === 0) {
            toast.warn("Chưa chọn sản phẩm để thanh toán.");
            return;
        }

        const selectedProductIds = selectedItems.map(getId);

        // 🔥 Truyền coupon đã áp dụng sang CheckoutPage
        navigate(ROUTERS.USER.CHECKOUT, {
            state: {
                coupon: couponCode && discount > 0 ? { code: couponCode, discount } : null,
                selectedProductIds,
            },
        });
    };







    return (
        <>
            <Breadcrumb paths={[{ label: "Giỏ hàng" }]} />
            <div className="container cart-page">
                <div className="cart__intro">
                    <div>
                        <h1>Giỏ hàng của bạn</h1>
                        <p>
                            {cart?.items?.length
                                ? `Bạn đang có ${cart.items.length} sản phẩm trong giỏ. Hãy chọn những món muốn thanh toán nhé!`
                                : "Giỏ hàng đang trống, khám phá thêm sản phẩm để lấp đầy giỏ nào!"}
                        </p>
                    </div>

                    {cart?.items?.length > 0 && (
                        <div className="cart__intro-meta">
                            <span className="cart__intro-qty">{selectedTotalQty}</span>
                            <span>Sản phẩm đã chọn</span>
                        </div>
                    )}
                </div>

                <div className="table__cart">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>
                                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                                </th>
                                <th>Tên</th>
                                <th>Đơn vị</th>
                                <th>Giá</th>
                                <th>Số lượng</th>
                                <th>Thành tiền</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {cart?.items?.length ? cart.items.map((it) => {
                                const productId = getId(it);
                                const imgSrc = Array.isArray(it.image) ? (it.image[0] || "") : (it.image || "");
                                const name = it?.name || it?.product?.name || "Sản phẩm";

                                return (
                                    <tr key={productId}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(productId)}
                                                onChange={() => toggleOne(productId)}
                                            />
                                        </td>
                                        <td className="shopping__cart__item">
                                            <Link to={`/product/detail/${productId}`} className="item-name">
                                                <img src={imgSrc || "/placeholder.png"} alt={name} />
                                                <span className="item-name__text">{name}</span>
                                            </Link>
                                        </td>
                                        <td>{it.unit || "kg"}</td>
                                        <td>
                                            {(() => {
                                                const lockedPrice = Number(it.lockedPrice) || Number(it.price) || 0;
                                                const discountPct = Number(it.discountPercent) || 0;

                                                if (discountPct > 0) {
                                                    const originalPrice = Math.round(lockedPrice); // giá gốc (hiện tại stored)
                                                    const finalPrice = Math.round(lockedPrice * (100 - discountPct) / 100); // giá sau giảm

                                                    return (
                                                        <div className="price-box">
                                                            <span className="old-price">{formatter(originalPrice)}</span>
                                                            <span className="new-price">{formatter(finalPrice)}</span>
                                                            <span className="discount-tag">-{discountPct}%</span>
                                                        </div>
                                                    );
                                                }

                                                return <span>{formatter(lockedPrice)}</span>;
                                            })()}

                                        </td>

                                        <td style={{ minWidth: 140 }}>
                                            <input
                                                type="number"
                                                min={0}             // 0 = xoá (khớp BE)
                                                step={1}
                                                value={it.quantity} // controlled
                                                onChange={(e) => handleQtyChange(productId, e.target.value)}
                                                style={{ width: 80 }}
                                            />
                                        </td>
                                        <td>
                                            {(() => {
                                                const lockedPrice = Number(it.lockedPrice) || Number(it.price) || 0;
                                                const discountPct = Number(it.discountPercent) || 0;
                                                const finalPrice = discountPct > 0
                                                    ? Math.round(lockedPrice * (100 - discountPct) / 100)
                                                    : lockedPrice;
                                                const total = finalPrice * (Number(it.quantity) || 0);
                                                return formatter(total);
                                            })()}
                                        </td>
                                        <td className="icons-close">
                                            <button
                                                className="link-btn"
                                                title="Xóa"
                                                onClick={async () => {
                                                    // Release reservation trước khi xóa
                                                    if (it.reservationId) {
                                                        try {
                                                            await releaseReservation(it.reservationId);
                                                        } catch (error) {
                                                            console.error('Failed to release reservation:', error);
                                                        }
                                                    }
                                                    removeCartItem(productId, dispatch);
                                                }}
                                            >
                                                <AiOutlineClose />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="cart__empty">
                                            <span>Giỏ hàng trống.</span>
                                            <Link to={ROUTERS.USER?.PRODUCTS || "/products"}>Tiếp tục mua sắm</Link>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="cart__panels">
                    <div className="cart__panel">
                        <div className="cart__panel-head">
                            <h3>Ưu đãi & mã giảm giá</h3>
                            <p>Nhập mã khuyến mãi để tiết kiệm hơn cho đơn hàng của bạn.</p>
                        </div>
                        <div className="cart__discount">
                            <div className="cart__discount-input">
                                <input
                                    placeholder="Nhập mã giảm giá"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value)}
                                />
                                <button type="button" onClick={applyCoupon}>
                                    Áp dụng
                                </button>
                            </div>
                            {discount > 0 && (
                                <div className="cart__discount-badge">
                                    <span>Mã áp dụng:</span>
                                    <strong>{couponCode}</strong>
                                    <span>-{formatter(discount)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="cart__panel cart__panel--summary">
                        <div className="cart__panel-head">
                            <h3>Tổng quan đơn hàng</h3>
                            <p>Kiểm tra lại các khoản trước khi tiến hành thanh toán.</p>
                        </div>

                        <div className="cart__summary">
                            <div className="cart__progress">
                                <div className="cart__progress-bar">
                                    <span
                                        className="cart__progress-fill"
                                        style={{ width: `${freeShipPercent}%` }}
                                    />
                                </div>
                                <div className="cart__progress-text">
                                    {selectedSubtotal >= FREE_SHIPPING_THRESHOLD ? (
                                        <strong>Chúc mừng! Bạn đã đủ điều kiện miễn phí vận chuyển 🎉</strong>
                                    ) : (
                                        <span>
                                            Mua thêm {formatter(remainingForFreeShip)} để được miễn phí giao hàng.
                                        </span>
                                    )}
                                </div>
                            </div>

                            <ul className="cart__breakdown">
                                <li>
                                    <span>Số lượng đã chọn</span>
                                    <strong>{selectedTotalQty}</strong>
                                </li>
                                <li>
                                    <span>Tạm tính</span>
                                    <strong>{formatter(selectedSubtotal)}</strong>
                                </li>
                                {discount > 0 && (
                                    <li className="is-discount">
                                        <span>Giảm giá</span>
                                        <strong>-{formatter(discount)}</strong>
                                    </li>
                                )}
                                <li>
                                    <span>Phí vận chuyển</span>
                                    {selectedSubtotal >= FREE_SHIPPING_THRESHOLD ? (
                                        <div className="shipping-free">
                                            <span className="old">{formatter(SHIPPING_FEE)}</span>
                                            <span className="free-text">Miễn phí</span>
                                        </div>
                                    ) : (
                                        <strong className="shipping-fee">{formatter(SHIPPING_FEE)}</strong>
                                    )}
                                </li>
                            </ul>

                            <div className="cart__total">
                                <span>Tổng cộng</span>
                                <strong>{formatter(grandTotal)}</strong>
                            </div>

                            <button
                                type="button"
                                className="cart__checkout-btn"
                                onClick={handleCheckout}
                                disabled={selectedItems.length === 0}
                            >
                                Thanh toán ngay
                            </button>

                            {selectedItems.length === 0 && (
                                <p className="cart__hint">Hãy tick chọn sản phẩm để tính tổng & thanh toán.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default memo(ShoppingCart);
