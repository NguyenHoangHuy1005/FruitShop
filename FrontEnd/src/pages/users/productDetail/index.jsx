import { memo, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
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

const ProductDetail = () => {
    const dispatch = useDispatch();
    const { id } = useParams();
    const navigate = useNavigate();

    const products = useSelector((s) => s.product.products?.allProducts || []);
    const product = products.find((p) => String(p._id) === String(id));

    // state viewCount phải fetch lại nếu không dữ liệu sẽ bị cũ vì không thêm vào apirequest
    // lượt mua lấy từ redux vì đã thêm vào hàm tạo order nên sẽ được cập nhật, dữ liệu luôn mới
    const [viewCount, setViewCount] = useState(product?.viewCount || 0);
    
    // Batch information state
    const [batchInfo, setBatchInfo] = useState(null);
    const [loadingBatches, setLoadingBatches] = useState(true);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [isBuyNowMode, setIsBuyNowMode] = useState(false);
    const [selectedQuantity, setSelectedQuantity] = useState(1);

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

    if (!product) return <h2>Không tìm thấy sản phẩm</h2>;

    const pct = Number(product.discountPercent) || 0;
    const finalPrice = Math.max(
        0,
        Math.round(((Number(product.price) || 0) * (100 - pct)) / 100)
    );
    const mainImg = Array.isArray(product.image)
        ? product.image[0]
        : product.image;
    const relatedProducts = products
        .filter((p) => p.category === product.category && p._id !== product._id)
        .slice(0, 8);

    // Tổng số lượng tồn tính từ batch info
    const totalInStock = batchInfo?.summary?.totalInStock || 0;
    
    // Determine if we should show quantity buttons
    // Show buttons only if there's exactly 1 batch
    const totalBatches = batchInfo?.summary?.totalBatches || 0;
    const showQuantityButtons = totalBatches === 1;
    
    // Get active batch info (the first batch with remaining quantity)
    const activeBatch = batchInfo?.batches?.find(b => b.remainingQuantity > 0);
    const activeBatchQuantity = activeBatch?.remainingQuantity || 0;
    
    // Fallback: if no batch info loaded, use product.onHand or status
    const hasStock = totalBatches > 0 
        ? activeBatchQuantity > 0 
        : (product?.onHand > 0 || product?.status?.includes("Còn hàng"));

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

                        {/* Giá từ lô hàng, fallback về giá Product */}
                        <div className="price-section">
                            <PriceDisplay 
                                productId={id} 
                                className="product-detail-price"
                                fallbackPrice={product.price}
                                fallbackDiscount={pct}
                            />
                            {pct > 0 && (
                                <div className="discount-badge-detail">
                                    <span className="discount-tag-large">-{pct}%</span>
                                </div>
                            )}
                        </div>

                        {/* ✅ Đơn vị tính */}
                        <div className="product-unit">
                            <b>Đơn vị tính:</b> <span>{product.unit || "kg"}</span>
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
                                        {totalBatches === 1 && activeBatch && (
                                            <>
                                                <span> | Còn lại: <strong>{activeBatchQuantity} {product.unit || "kg"}</strong></span>
                                                {activeBatch.daysLeft !== null && (
                                                    <span className={activeBatch.daysLeft <= 7 ? "expiring-soon" : ""}>
                                                        {" "}| HSD còn: <strong>{activeBatch.daysLeft} ngày</strong>
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        {totalBatches > 1 && (
                                            <span className="multiple-batches-note">
                                                {""}<em>Sản phẩm có nhiều lô. Sau khi mua hết lô gần hạn nhất, sẽ mở lô tiếp theo.</em>
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
                                onAdd={async (q) => {
                                    const qty = Math.max(1, Number(q) || 1);
                                    if (qty > activeBatchQuantity) {
                                        alert(`Lô hiện tại chỉ còn ${activeBatchQuantity} ${product.unit || "kg"}. Vui lòng giảm số lượng!`);
                                        return;
                                    }
                                    // Dispatch action Redux (thêm vào giỏ hàng)
                                    await addToCart(product._id, qty, dispatch);
                                }}
                                onBuyNow={async (q) => {
                                    const qty = Math.max(1, Number(q) || 1);
                                    if (qty > activeBatchQuantity) {
                                        alert(`Lô hiện tại chỉ còn ${activeBatchQuantity} ${product.unit || "kg"}. Vui lòng giảm số lượng!`);
                                        return;
                                    }
                                    await addToCart(product._id, qty, dispatch);
                                    navigate(ROUTERS.USER.CHECKOUT, {
                                        state: { selectedProductIds: [String(product._id)] },
                                    });
                                }}
                            />
                        ) : (
                            <div className="no-quantity-buttons">
                                <button
                                    type="button"
                                    className="button-submit"
                                    onClick={() => {
                                        if (!hasStock || (totalBatches > 0 && activeBatchQuantity === 0)) {
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
                                    disabled={!hasStock || (totalBatches > 0 && activeBatchQuantity === 0)}
                                >
                                    Thêm vào giỏ hàng
                                </button>
                                <button
                                    type="button"
                                    className="button-buy-now"
                                    onClick={() => {
                                        if (!hasStock || (totalBatches > 0 && activeBatchQuantity === 0)) {
                                            alert("Sản phẩm hiện đã hết hàng!");
                                            return;
                                        }
                                        if (totalBatches === 0) {
                                            alert("Sản phẩm chưa có thông tin lô hàng. Vui lòng liên hệ admin!");
                                            return;
                                        }
                                        setShowQuantityModal(true);
                                        setIsBuyNowMode(true);
                                    }}
                                    disabled={!hasStock || (totalBatches > 0 && activeBatchQuantity === 0)}
                                >
                                    Mua ngay
                                </button>
                            </div>
                        )}
                        <ul>
                            <li>
                                <b>Tình trạng:</b>{" "}
                                <span>
                                    <span className={
                                        product?.status?.includes("Còn hàng") ? "in-stock" :
                                        product?.status?.includes("Hết hàng") ? "out-stock" :
                                        product?.status?.includes("Sắp hết hàng") ? "low-stock" : ""
                                    }>
                                        {product?.status || "Không rõ"}
                                    </span>
                                </span>
                            </li>
                            {/* ✅ Họ sản phẩm (nếu có) */}
                            {product.family && (
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
                                <b>Giới thiệu:</b> <span>{product.description}</span>
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
                                    alt={product.name}
                                />
                                <div>
                                    <h4>{product.name}</h4>
                                    <p className="price">{formatter(activeBatch?.sellingPrice || product.price)}</p>
                                </div>
                            </div>

                            <div className="stock-info">
                                <p className="stock-label">
                                    <strong>Số lượng tồn kho:</strong> 
                                    <span className="stock-value">{activeBatchQuantity} {product.unit || "kg"}</span>
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
                                        max={activeBatchQuantity}
                                        value={selectedQuantity}
                                        onChange={(e) => {
                                            const val = Math.max(1, Math.min(activeBatchQuantity, Number(e.target.value) || 1));
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
                                    {formatter((activeBatch?.sellingPrice || product.price) * selectedQuantity)}
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
                                    if (selectedQuantity > activeBatchQuantity) {
                                        alert(`Lô hiện tại chỉ còn ${activeBatchQuantity} ${product.unit || "kg"}!`);
                                        return;
                                    }
                                    await addToCart(product._id, selectedQuantity, dispatch);
                                    
                                    if (isBuyNowMode) {
                                        navigate(ROUTERS.USER.CHECKOUT, {
                                            state: { selectedProductIds: [String(product._id)] },
                                        });
                                    }
                                    
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