import { memo, useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import "./style.scss";
import { ROUTERS } from "../../../utils/router";
import { useDispatch, useSelector } from "react-redux";
import { ProductCard } from "../../../component/productCard";
import { getAllProduct } from "../../../component/redux/apiRequest";

const ProductsPage = () => {
    const dispatch = useDispatch();
    const routerLocation = useLocation();

    // State tìm kiếm, lọc giá và sắp xếp
    const [searchTerm, setSearchTerm] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [sortType, setSortType] = useState("Mới nhất");
    const [selectedFamily, setSelectedFamily] = useState(""); // ✅ Lọc theo họ

    // Lấy sản phẩm từ Redux
    const products = useSelector(
        (state) => state.product.products?.allProducts || []
    );

    // Load sản phẩm khi component mount
    useEffect(() => {
        getAllProduct(dispatch);
    }, [dispatch]);

    if (!products || !products.length) return <p>Đang tải sản phẩm...</p>;

    // ✅ Hàm chuẩn hóa string (tìm kiếm không dấu, không phân biệt hoa thường)
    const normalizeString = (str) =>
        str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    // ✅ Hàm tính giá sau giảm
    const getFinalPrice = (p) => {
        const pct = Number(p.discountPercent) || 0;
        return Math.max(0, Math.round((p.price || 0) * (100 - pct) / 100));
    };

    // ✅ Lấy query category từ URL
    const queryParams = new URLSearchParams(routerLocation.search);
    const categoryParam = queryParams.get("category"); // dùng đúng 1 biến

    // ✅ Lấy danh sách họ từ sản phẩm đã lọc theo category
    const availableFamilies = [
        ...new Set(
            products
                .filter((p) => !categoryParam || p.category === categoryParam)
                .map((p) => p.family)
                .filter(Boolean) // Loại bỏ giá trị rỗng
        ),
    ].sort();

    // Filter theo tìm kiếm, giá, danh mục, họ
    let filteredProducts = products.filter((p) => {
        const finalPrice = getFinalPrice(p);
        const matchesSearch = normalizeString(p.name).includes(normalizeString(searchTerm));
        const matchesMin = minPrice === "" || finalPrice >= Number(minPrice);
        const matchesMax = maxPrice === "" || finalPrice <= Number(maxPrice);
        const matchesCategory = !categoryParam || p.category === categoryParam;
        const matchesFamily = !selectedFamily || p.family === selectedFamily; // ✅ Lọc họ
        return matchesSearch && matchesMin && matchesMax && matchesCategory && matchesFamily;
    });

    // Sắp xếp sản phẩm
    filteredProducts = filteredProducts.sort((a, b) => {
        const priceA = getFinalPrice(a);
        const priceB = getFinalPrice(b);

        switch (sortType) {
            case "Mới nhất":
                return new Date(b.createdAt) - new Date(a.createdAt);
            case "Giá thấp đến cao":
                return priceA - priceB;
            case "Giá cao đến thấp":
                return priceB - priceA;
            case "Bán chạy nhất":
                return (b.purchaseCount || 0) - (a.purchaseCount || 0); // Sắp xếp theo lượt mua đã fix nè
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
        "Đang giảm giá",
    ];

    // ✅ Danh mục cố định là string
    const categories = ["Trái cây", "Rau củ", "Giỏ quà tặng", "Hoa trái cây", "Thực phẩm khô"];

    return (
        <>
            <Breadcrumb paths={[{ label: "Danh sách sản phẩm" }]} />
            <div className="container">
                <div className="row">
                    {/* Sidebar */}
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
                                <div className="tags">
                                    {categories.map((cat, key) => (
                                        <Link
                                            key={key}
                                            to={`${ROUTERS.USER.PRODUCTS}?category=${cat}`}
                                            className={`tag ${categoryParam === cat ? "active" : ""}`}
                                        >
                                            {cat}
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* ✅ Bộ lọc theo họ (chỉ hiện khi có category) */}
                            {categoryParam && availableFamilies.length > 0 && (
                                <div className="sidebar_item">
                                    <h2>Họ {categoryParam}</h2>
                                    <div className="tags">
                                        <div
                                            className={`tag ${!selectedFamily ? "active" : ""}`}
                                            onClick={() => setSelectedFamily("")}
                                        >
                                            Tất cả
                                        </div>
                                        {availableFamilies.map((family, key) => (
                                            <div
                                                key={key}
                                                className={`tag ${selectedFamily === family ? "active" : ""}`}
                                                onClick={() => setSelectedFamily(family)}
                                            >
                                                {family}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Danh sách sản phẩm */}
                    <div className="col-lg-9">
                        <div className="row">
                            {filteredProducts.length ? (
                                filteredProducts.map((item, key) => (
                                    <div
                                        className="col-lg-4 col-md-3 col-sm-6 col-xs-12"
                                        key={key}
                                    >
                                        <ProductCard
                                            id={item._id}
                                            name={item.name}
                                            description={item.description}
                                            price={item.price}
                                            category={item.category}
                                            image={item.image || item.img}
                                            status={item.status}
                                            discountPercent={item.discountPercent}
                                            onHand={item.onHand}
                                            unit={item.unit}
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
