import { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import "./style.scss";
import {
    AiOutlineEye,
    AiFillFacebook,
    AiOutlineCopy,
    AiFillTikTok,
} from "react-icons/ai";
import { formatter } from "../../../utils/fomater";
import { ProductCard } from "../../../component/productCard";
import Quantity from "../../../component/quantity";
import { addToCart } from "../../../component/redux/apiRequest"; // Redux action thêm giỏ hàng

const ProductDetail = () => {
    const dispatch = useDispatch();
    const { id } = useParams();

    const products = useSelector((s) => s.product.products?.allProducts || []);
    const product = products.find((p) => String(p._id) === String(id));

    // state viewCount phải fetch lại nếu không dữ liệu sẽ bị cũ vì không thêm vào apirequest
    // lượt mua lấy từ redux vì đã thêm vào hàm tạo order nên sẽ được cập nhật, dữ liệu luôn mới
    const [viewCount, setViewCount] = useState(product?.viewCount || 0);

    useEffect(() => {
        if (id) {
            fetch(`http://localhost:3000/api/product/${id}/views`, { method: "PUT" })
                .then((res) => res.json())
                .then((data) => {
                    if (data?.viewCount !== undefined) {
                        setViewCount(data.viewCount);
                    }
                })
                .catch((err) => console.error("Error updating view:", err));
        }
    }, [id]);

    if (!product) return <h2>Không tìm thấy sản phẩm</h2>;

    const pct = Number(product.discountPercent) || 0;
    const finalPrice = Math.max(
        0,
        Math.round(((Number(product.price) || 0) * (100 - pct)) / 100)
    );
    const mainImg = Array.isArray(product.image)
        ? product.image[0]
        : product.image;

    // ✅ trạng thái hết hàng
    const isOut = Number(product.onHand || 0) <= 0;

    const relatedProducts = products
        .filter((p) => p.category === product.category && p._id !== product._id)
        .slice(0, 8);

    return (
        <>
            <Breadcrumb
                paths={[
                    { label: "Danh sách sản phẩm", to: "/product" },
                    { label: "Chi tiết sản phẩm" },
                ]}
            />
            <div className="container">
                <div className="row">
                    {/* Hình ảnh sản phẩm */}
                    <div className="col-lg-6 product__detail__pic">
                        <div className="main">
                            {pct > 0 && <span className="discount-badge">-{pct}%</span>}
                            {isOut && <span className="soldout-badge">SOLD OUT</span>}
                            <img
                                src={mainImg || "/assets/images/placeholder-product.png"}
                                alt={product.name}
                            />
                        </div>
                    </div>

                    {/* Thông tin sản phẩm */}
                    <div className="col-lg-6 product__detail__text">
                        <h2>Chi tiết sản phẩm</h2>

                        {/* ✅ Lượt xem từ state */}
                        <div className="see-icon">
                            <AiOutlineEye /> {`${viewCount} (lượt xem)`}
                        </div>

                        {/* ✅ Lượt mua */}
                        <div className="buy-count">
                            Đã bán: <b>{product.purchaseCount || 0}</b>
                        </div>

                        <h2 className="product__name">{product.name}</h2>

                        {/* Giá */}
                        {pct > 0 ? (
                            <div className="price-wrap">
                                <del className="price-old">{formatter(product.price)}</del>
                                <div className="price-new">{formatter(finalPrice)}</div>
                            </div>
                        ) : (
                            <h3>{formatter(product.price)}</h3>
                        )}

                        {/* ✅ Chọn số lượng + thêm vào giỏ */}
                        <Quantity
                            hasAddToCart
                            disabled={isOut}
                            onAdd={(q) => {
                                if (isOut) {
                                    alert("Sản phẩm đã hết hàng.");
                                    return;
                                }
                                const qty = Math.max(1, Number(q) || 1);
                                if (qty > Number(product.onHand)) {
                                    alert("Số lượng sản phẩm không đủ. Vui lòng giảm số lượng!");
                                    return;
                                }

                                // Dispatch action Redux (thêm vào giỏ hàng)
                                addToCart(product._id, qty, dispatch);
                            }}
                        />

                        {/* Các option khác */}
                        <div className="product__options">
                            <p>Chọn kiểu:</p>
                            <div className="options">
                                <label className="option">
                                    <input type="radio" name="type" value="ki" defaultChecked />
                                    <span>Kí</span>
                                </label>
                                <label className="option">
                                    <input type="radio" name="type" value="hop" />
                                    <span>Hộp</span>
                                </label>
                            </div>
                        </div>

                        <ul>
                            <li>
                                <b>Tình trạng:</b>{" "}
                                <span className={isOut ? "out-stock" : "in-stock"}>
                                    {isOut ? "Hết hàng" : "Còn hàng"}
                                </span>
                                {!isOut && (
                                    <span
                                        className={`stock-inline ${Number(product.onHand) <= 10 ? "low-stock" : "high-stock"
                                            }`}
                                    >
                                        (Còn: {Number(product.onHand)} sp)
                                    </span>
                                )}
                            </li>

                            <li>
                                <b>Chia sẻ:</b>{" "}
                                <span>
                                    <AiFillFacebook />
                                    <AiFillTikTok />
                                    <AiOutlineCopy />
                                </span>
                            </li>
                            <li>
                                <b>Giới thiệu:</b> <span>{product.description}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Sản phẩm tương tự */}
                <div className="section-title">
                    <h2>Sản phẩm tương tự</h2>
                </div>
                <div className="row">
                    {relatedProducts.map((item) => (
                        <div
                            key={item._id}
                            className="col-lg-3 col-md-4 col-sm-6 col-xs-12"
                        >
                            <ProductCard
                                id={item._id}
                                name={item.name}
                                description={item.description}
                                price={item.price}
                                category={item.category}
                                image={item.image}
                                status={item.status}
                                discountPercent={item.discountPercent}
                                onHand={item.onHand}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default memo(ProductDetail);