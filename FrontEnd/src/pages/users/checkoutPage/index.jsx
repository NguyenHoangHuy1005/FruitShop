import Breadcrumb from "../theme/breadcrumb";
import { formatter } from "../../../utils/fomater";
import "./style.scss";
import { memo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { placeOrder } from "../../../component/redux/apiRequest";
import { useNavigate } from "react-router-dom";

const CheckoutPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const cart = useSelector((s) => s.cart?.data);
    const user = useSelector((s) => s.auth?.login?.currentUser);

    const [form, setForm] = useState({
        fullName: "",
        address: "",
        phone: "",
        email: "",
        note: "",
    });

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!cart?.items?.length) {
        alert("Giỏ hàng trống!");
        return;
        }
        await placeOrder(form, user?.accessToken, dispatch, navigate);
    };

    return (
        <>
        <Breadcrumb name="Thanh toán" />
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
                    {(cart?.items || []).map((it) => (
                    <li key={it.product}>
                        <span>{it.name}</span>
                        <b>{formatter(it.price)} ({it.quantity})</b>

                    </li>
                    ))}
                    <li>
                    <h4>Mã giảm giá</h4>
                    <b>FS999</b>
                    </li>
                    <li className="checkout__order__subtotal">
                    <h3>Tổng tiền:</h3>
                    <b>{formatter(cart?.summary?.subtotal || 0)}</b>
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
