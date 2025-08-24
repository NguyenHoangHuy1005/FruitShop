import { memo, useState } from "react";
import "./style.scss";

const Quantity = ({ hasAddToCart = true, onAdd, defaultValue = 1, min = 1, max = 999 }) => {
    const [qty, setQty] = useState(Number(defaultValue) || 1);

    const dec = () => setQty((q) => Math.max(min, Number(q) - 1 || min));
    const inc = () => setQty((q) => Math.min(max, Number(q) + 1 || min + 1));
    const onChange = (e) => {
        const v = Number(e.target.value);
        if (Number.isNaN(v)) return;
        setQty(Math.min(max, Math.max(min, v)));
    };

    const handleAdd = () => {
        if (typeof onAdd === "function") onAdd(qty);
    };

    return (
        <div className="quantity-container">
        <div className="quantity">
            <span className="qtybtn" onClick={dec}>-</span>
            <input type="number" min={min} max={max} value={qty} onChange={onChange} />
            <span className="qtybtn" onClick={inc}>+</span>
        </div>

        {hasAddToCart && (
            <button type="button" className="button-submit" onClick={handleAdd}>
            Thêm vào giỏ hàng
            </button>
        )}
        </div>
    );
};

export default memo(Quantity);
