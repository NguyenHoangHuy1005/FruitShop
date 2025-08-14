import { memo } from "react";
import "./style.scss";
import { generatePath, Link } from 'react-router-dom';
import { AiOutlineEye, AiOutlineShoppingCart } from "react-icons/ai";
import { formatter } from "../../utils/fomater";
import { ROUTERS } from "../../utils/router";

const ProductCard = ({ img, name, price }) => {
    return <>
        <div className="featured__item pl-pr-5">
            <div className="featured__item__pic"
                style={{
                    backgroundImage: `url("${img}")`,
                }}
            >
                <ul className="featured__item__pic__hover">
                    <li>
                        <Link to={generatePath(ROUTERS.USER.PRODUCT, { id: 1 })}>
                            <AiOutlineEye />
                        </Link>
                    </li>
                    <li>
                        <AiOutlineShoppingCart />
                    </li>
                </ul>
            </div>
            <div className="featured__item__text">
                <h6>
                    <Link to={generatePath(ROUTERS.USER.PRODUCT, { id: 1 })}>{name}</Link>
                </h6>
                <h5>{formatter(price)}</h5>
            </div>
        </div>
    </>
}

export default memo(ProductCard);