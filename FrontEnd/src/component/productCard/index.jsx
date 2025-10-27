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
    category,
    image,
    status,                 // "Còn hàng" | "Hết hàng" (BE) hoặc "out_of_stock"
    discountPercent = 0,    // từ BE (0..100)
    onHand = 0,             // ✅ THÊM: tồn kho
    unit = "sp",            // ✅ Đơn vị tính (kg, cái, bó, sp...)
}) => {
    const dispatch = useDispatch();
    const detailPath = id ? generatePath(ROUTERS.USER.PRODUCT, { id }) : null;

    const imgUrl = useMemo(() => {
        const first = Array.isArray(image) ? image[0] : image;
        return first || "/assets/images/placeholder-product.png";
    }, [image]);

    const finalPrice = useMemo(() => {
        const pct = Number.isFinite(+discountPercent) ? +discountPercent : 0;
        return Math.max(0, Math.round((Number(price) || 0) * (100 - pct) / 100));
    }, [price, discountPercent]);

    // ✅ Chuẩn hóa trạng thái hết hàng
    const isOut = Number(onHand || 0) <= 0;



    const [busy, setBusy] = useState(false);

    const handleAddToCart = useCallback(
        async (e) => {
        e?.preventDefault?.();
        if (!id || busy || isOut) return;
        try {
            setBusy(true);
            await addToCart(id, 1, dispatch);
        } finally {
            setBusy(false);
        }
        },
        [id, busy, isOut, dispatch]
    );

    return (
        <div className={`featured__item ${isOut ? "is-out" : ""}`}>
            <div className="featured__item__pic">
                <img
                src={imgUrl}
                alt={name || "Sản phẩm"}
                loading="lazy"
                onError={(ev) => {
                    ev.currentTarget.src = "/assets/images/placeholder-product.png";
                }}
                />

                {/* Huy hiệu giảm giá */}
                {Number(discountPercent) > 0 && (
                <span className="badge badge--discount">-{Math.floor(discountPercent)}%</span>
                )}

                {/* Huy hiệu hết hàng */}
                {isOut && <span className="badge badge--soldout">Hết hàng</span>}

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
                    aria-label={isOut ? "Sản phẩm đã hết hàng" : "Thêm vào giỏ hàng"}
                    title={isOut ? "Sản phẩm đã hết hàng" : "Thêm vào giỏ hàng"}
                    onClick={handleAddToCart}
                    disabled={busy || isOut}
                    aria-disabled={busy || isOut}
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

                {/* Giá */}
                {Number(discountPercent) > 0 ? (
                    <div className="price-wrap">
                    <del className="price-old">{formatter(price)}</del>
                    <div className="price-new">{formatter(finalPrice)}</div>
                    </div>
                ) : (
                    <h5>{formatter(price)}</h5>
                )}

                {/* ✅ Hiện tồn khi <= 10 */}
                {Number(onHand) > 0 && Number(onHand) <= 10 && (
                    <div className="stock-hint low">
                        Chỉ còn {Number(onHand)} {(unit || "").toLowerCase().trim() === "kg" ? "kg" : "sp"}
                    </div>
                )}
            </div>

        </div>
    );
};

export default memo(ProductCard);
