import { memo, useState, useEffect } from "react";
import Breadcrumb from '../theme/breadcrumb';
import "./style.scss";
import { categories } from '../theme/header';
import { Link } from 'react-router-dom';
import { ROUTERS } from "../../../utils/router";
import { useDispatch, useSelector } from "react-redux";
import { ProductCard } from "../../../component/ProductCard";
import { getAllProduct } from "../../../component/redux/apiRequest";

const ProductsPage = () => {
    const dispatch = useDispatch();

    // State tìm kiếm, lọc giá và sắp xếp
    const [searchTerm, setSearchTerm] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [sortType, setSortType] = useState("Giá thấp đến cao");

    // Lấy sản phẩm từ Redux
    const products = useSelector((state) => state.product.products?.allProducts || []);

    // Load sản phẩm khi component mount
    useEffect(() => {
        getAllProduct(dispatch);
    }, [dispatch]);

    if (!products || !products.length) return <p>Đang tải sản phẩm...</p>;

    // Filter theo tên và khoảng giá
    let filteredProducts = products.filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMin = minPrice === "" || p.price >= Number(minPrice);
        const matchesMax = maxPrice === "" || p.price <= Number(maxPrice);
        return matchesSearch && matchesMin && matchesMax;
    });

    // Sắp xếp sản phẩm
    filteredProducts = filteredProducts.sort((a, b) => {
        switch (sortType) {
            case "Giá thấp đến cao":
                return a.price - b.price;
            case "Giá cao đến thấp":
                return b.price - a.price;
            case "Bán chạy nhất":
                return (b.sold || 0) - (a.sold || 0); // giả sử có field sold
            case "Đang giảm giá":
                return (b.discount || 0) - (a.discount || 0); // giả sử có field discount
            default:
                return 0;
        }
    });

    const sorts = [
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
                                <h2>Mức giá(VND)</h2>
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
