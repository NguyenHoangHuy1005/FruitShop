import Breadcrumb from '../theme/breadcrumb';
import { Link } from "react-router-dom";
import { formatter } from "../../../utils/fomater";
import { AiOutlineClose } from "react-icons/ai";
import "./style.scss";
import { memo, useEffect, useRef } from 'react';
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';
import { ROUTERS } from '../../../utils/router';
import { useDispatch, useSelector } from "react-redux";
import { ensureCart, updateCartItem, removeCartItem } from "../../../component/redux/apiRequest";

const ShoppingCart = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const cart = useSelector((s) => s.cart?.data);
    const user = useSelector((s) => s.auth?.login?.currentUser);


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
    const handleCheckout = () => {
        if (!user) {
            toast.warning(" Bạn phải đăng nhập để thanh toán!", {
            position: "top-center",
            style: { background: "#ff4d4f", color: "#fff", fontWeight: "600" }, // custom style
            icon: "🔑",
            });
            navigate(ROUTERS.ADMIN?.LOGIN || "/admin/login");
            return;
        }
        navigate(ROUTERS.USER.CHECKOUT);
    };



    return (
        <>
        <Breadcrumb paths={[{ label: "Giỏ hàng" }]} />
        <div className="container">
            <div className="table__cart">
            <table>
                <thead>
                <tr>
                    <th>Tên</th>
                    <th>Giá</th>
                    <th>Số lượng</th>
                    <th>Thành tiền</th>
                    <th />
                </tr>
                </thead>
                <tbody>
                {cart?.items?.length ? cart.items.map((it) => {
                    const productId = typeof it.product === "object" && it.product
                    ? (it.product._id || it.product.id || String(it.product))
                    : String(it.product);

                    const imgSrc = Array.isArray(it.image) ? (it.image[0] || "") : (it.image || "");
                    const name   = it?.name || it?.product?.name || "Sản phẩm";

                    return (
                    <tr key={productId}>
                        <td className="shopping__cart__item">
                            <Link to={`/product/detail/${productId}`} className="item-name">
                                <img src={imgSrc || "/placeholder.png"} alt={name} />
                                <span className="item-name">{name}</span>
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
                    <tr><td colSpan={5}>Giỏ hàng trống</td></tr>
                )}
                </tbody>
            </table>
            </div>

            <div className="row">
            <div className="col-lg-6 col-md-12">
                <div className="shopping__cont">
                <h3>Mã giảm giá</h3>
                <div className="shopping__discount">
                    <input placeholder="Nhập mã giảm giá" />
                    <button type="button" className="button-submit">Áp dụng</button>
                </div>
                </div>
            </div>

            <div className="col-lg-6 col-md-12">
                <div className="shopping__checkout">
                <h2>Tổng đơn:</h2>
                <ul>
                    <li>Số lượng: <span>{cart?.summary?.totalItems || 0}</span></li>
                    <li>Thành tiền: <span>{formatter(cart?.summary?.subtotal || 0)}</span></li>
                    <button
                    type="button"
                    className="button-submit"
                    onClick={handleCheckout}
                    >
                    Thanh toán
                    </button>
                </ul>
                </div>
            </div>
            </div>
        </div>
        </>
    );
};

export default memo(ShoppingCart);
