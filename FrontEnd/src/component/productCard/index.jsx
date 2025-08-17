import { memo } from "react";
import "./style.scss";
import { generatePath, Link } from "react-router-dom";
import { AiOutlineEye, AiOutlineShoppingCart } from "react-icons/ai";
import { formatter } from "../../utils/fomater";
import { ROUTERS } from "../../utils/router";

export const ProductCard = ({ id, name, description, price, category, image, status }) => {
    // Nếu có id thì tạo path, không thì null
    const detailPath = id ? generatePath(ROUTERS.USER.PRODUCT, { id }) : null;

    return (
        <div className="featured__item pl-pr-5">
            <div
                className="featured__item__pic"
                style={{
                    backgroundImage: `url("${image}")`,
                }}
            >
                <ul className="featured__item__pic__hover">
                    <li>
                        {detailPath ? (
                            <Link to={detailPath}>
                                <AiOutlineEye />
                            </Link>
                        ) : (
                            <span>
                                <AiOutlineEye />
                            </span>
                        )}
                    </li>
                    <li>
                        <AiOutlineShoppingCart />
                    </li>
                </ul>
            </div>
            <div className="featured__item__text">
                <h6>
                    {detailPath ? (
                        <Link to={detailPath}>{name}</Link>
                    ) : (
                        <span>{name}</span>
                    )}
                </h6>
                <h5>{formatter(price)}</h5>
            </div>
        </div>
    );
};

export default memo(ProductCard);
