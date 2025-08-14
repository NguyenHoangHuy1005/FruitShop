import Breadcrumb from '../theme/breadcrumb';
import { formatter } from "../../../utils/fomater";
import { ProductCard, Quantity } from "../../../component";
import prod0Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod0.jpg";
import { AiOutlineClose } from "react-icons/ai";


import "./style.scss";

import { memo } from 'react';

const checkoutPage = () => {
    return <>
        <Breadcrumb name="Thanh toán" />
        <div className="container">
            <div className="row">
                <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12">
                    <div className="checkout__input">
                        <label>
                            Họ và tên: <span className="required">*</span>
                        </label>
                        <input type="text" placeholder="Nhập họ và tên" />
                    </div>
                    <div className="checkout__input">
                        <label>
                            Địa chỉ: <span className="required">*</span>
                        </label>
                        <input type="text" placeholder="Nhập địa chỉ" />
                    </div>
                    <div className="checkout__input__group">
                        <div className="checkout__input">
                            <label>
                                Số điện thoại: <span className="required">*</span>
                            </label>
                            <input type="number" placeholder="Nhập số điện thoại" />
                        </div>
                        <div className="checkout__input">
                            <label>
                            Email: <span className="required">*</span>
                        </label>
                        <input type="email" placeholder="Nhập email" />
                        </div>
                    </div>
                    <div className="checkout__input">
                        <label>
                            Ghi chú:
                        </label>
                        <textarea rows={15} placeholder="Nhập ghi chú" />
                    </div>
                </div>

                <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12">
                    <div className="checkout__order">
                        <h3>Đơn hàng</h3>
                        <ul>
                            <li>
                                <span>Sản phẩm 1</span>
                                <b>{formatter(500000)}  (1)</b>
                            </li>
                            <li> 
                                <h4>Mã giảm giá</h4>
                                <b>FS999</b>
                            </li>
                            <li className="checkout__order__subtotal">
                                <h3>Tổng tiền:</h3> 
                                <b>{formatter(500000)}</b></li>
                        </ul>
                        <button type="button" className="button-submit">Đặt hàng</button>
                    </div>
                </div>
            </div>
        </div>
    </>
};

export default memo(checkoutPage);
