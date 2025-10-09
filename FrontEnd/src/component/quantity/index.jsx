import { memo, useState } from "react";
import "./style.scss";

const Quantity = ({
    hasAddToCart = true,
    onAdd,
    onBuyNow,
    defaultValue = 1,
    min = 1,
    max = 999,
    disabled = false,
}) => {
    const [qty, setQty] = useState(Number(defaultValue) || 1);

    const dec = () => {
        if (disabled) return;
        setQty((q) => Math.max(min, Number(q) - 1 || min));
    };
    const inc = () => {
        if (disabled) return;
        setQty((q) => Math.min(max, Number(q) + 1 || min + 1));
    };
    const onChange = (e) => {
        const v = Number(e.target.value);
        if (Number.isNaN(v)) return;
        setQty(Math.min(max, Math.max(min, v)));
    };

    const handleAdd = () => {
        if (disabled) return;
        if (typeof onAdd === "function") onAdd(qty);
    };

    const handleBuyNow = () => {
        if (disabled) return;
        if (typeof onBuyNow === "function") onBuyNow(qty);
    };

    const showBuyNow = typeof onBuyNow === "function";

    return (
        <div className="quantity-container">
            <div className={`quantity${disabled ? " is-disabled" : ""}`}>
                <span className="qtybtn" onClick={dec} aria-hidden>
                    -
                </span>
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={qty}
                    onChange={onChange}
                    disabled={disabled}
                />
                <span className="qtybtn" onClick={inc} aria-hidden>
                    +
                </span>
            </div>

            {hasAddToCart && (
                <div className={`quantity-actions${showBuyNow ? "" : " quantity-actions--single"}`}>
                    <button
                        type="button"
                        className="button-submit"
                        onClick={handleAdd}
                        disabled={disabled}
                    >
                        Thêm vào giỏ hàng
                    </button>
                    {showBuyNow && (
                        <button
                            type="button"
                            className="button-buy-now"
                            onClick={handleBuyNow}
                            disabled={disabled}
                        >
                            Mua ngay
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default memo(Quantity);
