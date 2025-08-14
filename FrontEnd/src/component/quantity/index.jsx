import { memo } from "react";
import "./style.scss";
import { generatePath, Link } from 'react-router-dom';
import { AiOutlineEye, AiOutlineShoppingCart } from "react-icons/ai";
import { formatter } from "../../utils/fomater";
import { ROUTERS } from "../../utils/router";

const quantity = ({ hasAddToCart = true }) => {
    return (
        <div className="quantity-container">
            <div className="quantity">
                <span className="qtybtn">-</span>
                <input type="number" defaultValue={1}/>
                <span className="qtybtn">+</span>
            </div>
            {hasAddToCart && (
                <button type="submit" className="button-submit">
                    Thêm vào giỏ hàng
                </button>
            )}
        </div>
    );
};

export default memo(quantity);