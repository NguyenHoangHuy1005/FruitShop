import { memo, useState, useEffect, useMemo, useRef, useCallback } from "react";
import "./style.scss";
import { useSelector, useDispatch } from "react-redux";
import ProductForm from "../../../component/modals/addProductModal";
import BatchInfoModal from "../../../component/modals/BatchInfoModal";
import {
    getAllProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductPublish,
    getLatestBatchInfo,
} from "../../../component/redux/apiRequest";
const ProductManagerPage = () => {
    const dispatch = useDispatch();
    const products = useSelector((state) => state.product.products?.allProducts || []);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingProduct, setEditingProduct] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [productBatches, setProductBatches] = useState({});
    const [latestBatchInfo, setLatestBatchInfo] = useState({}); // Thông tin lô mới nhất cho từng sản phẩm
    const [batchModal, setBatchModal] = useState({ show: false, productId: null, productName: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null); // Track which menu is open
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50); // 🔥 Hiển thị 50 items mỗi trang
    const latestBatchCacheRef = useRef(new Map());
    useEffect(() => {
        const initializePage = async () => {
            try {
                setIsLoading(true);
                const startTime = performance.now();
                console.log('🚀 Bắt đầu tải dữ liệu sản phẩm...');
                
                // 🔥 Load song song tất cả dữ liệu
                const [productsResult, batchesResult] = await Promise.all([
                    getAllProduct(dispatch, true).catch(err => {
                        console.error('Error loading products:', err);
                        return null;
                    }),
                    fetchAllProductBatches().catch(err => {
                        console.error('Error loading batches:', err);
                        return {};
                    })
                ]);
                
                const endTime = performance.now();
                console.log(`✅ Tải dữ liệu hoàn tất trong ${(endTime - startTime).toFixed(0)}ms`);
            } catch (error) {
                console.error('Error initializing product manager page:', error);
            } finally {
                setIsLoading(false);
            }
        };
        initializePage();
    }, [dispatch]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (openMenuId && !event.target.closest('.menu-container')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openMenuId]);
    useEffect(() => {
        if (!products.length) return;
        if (!productBatches || Object.keys(productBatches).length === 0) return;
        fetchAllLatestBatchInfo(productBatches);
    }, [productBatches, products]);
    const fetchAllProductBatches = async () => {
        try {
            const response = await fetch("http://localhost:3000/api/stock/batch-details", {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
                },
            });
            if (!response.ok) {
                throw new Error('Không thể lấy thông tin lô hàng');
            }
            const allBatches = await response.json();
            
            // 🔥 Tối ưu: Sử dụng reduce thay vì forEach
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const MS_PER_DAY = 24 * 60 * 60 * 1000;
            
            const batchesByProduct = allBatches.reduce((acc, batch) => {
                const productId = batch.productId;
                if (!acc[productId]) {
                    acc[productId] = {
                        batches: [],
                        totalInStock: 0,
                        totalSold: 0,
                        totalExpiredQuantity: 0,
                        statusCount: { expired: 0, expiring: 0, valid: 0, empty: 0 }
                    };
                }
                
                // Tính status và daysLeft
                const remaining = Number(batch.remainingQuantity || 0);
                let status = 'valid';
                let daysLeft = null;
                
                if (remaining <= 0) {
                    status = 'empty';
                } else if (batch.expiryDate) {
                    const expiryDate = new Date(batch.expiryDate);
                    const expiryDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
                    daysLeft = Math.floor((expiryDay - today) / MS_PER_DAY);
                    if (daysLeft <= 0) status = 'expired';
                    else if (daysLeft <= 7) status = 'expiring';
                }
                
                batch.status = status;
                batch.daysLeft = daysLeft;
                
                acc[productId].batches.push(batch);
                acc[productId].totalSold += batch.soldQuantity || 0;
                acc[productId].statusCount[status]++;
                
                if (status === 'expired') {
                    acc[productId].totalExpiredQuantity += remaining;
                } else {
                    acc[productId].totalInStock += remaining;
                }
                
                return acc;
            }, {});
            
            setProductBatches(batchesByProduct);
            latestBatchCacheRef.current.clear();
            return batchesByProduct;
        } catch (error) {
            console.error('Error fetching batches:', error);
            throw error;
        }
    };
    // Fetch thông tin lô mới nhất cho tất cả sản phẩm
    const fetchAllLatestBatchInfo = async (incomingBatches) => {
        try {
            const latestBatchData = {};
            const needApi = [];

            const normalizeDate = (value) => (value ? new Date(value) : null);
            const isExpiredBatch = (batch) => {
                if (!batch) return true;
                if (batch.status) {
                    if (batch.status === 'expired') return true;
                    if (batch.status === 'empty') {
                        const remaining = Number(batch.remainingQuantity ?? 0);
                        if (remaining <= 0) return true;
                    }
                    if (batch.status === 'valid' || batch.status === 'expiring') {
                        // still usable unless daysLeft <= 0
                        if (typeof batch.daysLeft === 'number' && batch.daysLeft <= 0) {
                            return true;
                        }
                    }
                }
                if (typeof batch.daysLeft === 'number') {
                    return batch.daysLeft <= 0;
                }
                if (!batch.expiryDate) return false;
                const today = new Date();
                const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const expiry = normalizeDate(batch.expiryDate);
                if (!expiry) return false;
                const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
                return expiryDay <= startOfToday;
            };

            const hasRemainingStock = (batch) => Number(batch?.remainingQuantity ?? batch?.batchQuantity ?? batch?.quantity ?? 0) > 0;

            const resolveFromLocal = (productId) => {
                const entry = incomingBatches?.[productId] || productBatches[productId];
                if (!entry || !(entry.batches || []).length) return null;
                const list = entry.batches || [];

                const eligibleByFlag = list.find(
                    (b) => Boolean(b.isActive) && hasRemainingStock(b) && !isExpiredBatch(b)
                );
                if (eligibleByFlag) {
                    return { batch: eligibleByFlag, summary: entry };
                }

                const fallback = [...list]
                    .filter((b) => hasRemainingStock(b) && !isExpiredBatch(b))
                    .sort((a, b) => {
                        const aExpiry = normalizeDate(a.expiryDate);
                        const bExpiry = normalizeDate(b.expiryDate);
                        if (aExpiry && bExpiry) return aExpiry - bExpiry;
                        if (aExpiry) return -1;
                        if (bExpiry) return 1;
                        return new Date(a.importDate || 0) - new Date(b.importDate || 0);
                    })[0];
                if (fallback) {
                    return { batch: fallback, summary: entry };
                }
                return null;
            };

            const mapBatchToState = (product, source) => {
                if (!source?.batch) return null;
                const batch = source.batch;
                const summary = source.summary;
                return {
                    latestBatch: {
                        _id: batch._id,
                        productId: batch.productId || product._id,
                        productName: batch.productName || product.name,
                        supplierName: batch.supplierName || batch?.receipt?.supplier?.name || 'Unknown',
                        unitPrice: batch.unitPrice ?? batch.importPrice ?? 0,
                        sellingPrice: batch.sellingPrice ?? batch.unitPrice ?? 0,
                        batchQuantity: batch.batchQuantity ?? batch.quantity ?? 0,
                        remainingInThisBatch: batch.remainingQuantity ?? 0,
                        soldFromThisBatch: batch.soldQuantity ?? 0,
                        importDate: batch.importDate,
                        expiryDate: batch.expiryDate,
                        status: batch.status || 'valid',
                        isActive: Boolean(batch.isActive),
                    },
                    summary: {
                        totalInStock: summary?.totalInStock ?? 0,
                        totalSold: summary?.totalSold ?? 0,
                        totalBatches: summary?.batches?.length ?? summary?.totalBatches ?? 0,
                    },
                };
            };

            products.forEach((product) => {
                const resolved = resolveFromLocal(product._id);
                if (resolved) {
                    const mapped = mapBatchToState(product, resolved);
                    if (mapped) {
                        latestBatchData[product._id] = mapped;
                    } else {
                        needApi.push(product);
                    }
                } else {
                    needApi.push(product);
                }
            });

            if (needApi.length > 0) {
                const apiResults = await Promise.all(
                    needApi.map(async (product) => {
                        const cached = latestBatchCacheRef.current.get(product._id);
                        if (cached) {
                            return { productId: product._id, data: cached };
                        }

                        try {
                            const data = await getLatestBatchInfo(product._id);
                            latestBatchCacheRef.current.set(product._id, data);
                            return { productId: product._id, data };
                        } catch (error) {
                            const fallback = {
                                latestBatch: null,
                                summary: { totalInStock: product.onHand || 0, totalSold: 0, totalBatches: 0 },
                            };
                            latestBatchCacheRef.current.set(product._id, fallback);
                            return {
                                productId: product._id,
                                data: fallback,
                            };
                        }
                    })
                );

                apiResults.forEach(({ productId, data }) => {
                    latestBatchData[productId] = data;
                });
            }

            setLatestBatchInfo(latestBatchData);
        } catch (error) {
            console.error('Error fetching latest batch info:', error);
        }
    };
    // ===== PRODUCT LIST =====
    // Callback when a batch price has been updated in the modal
    const handleBatchPriceUpdate = async (productId, patch) => {
        try {
            // If caller provides an immediate patch (batchId + sellingPrice), apply pessimistic update to UI first
            if (patch && patch.sellingPrice !== undefined) {
                setLatestBatchInfo((prev) => {
                    const prevEntry = prev[productId] || {};
                    const prevLatest = prevEntry.latestBatch || {};
                    return {
                        ...prev,
                        [productId]: {
                            ...prevEntry,
                            latestBatch: {
                                ...prevLatest,
                                sellingPrice: patch.sellingPrice
                            }
                        }
                    };
                });
            }
            // Refresh authoritative data
            const batches = await fetchAllProductBatches();
            await fetchAllLatestBatchInfo(batches);
        } catch (err) {
            console.error('Error refreshing batch info after price update:', err);
        }
    };
    const handleSearch = (e) => setSearchTerm(e.target.value);
    const handleCloseModal = () => setShowModal(false);
    const handleEdit = (product) => {
        setEditingProduct(product);
        setShowModal(true);
    };
    const handleDelete = (id) => {
        if (window.confirm("Bạn có chắc muốn xóa sản phẩm này?")) {
        deleteProduct(id, dispatch);
        }
    };
    // ===== BATCH FUNCTIONS =====
    const getBatchStatusSummary = (productId) => {
        const productBatch = productBatches[productId];
        if (!productBatch) return null;

        return {
            total: productBatch.batches.length,
            expired: productBatch.statusCount.expired,
            expiring: productBatch.statusCount.expiring,
            valid: productBatch.statusCount.valid,
            totalInStock: productBatch.totalInStock,
            totalSold: productBatch.totalSold,
            totalExpiredQuantity: productBatch.totalExpiredQuantity || 0
        };
    };
    const handleShowBatches = (productId, productName) => {
        const productBatch = productBatches[productId];
        if (!productBatch || productBatch.batches.length === 0) {
            alert('Sản phẩm này chưa có lô hàng nào.');
            return;
        }
        setBatchModal({
            show: true,
            productId,
            productName
        });
    };
    const handleCloseBatchModal = () => {
        setBatchModal({
            show: false,
            productId: null,
            productName: ''
        });
    };
    const syncInventoryFromBatches = async () => {
        try {
            const response = await fetch("http://localhost:3000/api/stock/sync-inventory", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
                },
            });

            if (!response.ok) {
                throw new Error('Không thể đồng bộ tồn kho');
            }

            const data = await response.json();
            console.log(`Đồng bộ tồn kho thành công: ${data.successCount} sản phẩm được cập nhật, ${data.errorCount} lỗi`);
            
            return data;
        } catch (error) {
            console.error('Error syncing inventory:', error);
            throw error;
        }
    };
    const getBatchCount = (productId) => {
        const productBatch = productBatches[productId];
        return productBatch ? productBatch.batches.length : 0;
    };
    const isBatchSellable = useCallback((batch) => {
        if (!batch) return false;
        const remaining = Number(
            batch.remainingQuantity ??
            batch.remainingInThisBatch ??
            batch.batchQuantity ??
            batch.quantity ??
            0
        );
        if (!Number.isFinite(remaining) || remaining <= 0) return false;
        if (batch.status === 'expired') return false;
        if (typeof batch.daysLeft === 'number' && batch.daysLeft <= 0) return false;
        if (batch.expiryDate) {
            const expiry = new Date(batch.expiryDate);
            const today = new Date();
            if (expiry < today) return false;
        }
        return true;
    }, []);

    const resolveProductDisplayPrice = useCallback((product) => {
        if (!product) return 0;
        const productId = product._id;
        const latest = latestBatchInfo[productId]?.latestBatch;
        const extractPrice = (batch) => {
            if (!batch) return null;
            const price = Number(batch.sellingPrice ?? batch.unitPrice ?? batch.importPrice ?? 0);
            return Number.isFinite(price) && price > 0 ? price : null;
        };

        if (isBatchSellable(latest)) {
            const latestPrice = extractPrice(latest);
            if (latestPrice !== null) return latestPrice;
        }

        const localEntry = productBatches[productId];
        if (localEntry?.batches?.length) {
            const fallbackBatch = [...localEntry.batches]
                .filter((batch) => isBatchSellable(batch))
                .sort((a, b) => {
                    const aTime = new Date(a.expiryDate || a.importDate || 0).getTime();
                    const bTime = new Date(b.expiryDate || b.importDate || 0).getTime();
                    return aTime - bTime;
                })[0];
            const fallbackPrice = extractPrice(fallbackBatch);
            if (fallbackPrice !== null) return fallbackPrice;
        }

        const base = Number(product.price ?? product.basePrice ?? 0);
        return Number.isFinite(base) && base > 0 ? base : 0;
    }, [isBatchSellable, latestBatchInfo, productBatches]);

    const filteredProducts = useMemo(() => {
        const key = (searchTerm || "").trim().toLowerCase();
        let result = key ? products.filter((p) => (p?.name || "").toLowerCase().includes(key)) : [...products];
        
        // Tạo bản sao mới của mảng để có thể sắp xếp (tránh lỗi read-only)
        result = [...result];
        
        // Sắp xếp theo mức độ ưu tiên: Sắp hết hạn -> Còn hạn -> Còn hàng -> Hết hàng
        result.sort((a, b) => {
            // Định nghĩa thứ tự ưu tiên (loại bỏ 'Hết hạn')
            const statusPriority = {
                'Sắp hết hạn': 0,
                'Còn hạn': 1,
                'Còn hàng': 2,
                'Hết hàng': 3
            };
            const aPriority = statusPriority[a.status] ?? 5;
            const bPriority = statusPriority[b.status] ?? 5;

            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            // Nếu cùng trạng thái, sắp xếp theo tên
            return (a.name || "").localeCompare(b.name || "");
        });
        return result;
    }, [products, searchTerm]);
    
    // 🔥 Pagination logic
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredProducts.slice(startIndex, endIndex);
    }, [filteredProducts, currentPage, itemsPerPage]);
    
    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="container">
            <h2>QUẢN LÝ SẢN PHẨM</h2>

            {/* Loading indicator */}
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-content">
                        <div className="spinner"></div>
                        <p>Đang đồng bộ tồn kho và tải dữ liệu...</p>
                    </div>
                </div>
            )}
            {/* ===== Toolbar sản phẩm ===== */}
            <div className="toolbar">
                <button
                className="btn-add"
                onClick={() => {
                    setEditingProduct(null);
                    setShowModal(true);
                }}
                >
                + Thêm sản phẩm
                </button>
                <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchTerm}
                onChange={handleSearch}
                />
                <div className="product-stats">
                    <span>📦 Tổng: <b>{filteredProducts.length}</b> sản phẩm</span>
                    {filteredProducts.length !== products.length && (
                        <span>🔍 Đang hiển thị: <b>{paginatedProducts.length}</b></span>
                    )}
                </div>
            </div>
            {/* ===== Bảng sản phẩm ===== */}
            <table className="product-table">
                <thead>
                <tr>
                    <th>Tên sản phẩm</th>
                    <th>Hình ảnh</th>
                    <th>Giá (VNĐ)</th>
                    <th>Giảm (%)</th>
                    <th>Số lượng</th>
                    <th>Đơn vị</th>
                    <th>Họ</th>
                    <th>Danh mục</th>
                    <th>Lô hàng</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                </tr>
                </thead>
                <tbody>
                {paginatedProducts.length > 0 ? (
                    paginatedProducts.map((product) => {
                    const imgSrc = Array.isArray(product.image)
                        ? product.image[0] || "/placeholder.png"
                        : product.image || "/placeholder.png";

                    const batchSummary = getBatchStatusSummary(product._id);
                    const latestBatch = latestBatchInfo[product._id];
                    // Totals used for display and status derivation
                    const totalInStock = batchSummary?.totalInStock ?? latestBatch?.summary?.totalInStock ?? 0;
                    const totalExpiredUnits = batchSummary?.totalExpiredQuantity ?? 0;
                    const hasBatch = batchSummary && batchSummary.total > 0;
                    // Derive display status:
                    // - If no stock -> Hết hàng
                    // - If some batches are expiring -> Sắp hết hạn
                    // - Otherwise -> Còn hàng
                    // (Removed 'Hết hạn' display)
                    let displayStatus = 'Hết hàng';
                    if (hasBatch && totalInStock > 0) {
                        if ((batchSummary.expiring || 0) > 0) {
                            displayStatus = 'Sắp hết hạn';
                        } else {
                            displayStatus = 'Còn hàng';
                        }
                    }
                    const displayStock = totalInStock;
                    return (
                        <tr key={product._id}>
                        <td>{product.name || "—"}</td>
                        <td>
                            <img
                            src={imgSrc}
                            alt={product.name || "Ảnh"}
                            style={{ width: "60px", height: "60px", objectFit: "cover" }}
                            />
                        </td>
                        <td>
                            <b>
                                {(() => {
                                    const priceValue = resolveProductDisplayPrice(product);
                                    return priceValue > 0 ? priceValue.toLocaleString() : "—";
                                })()}
                            </b>
                        </td>
                        <td>{Number(product.discountPercent || 0)}%</td>
                        <td>
                            <b>{displayStock}</b>
                        </td>
                        <td><b>{product.unit || "kg"}</b></td>
                        <td>{product.family || "—"}</td>
                        <td>{product.category || "Chưa phân loại"}</td>
                        <td>
                            {hasBatch ? (
                            <div 
                                className="batch-info-cell"
                                onClick={() => handleShowBatches(product._id, product.name)}
                            >
                                <div className="batch-count">
                                <span className="total-batches">{batchSummary.total} lô</span>
                                </div>
                                <div className="batch-status">
                                {batchSummary.expired > 0 && (
                                    <span className="expired-count">{batchSummary.expired} hết hạn</span>
                                )}
                                {batchSummary.expiring > 0 && (
                                    <span className="expiring-count">{batchSummary.expiring} sắp hết hạn</span>
                                )}
                                {batchSummary.valid > 0 && (
                                    <span className="valid-count">{batchSummary.valid} còn hạn</span>
                                )}
                                
                                </div>
                            </div>
                            ) : (
                            <span className="no-batches">Chưa có lô</span>
                            )}
                        </td>
                        <td>
                            <span
                            className={`status ${
                                displayStatus === "Sắp hết hạn" ? "expiring" :
                                displayStatus === "Còn hạn" ? "valid" :
                                displayStatus === "Còn hàng" ? "in-stock" : "out-stock"
                            }`}
                            >
                            {displayStatus}
                            </span>
                        </td>
                        <td>
                            <div className="action-cell">
                                <div className="menu-container">
                                    <button
                                    className={`btn-toggle ${product.published ? 'Tắt' : 'Bật'}`}
                                    onClick={async () => {
                                    const desired = !product.published;

                                    // If trying to enable (bật), validate batch prices first
                                    if (desired) {
                                        // Ensure we have batch data for this product
                                        let batches = productBatches[product._id]?.batches;
                                        if (!batches) {
                                            try {
                                                // try fetching batches once
                                                await fetchAllProductBatches();
                                                batches = productBatches[product._id]?.batches;
                                            } catch (err) {
                                                // ignore - we'll still try to proceed
                                            }
                                        }

                                        const problematic = (batches || []).filter((b) => {
                                            // Ignore expired batches
                                            const now = new Date();
                                            let isExpired = false;
                                            if (b.status) {
                                                isExpired = b.status === 'expired';
                                            } else if (b.expiryDate) {
                                                const expiryDate = new Date(b.expiryDate);
                                                const daysLeft = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
                                                isExpired = daysLeft <= 0;
                                            }
                                            if (isExpired) return false;

                                            const importP = Number(b.unitPrice ?? b.importPrice ?? 0);
                                            const sellP = Number(b.sellingPrice ?? 0);
                                            return importP === sellP;
                                        });

                                        if (problematic.length > 0) {
                                            // Build a friendly warning message
                                            const list = problematic.map((b, idx) => {
                                                const idxText =`#`;
                                                return `- ${idxText}: giá nhập ${Number(b.unitPrice || b.importPrice || 0).toLocaleString()} = giá bán ${Number(b.sellingPrice || 0).toLocaleString()}`;
                                            }).join('\n');
                                            alert('Không thể bật sản phẩm vì có lô chưa chỉnh sửa giá bán:\n' + list + '\nVui lòng chỉnh giá bán cho các lô này trước khi bật sản phẩm!');
                                            // Open batch modal so user can edit prices
                                            setBatchModal({ show: true, productId: product._id, productName: product.name });
                                            return;
                                        }
                                        // Ensure there is at least one non-expired batch with remaining units before enabling
                                        const nonExpiredWithStock = (batches || []).some((b) => {
                                            const remaining = Number(b.remainingQuantity ?? 0);
                                            // treat expired batches (by status or expiryDate) as invalid for enabling
                                            let isExpired = false;
                                            if (b.status) {
                                                isExpired = b.status === 'expired';
                                            } else if (b.expiryDate) {
                                                const now = new Date();
                                                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                                const expiryDate = new Date(b.expiryDate);
                                                const expiryDay = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
                                                const daysLeft = Math.floor((expiryDay - today) / (24 * 60 * 60 * 1000));
                                                isExpired = daysLeft <= 0;
                                            }
                                            return !isExpired && remaining > 0;
                                        });

                                        if (!nonExpiredWithStock) {
                                            alert('Không thể bật sản phẩm vì không có lô còn hạn và còn tồn để bán. Vui lòng kiểm tra/lập lô mới trước khi bật.');
                                            // Open batch modal so user can inspect / update batches
                                            setBatchModal({ show: true, productId: product._id, productName: product.name });
                                            return;
                                        }
                                        if (!window.confirm('Bật sản phẩm này để hiển thị cho người dùng?')) return;
                                    }
                                    try {
                                        await toggleProductPublish(product._id, desired, dispatch);
                                        alert('Thay đổi trạng thái hiển thị thành công');
                                    } catch (err) {
                                        alert(err?.message || err?.data?.message || 'Thay đổi trạng thái thất bại');
                                    }
                                }}
                                title={product.published ? 'Đang tắt (nhấn để bật)' : 'Đang bật (nhấn để tắt)'}
                            >
                                {product.published ? 'Tắt' : 'Bật'}
                            </button>
                                    <button 
                                        className="btn-menu"
                                        onClick={() => setOpenMenuId(openMenuId === product._id ? null : product._id)}
                                    >
                                        ⋮
                                    </button>
                                    {openMenuId === product._id && (
                                        <div className="dropdown-menu">
                                            <button className="menu-item edit" onClick={() => {
                                                handleEdit(product);
                                                setOpenMenuId(null);
                                            }}>
                                                ✏️ Sửa
                                            </button>
                                            <button className="menu-item delete" onClick={() => {
                                                handleDelete(product._id);
                                                setOpenMenuId(null);
                                            }}>
                                                🗑️ Xóa
                                            </button>
                                        </div>
                                    )}
                                </div>
                            
                            </div>
                        </td>
                        </tr>
                    );
                    })
                ) : (
                    <tr>
                    <td colSpan="11" className="no-data">Không tìm thấy sản phẩm</td>
                    </tr>
                )}
                </tbody>
            </table>
            
            {/* 🔥 Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button 
                        onClick={() => setCurrentPage(1)} 
                        disabled={currentPage === 1}
                        className="page-btn"
                    >
                        ⏮ Đầu
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1}
                        className="page-btn"
                    >
                        ◀ Trước
                    </button>
                    <span className="page-info">
                        Trang <b>{currentPage}</b> / <b>{totalPages}</b>
                        <span className="page-range">
                            ({((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} / {filteredProducts.length})
                        </span>
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages}
                        className="page-btn"
                    >
                        Sau ▶
                    </button>
                    <button 
                        onClick={() => setCurrentPage(totalPages)} 
                        disabled={currentPage === totalPages}
                        className="page-btn"
                    >
                        Cuối ⏭
                    </button>
                </div>
            )}
            
            {/* ===== Modal sản phẩm ===== */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <ProductForm
                        initialData={editingProduct}
                        onSubmit={async (data) => {
                            if (editingProduct) {
                            await updateProduct(editingProduct._id, data, dispatch);
                            } else {
                            await createProduct(data, dispatch);
                            }
                            setShowModal(false);
                        }}
                        onClose={handleCloseModal}
                        />
                    </div>
                </div>
            )}



            {/* Modal hiển thị thông tin lô hàng */}
            {batchModal.show && (
                <BatchInfoModal
                    productId={batchModal.productId}
                    productName={batchModal.productName}
                    onClose={handleCloseBatchModal}
                    onPriceUpdate={handleBatchPriceUpdate}
                />
            )}
        </div>
    );
};

export default memo(ProductManagerPage);
