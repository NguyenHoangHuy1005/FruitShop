import Breadcrumb from '../theme/breadcrumb';
import { formatter } from "../../../utils/fomater";
import { ProductCard, Quantity } from "../../../component";
import prod0Img from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/product/prod0.jpg";
import { AiOutlineClose } from "react-icons/ai";
import "./style.scss";
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTERS } from '../../../utils/router';

const shoppingCart = () => {
    const navigate = useNavigate();

    return <>
        <Breadcrumb name="Giỏ hàng" />
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
                        <tr>
                            <td className="shopping__cart__item">
                                <img src={prod0Img} alt="product-pic" />
                                <h4>Tên sản phẩm 1</h4>
                            </td>
                            <td>{formatter(200000)}</td>
                            <td><Quantity quantity="2" hasAddToCart={false} /> </td>
                            <td>{formatter(400000)}</td>
                            <td className="icons-close">
                                <AiOutlineClose />
                            </td>
                        </tr>
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
                            <li>Số lượng: <span>{2}</span></li>
                            <li>Thành tiền: <span>{formatter(400000)}</span></li>
                            <button type="button" className="button-submit" onClick={() =>navigate(ROUTERS.USER.CHECKOUT)}>
                                Thanh toán</button>
                    
                        </ul>
                    </div>  

                </div>
            </div>
        </div>
    </>
};

export default memo(shoppingCart);
