import { memo, useState, useEffect } from "react";
import Breadcrumb from '../theme/breadcrumb';
import "./style.scss";
import { categories } from '../theme/header';
import { Link } from 'react-router-dom';
import { ROUTERS } from "../../../utils/router";
import { useDispatch, useSelector } from "react-redux";
import { ProductCard } from "../../../component/productCard";
import { getAllProduct } from "../../../component/redux/apiRequest";

const ProductsPage = () => {
    const dispatch = useDispatch();

    // State tìm kiếm, lọc giá và sắp xếp
    const [searchTerm, setSearchTerm] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [sortType, setSortType] = useState("Mới nhất"); // ⚡ default mới nhất

    // Lấy sản phẩm từ Redux
    const products = useSelector((state) => state.product.products?.allProducts || []);

    // Load sản phẩm khi component mount
    useEffect(() => {
        getAllProduct(dispatch);
    }, [dispatch]);

    if (!products || !products.length) return <p>Đang tải sản phẩm...</p>;

    // ✅ Hàm tính giá đã giảm
    const getFinalPrice = (p) => {
        const pct = Number(p.discountPercent) || 0;
        return Math.max(0, Math.round((p.price || 0) * (100 - pct) / 100));
    };

    // Filter theo tên và khoảng giá
    let filteredProducts = products.filter((p) => {
        const finalPrice = getFinalPrice(p); // ⚡ dùng giá đã giảm khi lọc
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMin = minPrice === "" || finalPrice >= Number(minPrice);
        const matchesMax = maxPrice === "" || finalPrice <= Number(maxPrice);
        return matchesSearch && matchesMin && matchesMax;
    });

    // Sắp xếp sản phẩm theo sortType
    filteredProducts = filteredProducts.sort((a, b) => {
        const priceA = getFinalPrice(a);
        const priceB = getFinalPrice(b);

        switch (sortType) {
            case "Mới nhất":
                return new Date(b.createdAt) - new Date(a.createdAt);
            case "Giá thấp đến cao":
                return priceA - priceB; // ⚡ theo giá đã giảm
            case "Giá cao đến thấp":
                return priceB - priceA; // ⚡ theo giá đã giảm
            case "Bán chạy nhất":
                return (b.sold || 0) - (a.sold || 0);
            case "Đang giảm giá":
                return (Number(b.discountPercent) || 0) - (Number(a.discountPercent) || 0);
            default:
                return 0;
        }
    });

    const sorts = [
        "Mới nhất",
        "Giá thấp đến cao",
        "Giá cao đến thấp",
        "Bán chạy nhất",
        "Đang giảm giá"
    ];

    return (
        <>
            <Breadcrumb name="Danh sách sản phẩm" />
            <div className="container">
                <div className="row">
                    <div className="col-lg-3">
                        <div className="sidebar">
                            {/* Tìm kiếm */}
                            <div className="sidebar_item">
                                <h2>Tìm kiếm</h2>
                                <input
                                    type="text"
                                    placeholder="Bạn đang tìm gì?"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Khoảng giá */}
                            <div className="sidebar_item">
                                <h2>Mức giá (VND)</h2>
                                <div className="price-range-wrap">
                                    <div>
                                        <p>Từ:</p>
                                        <input
                                            type="number"
                                            min={0}
                                            value={minPrice}
                                            onChange={(e) => setMinPrice(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <p>Đến:</p>
                                        <input
                                            type="number"
                                            min={0}
                                            value={maxPrice}
                                            onChange={(e) => setMaxPrice(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sắp xếp */}
                            <div className="sidebar_item">
                                <h2>Sắp xếp</h2>
                                <div className="tags">
                                    {sorts.map((item, key) => (
                                        <div
                                            className={`tag ${sortType === item ? "active" : ""}`}
                                            key={key}
                                            onClick={() => setSortType(item)}
                                        >
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Thể loại */}
                            <div className="sidebar_item">
                                <h2>Thể loại</h2>
                                <ul>
                                    {categories.map((name, key) => (
                                        <li key={key}>
                                            <Link to={ROUTERS.USER.PRODUCTS}>{name}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-9">
                        <div className="row">
                            {filteredProducts.length ? (
                                filteredProducts.map((item, key) => (
                                    <div className="col-lg-4 col-md-3 col-sm-6 col-xs-12" key={key}>
                                        <ProductCard
                                            id={item._id}
                                            name={item.name}
                                            description={item.description}
                                            price={item.price}
                                            category={item.category}
                                            image={item.image || item.img}
                                            status={item.status}
                                            discountPercent={item.discountPercent}
                                        />
                                    </div>
                                ))
                            ) : (
                                <p>Không tìm thấy sản phẩm phù hợp.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default memo(ProductsPage);
