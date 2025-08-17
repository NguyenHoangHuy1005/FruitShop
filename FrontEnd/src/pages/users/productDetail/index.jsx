import { memo } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import "./style.scss";
import { AiOutlineEye, AiFillFacebook, AiOutlineCopy, AiFillTikTok } from "react-icons/ai";
import { formatter } from "../../../utils/fomater";
import { ProductCard, Quantity } from "../../../component";
import { featProducts } from "../../../utils/common";

const ProductDetail = () => {
    const { id } = useParams(); // lấy id từ URL
    const products = useSelector((state) => state.product.products?.allProducts || []);

    // tìm sản phẩm theo id
    const product = products.find((p) => String(p._id) === String(id));

    if (!product) {
        return <h2>Không tìm thấy sản phẩm</h2>;
    }

    // Lấy sản phẩm tương tự (ví dụ cùng category nhưng khác id)
    const relatedProducts = products.filter(
        (p) => p.category === product.category && p._id !== product._id
    ).slice(0, 8); // lấy tối đa 4 sản phẩm

    return (
        <>
            <Breadcrumb name="Chi tiết sản phẩm" />
            <div className="container">
                <div className="row">
                    {/* Hình ảnh */}
                    <div className="col-lg-6 product__detail__pic">
                        <div className="main">
                            <img src={product.image} alt={product.name} />
                        </div>
                    </div>

                    {/* Thông tin chi tiết */}
                    <div className="col-lg-6 product__detail__text">
                        <h2>Chi tiết sản phẩm</h2>
                        <div className="see-icon">
                            <AiOutlineEye /> {`68 (lượt xem)`}
                        </div>
                        <h2 className="product__name">{product.name}</h2>
                        <h3>{formatter(product.price)}</h3>
                        <Quantity />
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
                                <span>{product.status}</span>
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
                                <b>Giới thiệu:</b>{" "}
                                <span>
                                    {product.description}
                                </span>
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
                            />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default memo(ProductDetail);
