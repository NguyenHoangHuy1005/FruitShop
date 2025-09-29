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
import { ensureCart, updateCartItem, removeCartItem, validateCoupon } from "../../../component/redux/apiRequest";
import { setCoupon } from "../../../component/redux/cartSlice";


const ShoppingCart = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const cart = useSelector((s) => s.cart?.data);
    const user = useSelector((s) => s.auth?.login?.currentUser);
    const [couponCode, setCouponCode] = useState("");
    const [discount, setDiscount] = useState(0);
    
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
        setSelectedIds((prev) => {
        if (allSelected) return new Set();
        return new Set(allRowIds);
        });
    };

    // NEW: danh sách mục đã chọn + tổng tiền theo mục chọn
    const selectedItems = (cart?.items || []).filter((it) => selectedIds.has(getId(it)));
    const selectedSubtotal = selectedItems.reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0
    );
    const selectedTotalQty = selectedItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      // Shipping theo tổng đã chọn
    const SHIPPING_FEE = 30000;
    const shippingBySelection = selectedSubtotal >= 199000 ? 0 : SHIPPING_FEE;

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
        const res = await validateCoupon(couponCode, selectedSubtotal); // ✅ theo mục đã chọn
        if (res?.ok) {
            setDiscount(res.discount || 0);
            setCouponCode(res.code || couponCode);
            dispatch(setCoupon({ code: res.code || couponCode, discount: res.discount }));
            toast.success(res.message || "Áp dụng mã giảm giá thành công!");
        } else {
            setDiscount(0);
            dispatch(setCoupon(null));
            toast.error(res.message || "Mã giảm giá không hợp lệ.");
        }
        } catch (err) {
        setDiscount(0);
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

        navigate(ROUTERS.USER.CHECKOUT, {
            state: {
                coupon: { code: couponCode, discount },
                selectedProductIds, // ✅ truyền để trang Checkout chỉ hiển thị & tính tiền các mục này
            },
        });
    };

    





    return (
        <>
        <Breadcrumb paths={[{ label: "Giỏ hàng" }]} />
        <div className="container">
            <div className="table__cart">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 50 }}>
                                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                            </th>
                            <th>Tên</th>
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
                            const name   = it?.name || it?.product?.name || "Sản phẩm";

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
                                <td>
                                    {it.discountPercent > 0 ? (
                                        <div className="price-box">
                                        <span className="old-price">
                                            {formatter(Math.round((it.price * 100) / (100 - it.discountPercent)))}
                                        </span>
                                        <span className="new-price">{formatter(it.price)}</span>
                                        </div>
                                    ) : (
                                        <span>{formatter(it.price)}</span>
                                    )}
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
                                <td>{formatter(it.total ?? ((it.price || 0) * (it.quantity || 0)))}</td>
                                <td className="icons-close">
                                    <button
                                        className="link-btn"
                                        title="Xóa"
                                        onClick={() => removeCartItem(productId, dispatch)}
                                    >
                                        <AiOutlineClose />
                                    </button>
                                </td>
                            </tr>
                            );
                        }) : (
                            <tr><td colSpan={6}>Giỏ hàng trống</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="row">
                <div className="col-lg-6 col-md-12">
                    <div className="shopping__cont">
                        <h3>Mã giảm giá</h3>
                        <div className="shopping__discount">
                            <input
                                placeholder="Nhập mã giảm giá"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                            />
                            <button type="button" className="button-submit" onClick={applyCoupon}>
                                Áp dụng
                            </button>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6 col-md-12">
                    <div className="shopping__checkout">
                        <h2>Tổng đơn:</h2>
                        <ul>
                            <li>Số lượng: <span>{selectedTotalQty}</span></li>
                            <li>Thành tiền: <span>{formatter(selectedSubtotal)}</span></li>

                            {discount > 0 && (
                                <li className="checkout__order__discount">
                                    Giảm giá: <span>-{formatter(discount)}</span>
                                </li>
                            )}

                            <li>
                                Phí vận chuyển:{" "}
                                {selectedSubtotal >= 199000 ? (
                                    <div className="shipping-free">
                                    <span className="old">{formatter(SHIPPING_FEE)}</span>
                                    <span className="free-text">Miễn phí</span>
                                    </div>
                                ) : (
                                    <span className="shipping-fee">{formatter(SHIPPING_FEE)}</span>
                                )}
                            </li>

                            <li>
                                Tổng cộng:{" "}
                                <span>{formatter(Math.max(0, selectedSubtotal + shippingBySelection - discount))}</span>
                            </li>

                            <button type="button" className="button-submit" onClick={handleCheckout}>
                                Thanh toán
                            </button>

                            {/* Gợi ý nhỏ khi chưa chọn gì */}
                            {selectedItems.length === 0 && (
                                <li style={{ marginTop: 8, opacity: .7, fontStyle: "italic" }}>
                                    Hãy tick chọn sản phẩm để tính tổng & thanh toán.
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export default memo(ShoppingCart);
