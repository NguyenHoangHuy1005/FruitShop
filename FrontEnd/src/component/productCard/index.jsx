import { memo, useCallback, useMemo, useState } from "react";
import "./style.scss";
import { generatePath, Link } from "react-router-dom";
import { AiOutlineEye, AiOutlineShoppingCart } from "react-icons/ai";
import { formatter } from "../../utils/fomater";
import { ROUTERS } from "../../utils/router";
import { useDispatch } from "react-redux";
import { addToCart } from "../redux/apiRequest";

export const ProductCard = ({
    id,
    name = "",
    description = "",
    price = 0,
    discount = 0, // 👈 thêm
    category,
    image,
    status,
    discountPercent = 0,    // 👈 thêm
}) => {
    const dispatch = useDispatch();
    const detailPath = id ? generatePath(ROUTERS.USER.PRODUCT, { id }) : null;

    const imgUrl = useMemo(() => {
        const first = Array.isArray(image) ? image[0] : image;
        return first || "/assets/images/placeholder-product.png";
    }, [image]);

    const finalPrice = useMemo(() => {
        const pct = Number.isFinite(+discountPercent) ? +discountPercent : 0;
        return Math.max(0, Math.round(price * (100 - pct) / 100));
    }, [price, discountPercent]);

    const [busy, setBusy] = useState(false);

    const handleAddToCart = useCallback(
        async (e) => {
        e?.preventDefault?.();
        if (!id || busy || status === "out_of_stock") return;
        try {
            setBusy(true);
            await addToCart(id, 1, dispatch);
        } finally {
            setBusy(false);
        }
        },
        [id, busy, status, dispatch]
    );

    return (
        <div className="featured__item">
            <div className="featured__item__pic">
                <img
                src={imgUrl}
                alt={name || "Sản phẩm"}
                loading="lazy"
                onError={(ev) => {
                    ev.currentTarget.src = "/assets/images/placeholder-product.png";
                }}
                />

                {/* 🔥 Huy hiệu % giảm giá ở góc trái */}
                {Number(discountPercent) > 0 && (
                    <span className="badge badge--discount">-{Math.floor(discountPercent)}%</span>
                )}
                {status === "out_of_stock" && (
                    <span className="badge badge--soldout">Hết hàng</span>
                )}

                <ul className="featured__item__pic__hover">
                    <li>
                        {detailPath ? (
                        <Link to={detailPath} aria-label="Xem chi tiết">
                            <AiOutlineEye />
                        </Link>
                        ) : (
                        <span aria-hidden="true">
                            <AiOutlineEye />
                        </span>
                        )}
                    </li>
                    <li>
                        <button
                        type="button"
                        className="icon-btn"
                        aria-label="Thêm vào giỏ hàng"
                        title={
                            status === "out_of_stock"
                            ? "Sản phẩm đã hết hàng"
                            : "Thêm vào giỏ hàng"
                        }
                        onClick={handleAddToCart}
                        disabled={busy || status === "out_of_stock"}
                        >
                        <AiOutlineShoppingCart />
                        </button>
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

                {/* 🔥 Giá hiển thị: có gạch ngang khi giảm */}
                {Number(discountPercent) > 0 ? (
                    <div className="price-wrap">
                        <del className="price-old">{formatter(price)}</del>
                        <div className="price-new">{formatter(finalPrice)}</div>
                    </div>
                ) : (
                <h5>{formatter(price)}</h5>
                )}
            </div>
        </div>
    );
};

export default memo(ProductCard);
