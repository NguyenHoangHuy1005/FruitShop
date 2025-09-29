import Breadcrumb from "../theme/breadcrumb";
import { formatter } from "../../../utils/fomater";
import "./style.scss";
import { memo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { placeOrder } from "../../../component/redux/apiRequest";
import { useNavigate, useLocation } from "react-router-dom";

const CheckoutPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const selectedProductIds = location.state?.selectedProductIds || null;

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


    const coupon = location.state?.coupon?.code || cart?.coupon?.code || "";
    const discount = location.state?.coupon?.discount || cart?.coupon?.discount || 0;

    const [form, setForm] = useState({
        fullName: "",
        address: "",
        phone: "",
        email: "",
        note: "",
    });

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!(itemsToShow?.length > 0)) {
            alert("Chưa có sản phẩm nào để đặt hàng.");
            return;
        }
        await placeOrder(
            { ...form, couponCode: coupon, selectedProductIds },
            user?.accessToken,
            dispatch,
            navigate
        );
    };

    return (
        <>
        <Breadcrumb paths={[{ label: "Thanh toán" }]} />
        <div className="container">
            <form className="row" onSubmit={onSubmit}>
            <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12">
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
                    placeholder="Nhập ghi chú"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
                </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12">
                <div className="checkout__order">
                <h3>Đơn hàng</h3>
                <ul>
                    {(itemsToShow || []).map((it) => (
                        <li key={getId(it)}>
                        <span>{it.name}</span>
                        <b>{formatter(it.price)} ({it.quantity})</b>
                        </li>
                    ))}

                    {discount > 0 && (
                        <li className="checkout__order__discount">
                            <h4>Mã giảm giá: {coupon}</h4>
                            <b>-{formatter(discount)}</b>
                        </li>
                    )}

                    <li className="checkout__order__shipping">
                        <h4>Phí vận chuyển:</h4>
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
                        <h3>Tổng tiền:</h3>
                        <b>
                            {formatter(Math.max(0, subtotal + shipping - discount))}
                        </b>
                    </li>
                </ul>
                <button type="submit" className="button-submit">
                    Đặt hàng
                </button>
                </div>
            </div>
            </form>
        </div>
        </>
    );
};

export default memo(CheckoutPage);
