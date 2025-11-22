import { memo, useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Breadcrumb from "../theme/breadcrumb";
import "./style.scss";
import {
    AiOutlineEye,
    AiFillFacebook,
    AiOutlineCopy,
    AiFillTikTok,
} from "react-icons/ai";
import { formatter } from "../../../utils/fomater";
import { getAllProduct, getPublicBatchesByProduct } from "../../../component/redux/apiRequest";
import { ProductCard } from "../../../component/productCard";
import Quantity from "../../../component/quantity";
import { addToCart } from "../../../component/redux/apiRequest";
import PriceDisplay from "../../../component/PriceDisplay";
import { ROUTERS } from "../../../utils/router"; // Redux action thêm giỏ hàng

import ProductReviews from "../../../component/productReviews";
import { usePriceRange } from "../../../hooks/usePriceRange";

const ProductDetail = () => {
    const dispatch = useDispatch();
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const products = useSelector((s) => s.product.products?.allProducts || []);
    const product = products.find((p) => String(p._id) === String(id));
    const currentUser = useSelector((s) => s.auth?.login?.currentUser);
    const { priceRange } = usePriceRange(id);

    // state viewCount phải fetch lại nếu không dữ liệu sẽ bị cũ vì không thêm vào apirequest
    // lượt mua lấy từ redux vì đã thêm vào hàm tạo order nên sẽ được cập nhật, dữ liệu luôn mới
    const [viewCount, setViewCount] = useState(product?.viewCount || 0);
    
    // Batch information state
    const [batchInfo, setBatchInfo] = useState(null);
    const [loadingBatches, setLoadingBatches] = useState(true);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [isBuyNowMode, setIsBuyNowMode] = useState(false);
    const [selectedQuantity, setSelectedQuantity] = useState(1);

    const derivedBatchState = useMemo(() => {
        const batches = Array.isArray(batchInfo?.batches) ? batchInfo.batches : [];
        const summary = batchInfo?.summary || {};
        const availableBatches = batches.filter((batch) => Number(batch?.remainingQuantity) > 0);

        const sortedBatches = [...availableBatches].sort((a, b) => {
            const expA = a.expiryDate ? new Date(a.expiryDate) : null;
            const expB = b.expiryDate ? new Date(b.expiryDate) : null;
            if (expA && expB) {
                const diff = expA - expB;
                if (diff !== 0) return diff;
            } else if (expA && !expB) {
                return -1;
            } else if (!expA && expB) {
                return 1;
            }
            const impA = a.importDate ? new Date(a.importDate) : new Date(0);
            const impB = b.importDate ? new Date(b.importDate) : new Date(0);
            return impA - impB;
        });

        const summaryActiveId = summary.activeBatchId;
        let active = null;

        if (summaryActiveId) {
            active =
                sortedBatches.find(
                    (batch) => String(batch._id) === String(summaryActiveId)
                ) || null;
        }
        if (!active) {
            active = sortedBatches[0] || null;
        }

        const quantity = Number(active?.remainingQuantity) || 0;
        const hasResolvedBatchInfo = !loadingBatches && Array.isArray(batchInfo?.batches);
        const hasStockFromBatch = Boolean(active && quantity > 0);
        const fallbackStock =
            hasResolvedBatchInfo
                ? false
                : Boolean(
                      (Number(product?.onHand) || 0) > 0 ||
                          (product?.status || "").includes("Còn hàng")
                  );
        const hasStock = hasResolvedBatchInfo ? hasStockFromBatch : fallbackStock;
        const isOutOfStock = hasResolvedBatchInfo ? !hasStockFromBatch : false;
        const derivedStatus = isOutOfStock
            ? "Hết hàng"
            : product?.status || (hasStock ? "Còn hàng" : "Không rõ");

        return {
            activeBatch: active,
            activeBatchQuantity: quantity,
            availableBatchCount: sortedBatches.length,
            hasStock,
            isOutOfStock,
            derivedStatus,
        };
    }, [batchInfo, loadingBatches, product?.onHand, product?.status]);

    // Refresh product list on mount / id change so `product.onHand` is up-to-date
    useEffect(() => {
        // load public products (includes onHand via aggregation in backend)
        (async () => {
            try {
                await getAllProduct(dispatch, false);
            } catch (e) {
                // ignore - we still render with existing store
                console.warn('Failed to refresh products for onHand:', e?.message || e);
            }
        })();
    }, [dispatch, id]);
    
    // Fetch batch information
    useEffect(() => {
        if (id) {
            setLoadingBatches(true);
            getPublicBatchesByProduct(id)
                .then((data) => {
                    console.log('✅ Batch info loaded:', data);
                    setBatchInfo(data);
                })
                .catch((err) => {
                    console.error("❌ Error fetching batch info:", err?.message || err);
                    console.error("Chi tiết lỗi:", err);
                    setBatchInfo(null);
                })
                .finally(() => {
                    setLoadingBatches(false);
                });
        }
    }, [id]);
    
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

    // Move calculations and derived values before early return
    const pct = Number(product?.discountPercent) || 0;
    const finalPrice = Math.max(
        0,
        Math.round(((Number(product?.price) || 0) * (100 - pct)) / 100)
    );
    const mainImg = Array.isArray(product?.image)
        ? product?.image[0]
        : product?.image;
    const relatedProducts = products
        .filter((p) => p.category === product?.category && p._id !== product?._id)
        .slice(0, 8);

    // Tổng số lượng tồn tính từ batch info
    const {
        activeBatch,
        activeBatchQuantity,
        availableBatchCount,
        hasStock,
        isOutOfStock,
        derivedStatus,
    } = derivedBatchState;
    const totalBatches =
        batchInfo?.summary?.totalBatches ?? availableBatchCount ?? 0;
    // Hiển thị nút tăng/giảm khi có hàng trong kho, không phụ thuộc vào số lượng lô
    const showQuantityButtons = hasStock && !isOutOfStock && activeBatchQuantity > 0;
    const disablePurchase = !hasStock || isOutOfStock;
    const normalizedStatus = (derivedStatus || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const statusClassName = isOutOfStock
        ? "out-stock"
        : normalizedStatus.includes("con hang")
        ? "in-stock"
        : normalizedStatus.includes("sap")
        ? "low-stock"
        : "";
    const maxSelectableQuantity = Math.max(1, activeBatchQuantity || 0);

    const bestBatchPrice = useMemo(() => {
        const entries = Array.isArray(priceRange?.priceEntries) ? priceRange.priceEntries : [];
        const entry = entries.find((e) => Number(e?.remainingQuantity || 0) > 0) || entries[0];
        if (entry) {
            const base = Number(entry.basePrice) || Number(entry.finalPrice) || finalPrice;
            const finalP = Number(entry.finalPrice) || finalPrice;
            return {
                current: finalP,
                base,
                hasDiscount: base > finalP,
            };
        }
        return {
            current: finalPrice,
            base: pct > 0 ? Number(product?.price) || finalPrice : finalPrice,
            hasDiscount: pct > 0,
        };
    }, [priceRange, finalPrice, pct, product?.price]);

    useEffect(() => {
        setSelectedQuantity((prev) => {
            if (prev > maxSelectableQuantity) return maxSelectableQuantity;
            if (prev < 1) return 1;
            return prev;
        });
    }, [maxSelectableQuantity]);

    const normalizeQuantity = (value) => Math.max(1, Number(value) || 1);

    const ensurePurchasableQuantity = (value) => {
        if (disablePurchase) {
            alert("Sản phẩm hiện đã hết hàng!");
            return null;
        }

        const qty = normalizeQuantity(value);
        if (activeBatch && activeBatchQuantity > 0 && qty > activeBatchQuantity) {
            alert(
                `Lô hiện tại chỉ còn ${activeBatchQuantity} ${
                    product?.unit || "kg"
                }. Vui lòng giảm số lượng!`
            );
            return null;
        }
        return qty;
    };

    const handleAddToCartAction = async (value) => {
        const qty = ensurePurchasableQuantity(value);
        if (!qty) return false;

        await addToCart(product._id, qty, dispatch);
        return true;
    };

    const handleBuyNowAction = async (value) => {
        if (!currentUser) {
            alert("Vui lòng đăng nhập để mua ngay.");
            navigate(ROUTERS.ADMIN.LOGIN, {
                state: { from: location.pathname },
            });
            return false;
        }

        const qty = ensurePurchasableQuantity(value);
        if (!qty) return false;

        await addToCart(product._id, qty, dispatch);
        navigate(ROUTERS.USER.CHECKOUT, {
            state: { selectedProductIds: [String(product._id)] },
        });
        return true;
    };

    // Early return AFTER all hooks and calculations
    if (!product) return <h2>Không tìm thấy sản phẩm</h2>;

    return (
        <>
            <Breadcrumb
                paths={[
                    { label: "Danh sách sản phẩm", to: "/product" },
                    { label: "Chi tiết sản phẩm" },
                ]}
            />
            <div className="container product-detail">
                <div className="row">
                    {/* Hình ảnh sản phẩm */}
                    <div className="col-lg-6 product__detail__pic">
                        <div className="main">
                            {pct > 0 && (
                                <span className="discount-pill">-{pct}%</span>
                            )}
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
                            Đã bán: <b>{product?.purchaseCount || 0}</b>
                        </div>

                        <h2 className="product__name">{product?.name}</h2>

                        {/* Giá từ lô hàng, fallback về giá Product */}
                        <div className="price-section">
                            <PriceDisplay 
                                productId={id} 
                                className="product-detail-price"
                                fallbackPrice={product.price}
                                fallbackDiscount={pct}
                            />
                        </div>

                        {/* ✅ Đơn vị tính */}
                        <div className="product-unit">
                            <b>Đơn vị tính:</b> <span>{product?.unit || "kg"}</span>
                        </div>
                        
                        {/* Display batch information */}
                        {loadingBatches && (
                            <div className="batch-info-section">
                                <div className="batch-summary">
                                    <em>Đang tải thông tin lô hàng...</em>
                                </div>
                            </div>
                        )}
                        
                        {!loadingBatches && batchInfo && totalBatches > 0 && (
                            <div className="batch-info-section">
                                <div className="batch-summary">
                                    <b>Thông tin lô hàng:</b>
                                    <div className="batch-details">
                                        <span>Số lô hiện có: <strong>{totalBatches}</strong></span>
                                        {activeBatch && (
                                            <>
                                                <span> | Còn lại: <strong>{activeBatchQuantity} {product?.unit || "kg"}</strong></span>
                                                {activeBatch.daysLeft !== null && (
                                                    <span className={activeBatch.daysLeft <= 7 ? "expiring-soon" : ""}>
                                                        {" "}| HSD còn: <strong>{activeBatch.daysLeft} ngày</strong>
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        {totalBatches > 1 && (
                                            <span className="multiple-batches-note">
                                                <br /><em>Sản phẩm có nhiều lô. Sau khi mua hết lô gần hạn nhất, sẽ mở lô tiếp theo.</em>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {!loadingBatches && (!batchInfo || totalBatches === 0) && (
                            <div className="batch-info-section">
                                <div className="batch-summary">
                                    <em className="no-batches-note">Sản phẩm chưa nhập lô hàng. Vui lòng liên hệ để biết thêm thông tin.</em>
                                </div>
                            </div>
                        )}
                        
                        {/* ✅ Chọn số lượng + thêm vào giỏ */}
                        {showQuantityButtons ? (
                            <Quantity
                                onAdd={handleAddToCartAction}
                                onBuyNow={handleBuyNowAction}
                                max={maxSelectableQuantity}
                                disabled={disablePurchase}
                            />
                        ) : (
                            <div className="no-quantity-buttons">
                                <button
                                    type="button"
                                    className="button-submit"
                                    onClick={() => {
                                        if (disablePurchase) {
                                            alert("Sản phẩm hiện đã hết hàng!");
                                            return;
                                        }
                                        // Show modal for multiple batches or when no batch info
                                        if (totalBatches === 0) {
                                            alert("Sản phẩm chưa có thông tin lô hàng. Vui lòng liên hệ admin!");
                                            return;
                                        }
                                        setShowQuantityModal(true);
                                    }}
                                    disabled={disablePurchase}
                                >
                                    Thêm vào giỏ hàng
                                </button>
                                <button
                                    type="button"
                                    className="button-buy-now"
                                    onClick={() => {
                                        if (disablePurchase) {
                                            alert("Sản phẩm hiện đã hết hàng!");
                                            return;
                                        }
                                        if (totalBatches === 0) {
                                            alert("Sản phẩm chưa có thông tin lô hàng. Vui lòng liên hệ admin!");
                                            return;
                                        }
                                        if (!currentUser) {
                                            alert("Vui lòng đăng nhập để mua ngay.");
                                            navigate(ROUTERS.ADMIN.LOGIN, {
                                                state: { from: location.pathname },
                                            });
                                            return;
                                        }
                                        setShowQuantityModal(true);
                                        setIsBuyNowMode(true);
                                    }}
                                    disabled={disablePurchase}
                                >
                                    Mua ngay
                                </button>
                            </div>
                        )}
                        {!loadingBatches && isOutOfStock && (
                            <p className="stock-alert">
                                Sản phẩm hiện đã hết hàng, vui lòng quay lại sau.
                            </p>
                        )}
                        <ul>
                            <li>
                                <b>Tình trạng:</b>{" "}
                                <span>
                                    <span className={statusClassName}>
                                        {derivedStatus || "Không rõ"}
                                    </span>
                                </span>
                            </li>
                            {/* ✅ Họ sản phẩm (nếu có) */}
                            {product?.family && (
                                <li>
                                    <b>Họ:</b> <span>{product.family}</span>
                                </li>
                            )}
                            <li>
                                <b>Chia sẻ:</b>{" "}
                                <span>
                                    <AiFillFacebook />
                                    <AiFillTikTok />
                                    <AiOutlineCopy />
                                </span>
                            </li>
                            <li>
                                <b>Giới thiệu:</b> <span>{product?.description}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Product Reviews Section */}
                <div className="product-reviews-section">
                    <ProductReviews productId={id} />
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
                                unit={item.unit}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Quantity Modal for Multiple Batches */}
            {showQuantityModal && (
                <div className="quantity-modal-overlay" onClick={() => {
                    setShowQuantityModal(false);
                    setIsBuyNowMode(false);
                    setSelectedQuantity(1);
                }}>
                    <div className="quantity-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Chọn số lượng</h3>
                            <button 
                                className="close-btn"
                                onClick={() => {
                                    setShowQuantityModal(false);
                                    setIsBuyNowMode(false);
                                    setSelectedQuantity(1);
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="product-info-modal">
                                <img 
                                    src={mainImg || "/assets/images/placeholder-product.png"} 
                                    alt={product?.name}
                                />
                                <div>
                                    <h4>{product?.name}</h4>
                                    <div className="price price-modal">
                                        {bestBatchPrice.hasDiscount && (
                                            <span className="price-original">{formatter(bestBatchPrice.base)}</span>
                                        )}
                                        <span className="price-current">{formatter(bestBatchPrice.current)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="stock-info">
                                <p className="stock-label">
                                    <strong>Số lượng tồn kho:</strong> 
                                    <span className="stock-value">{activeBatchQuantity} {product?.unit || "kg"}</span>
                                </p>
                                {activeBatch?.daysLeft !== null && (
                                    <p className={`expiry-info ${activeBatch.daysLeft <= 7 ? "expiring-soon" : ""}`}>
                                        <strong>HSD còn:</strong> {activeBatch.daysLeft} ngày
                                    </p>
                                )}
                            </div>

                            <div className="quantity-selector">
                                <label>Số lượng:</label>
                                <div className="quantity-input-group">
                                    <button
                                        className="qty-btn"
                                        onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxSelectableQuantity}
                                        value={selectedQuantity}
                                        onChange={(e) => {
                                            const val = Math.max(
                                                1,
                                                Math.min(
                                                    maxSelectableQuantity,
                                                    Number(e.target.value) || 1
                                                )
                                            );
                                            setSelectedQuantity(val);
                                        }}
                                    />
                                    <button
                                        className="qty-btn"
                                        onClick={() => setSelectedQuantity(Math.min(activeBatchQuantity, selectedQuantity + 1))}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="total-price">
                                <strong>Tổng cộng:</strong>
                                <span className="total-amount">
                                    {formatter(bestBatchPrice.current * selectedQuantity)}
                                </span>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn-cancel"
                                onClick={() => {
                                    setShowQuantityModal(false);
                                    setIsBuyNowMode(false);
                                    setSelectedQuantity(1);
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                className="btn-confirm"
                                onClick={async () => {
                                    const action = isBuyNowMode
                                        ? handleBuyNowAction
                                        : handleAddToCartAction;
                                    const success = await action(selectedQuantity);
                                    if (!success) return;

                                    setShowQuantityModal(false);
                                    setIsBuyNowMode(false);
                                    setSelectedQuantity(1);
                                }}
                            >
                                {isBuyNowMode ? "Mua ngay" : "Thêm vào giỏ hàng"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default memo(ProductDetail);
