import { memo, useCallback, useMemo, useState } from "react";
import "./style.scss";
import { generatePath, Link } from "react-router-dom";
import { AiOutlineEye, AiOutlineShoppingCart } from "react-icons/ai";
import { ROUTERS } from "../../utils/router";
import { usePriceRange } from "../../hooks/usePriceRange";
import PriceDisplay from "../../component/PriceDisplay";
import { useDispatch } from "react-redux";
import { addToCart } from "../redux/apiRequest";

export const ProductCard = ({
    id,
    name = "",
    description = "",
    price = 0,
    category,
    image,
    status,
    discountPercent = 0,
    onHand = 0,
    unit = "sp",
}) => {
    const dispatch = useDispatch();
    const detailPath = id ? generatePath(ROUTERS.USER.PRODUCT, { id }) : null;

    const imgUrl = useMemo(() => {
        const first = Array.isArray(image) ? image[0] : image;
        return first || "/assets/images/placeholder-product.png";
    }, [image]);

    const { priceRange, loading: priceLoading, error: priceError } = usePriceRange(id);

    const derivedBatchSoldOut = !priceLoading && (
        (priceRange && priceRange.hasAvailableBatch === false) ||
        (!priceRange && priceError?.toLowerCase?.().includes("lô hàng"))
    );

    const isOut = Number(onHand || 0) <= 0 || derivedBatchSoldOut;
    const isExpired = status === "Hết hạn";
    const isExpiring = status === "Sắp hết hạn";
    const cannotBuy = isOut || isExpired;

    const [busy, setBusy] = useState(false);

    const handleAddToCart = useCallback(
        async (e) => {
            e?.preventDefault?.();
            if (!id || busy || cannotBuy) return;
            try {
                setBusy(true);
                await addToCart(id, 1, dispatch);
            } finally {
                setBusy(false);
            }
        },
        [id, busy, cannotBuy, dispatch]
    );

    return (
        <div className={`featured__item ${cannotBuy ? "is-out" : ""} ${isExpired ? "is-expired" : ""} ${isExpiring ? "is-expiring" : ""}`}>
            <div className="featured__item__pic">
                <img
                    src={imgUrl}
                    alt={name || "Sản phẩm"}
                    loading="lazy"
                    onError={(ev) => {
                        ev.currentTarget.src = "/assets/images/placeholder-product.png";
                    }}
                />

                {Number(discountPercent) > 0 && (
                    <span className="badge badge--discount">-{Math.floor(discountPercent)}%</span>
                )}

                {isExpired && <span className="badge badge--expired">Hết hạn</span>}
                {!isExpired && isExpiring && <span className="badge badge--expiring">Sắp hết hạn</span>}
                {!isExpired && !isExpiring && isOut && <span className="badge badge--soldout">Hết hàng</span>}

                <ul className="featured__item__pic__hover">
                    <li>
                        {detailPath ? (
                            <Link to={detailPath} aria-label="Xem chi tiết">
                                <AiOutlineEye />
                            </Link>
                        ) : (
                            <span className="icon-btn is-disabled" aria-hidden="true">
                                <AiOutlineEye />
                            </span>
                        )}
                    </li>
                    <li>
                        <button
                            type="button"
                            className={`icon-btn${cannotBuy ? " is-disabled" : ""}`}
                            aria-label={
                                isExpired ? "Sản phẩm đã hết hạn" :
                                    isOut ? "Sản phẩm đã hết hàng" :
                                        "Thêm vào giỏ hàng"
                            }
                            title={
                                isExpired ? "Sản phẩm đã hết hạn" :
                                    isOut ? "Sản phẩm đã hết hàng" :
                                        "Thêm vào giỏ hàng"
                            }
                            onClick={handleAddToCart}
                            disabled={busy || cannotBuy}
                            aria-disabled={busy || cannotBuy}
                        >
                            <AiOutlineShoppingCart />
                        </button>
                    </li>
                </ul>
            </div>

            <div className="featured__item__text">
                <h6>
                    {detailPath ? <Link to={detailPath}>{name}</Link> : <span>{name}</span>}
                </h6>

                <div className="price-section">
                    <PriceDisplay
                        productId={id}
                        className="product-card-price"
                        fallbackPrice={price}
                        fallbackDiscount={discountPercent}
                    />
                </div>
            </div>
        </div>
    );
};

export default memo(ProductCard);
