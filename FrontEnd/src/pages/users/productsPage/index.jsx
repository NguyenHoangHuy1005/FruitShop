import { memo, useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import "./style.scss";
import { ROUTERS } from "../../../utils/router";
import { useDispatch, useSelector } from "react-redux";
import { ProductCard } from "../../../component/productCard";
import { getAllProduct } from "../../../component/redux/apiRequest";
import { peekPriceRange, prefetchPriceRange } from "../../../hooks/usePriceRange";

const ProductsPage = () => {
    const dispatch = useDispatch();
    const routerLocation = useLocation();

    // State tìm kiếm, lọc giá và sắp xếp
    const [searchTerm, setSearchTerm] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [sortType, setSortType] = useState("Mặc định");
    const [selectedFamily, setSelectedFamily] = useState(""); // ✅ Lọc theo họ
    const [priceVersion, setPriceVersion] = useState(0);

    // Lấy sản phẩm từ Redux
    const products = useSelector(
        (state) => state.product.products?.allProducts || []
    );

    // Load sản phẩm khi component mount
    useEffect(() => {
        getAllProduct(dispatch);
    }, [dispatch]);

    // Prefetch price range data for visible products so filters can use it
    useEffect(() => {
        let mounted = true;
        const ids = products
            .map((p) => p?._id)
            .filter(Boolean)
            .slice(0, 60);

        ids.forEach((productId) => {
            if (peekPriceRange(productId) !== undefined) return;
            prefetchPriceRange(productId)
                .then(() => {
                    if (mounted) {
                        setPriceVersion((v) => v + 1);
                    }
                })
                .catch(() => {});
        });

        return () => {
            mounted = false;
        };
    }, [products]);

    // ✅ Hàm chuẩn hóa string (tìm kiếm không dấu, không phân biệt hoa thường)
    const normalizeString = (str) =>
        (str || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    // ✅ Hàm tính giá sau giảm
    const getFinalPrice = (p) => {
        const pct = Number(p.discountPercent) || 0;
        return Math.max(0, Math.round((p.price || 0) * (100 - pct) / 100));
    };

    const getPriceSnapshot = (product) => {
        const fallbackPrice = getFinalPrice(product);
        const cached = peekPriceRange(product?._id);

        if (cached === undefined) {
            return {
                min: fallbackPrice,
                max: fallbackPrice,
                hasDiscount: Number(product.discountPercent) > 0,
                hasAvailableBatch: Number(product.onHand || 0) > 0,
            };
        }

        if (cached === null) {
            return {
                min: fallbackPrice,
                max: fallbackPrice,
                hasDiscount: Number(product.discountPercent) > 0,
                hasAvailableBatch: false,
            };
        }

        const entries = Array.isArray(cached.priceEntries) ? cached.priceEntries : [];
        const minFinal = Number.isFinite(cached.minFinal) ? cached.minFinal : fallbackPrice;
        const maxFinal = Number.isFinite(cached.maxFinal) ? cached.maxFinal : minFinal;
        const hasBatchDiscount =
            cached.hasDiscount ||
            entries.some((entry) => Number(entry?.discountPercent) > 0);
        const hasAvailableBatch =
            cached.hasAvailableBatch !== false
                ? Boolean(cached.hasAvailableBatch)
                : entries.some((entry) => Number(entry?.remainingQuantity || 0) > 0);

        return {
            min: minFinal,
            max: maxFinal,
            hasDiscount: hasBatchDiscount || Number(product.discountPercent) > 0,
            hasAvailableBatch,
        };
    };

    // ✅ Lấy query category từ URL
    const queryParams = new URLSearchParams(routerLocation.search);
    const categoryParam = queryParams.get("category"); // dùng đúng 1 biến

    // ✅ Lấy danh sách họ từ sản phẩm đã lọc theo category
    const availableFamilies = useMemo(() => {
        return [
            ...new Set(
                products
                    .filter((p) => !categoryParam || p.category === categoryParam)
                    .map((p) => p.family)
                    .filter(Boolean) // Loại bỏ giá trị rỗng
            ),
        ].sort();
    }, [products, categoryParam]);

    const filteredProducts = useMemo(() => {
        const snapshotCache = new Map();
        const resolveSnapshot = (product) => {
            const key = product?._id || product?.id;
            if (snapshotCache.has(key)) {
                return snapshotCache.get(key);
            }
            const snapshot = getPriceSnapshot(product);
            snapshotCache.set(key, snapshot);
            return snapshot;
        };

        const normalizedSearch = normalizeString(searchTerm);
        const filtered = products.filter((p) => {
            const snapshot = resolveSnapshot(p);
            const finalPrice = snapshot.min;
            const matchesSearch = normalizeString(p.name).includes(normalizedSearch);
            const matchesMin = minPrice === "" || finalPrice >= Number(minPrice);
            const matchesMax = maxPrice === "" || finalPrice <= Number(maxPrice);
            const matchesCategory = !categoryParam || p.category === categoryParam;
            const matchesFamily = !selectedFamily || p.family === selectedFamily;
            return matchesSearch && matchesMin && matchesMax && matchesCategory && matchesFamily;
        });

const sorted = filtered.sort((a, b) => {
    const snapA = resolveSnapshot(a) || {};
    const snapB = resolveSnapshot(b) || {};

    const statusPriority = {
        "Hết hạn": 0,
        "Sắp hết hạn": 1,
        "Còn hạn": 2,
        "Còn hàng": 3,
        "Hết hàng": 4,
    };

    switch (sortType) {
        case "Trạng thái ưu tiên": {
            const aPriority = statusPriority[a?.status] ?? 5;
            const bPriority = statusPriority[b?.status] ?? 5;

            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return (a?.name || "").localeCompare(b?.name || "");
        }

        case "Mặc định": {
            // Mặc định = sắp xếp theo trạng thái ưu tiên, nếu bằng thì theo tên
            const aPriority = statusPriority[a?.status] ?? 5;
            const bPriority = statusPriority[b?.status] ?? 5;

            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return (a?.name || "").localeCompare(b?.name || "");
        }

        case "Mới nhất":
            return new Date(b?.createdAt) - new Date(a?.createdAt);

        case "Giá thấp đến cao":
            return (snapA.min ?? 0) - (snapB.min ?? 0);

        case "Giá cao đến thấp":
            return (snapB.max ?? 0) - (snapA.max ?? 0);

        case "Bán chạy nhất":
            return (b?.purchaseCount || 0) - (a?.purchaseCount || 0);

        case "Đang giảm giá":
            return (snapB.hasDiscount ? 1 : 0) - (snapA.hasDiscount ? 1 : 0);

        default:
            return 0;
    }
});

        return sorted;
    }, [
        products,
        searchTerm,
        minPrice,
        maxPrice,
        categoryParam,
        selectedFamily,
        sortType,
        priceVersion,
    ]);

    const sorts = [
        "Mặc định",
        "Mới nhất", 
        "Giá thấp đến cao",
        "Giá cao đến thấp",
        "Bán chạy nhất",
        "Đang giảm giá",
    ];

    // ✅ Danh mục cố định là string
    const categories = ["Trái cây", "Rau củ", "Giỏ quà tặng", "Hoa trái cây", "Thực phẩm khô"];

    // Kiểm tra sau khi tất cả hooks đã được gọi
    if (!products || !products.length) {
        return (
            <>
                <Breadcrumb paths={[{ label: "Danh sách sản phẩm" }]} />
                <div className="container">
                    <p>Đang tải sản phẩm...</p>
                </div>
            </>
        );
    }

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
