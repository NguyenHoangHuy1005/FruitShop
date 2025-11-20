import { memo, useState, useEffect, useMemo } from "react";
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
    // Fetch thông tin lô mới nhất khi products đã được load
    useEffect(() => {
        if (products.length > 0) {
            fetchAllLatestBatchInfo();
        }
    }, [products]);
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
            return batchesByProduct;
        } catch (error) {
            console.error('Error fetching batches:', error);
            throw error;
        }
    };
    // Fetch thông tin lô mới nhất cho tất cả sản phẩm
    const fetchAllLatestBatchInfo = async (batchesMap) => {
        try {
            const latestBatchData = {};
            const productsNeedingAPI = [];
            
            // 🔥 Ư u tiên xử lý từ dữ liệu local
            products.forEach((product) => {
                const localBatches = (batchesMap && batchesMap[product._id]) ? batchesMap[product._id].batches : productBatches[product._id]?.batches;
                
                if (localBatches && localBatches.length > 0) {
                    // Find FEFO active batch from local batches
                    const sorted = [...localBatches].sort((a, b) => {
                        if (!a.expiryDate && !b.expiryDate) return new Date(a.importDate) - new Date(b.importDate);
                        if (!a.expiryDate) return 1;
                        if (!b.expiryDate) return -1;
                        return new Date(a.expiryDate) - new Date(b.expiryDate);
                    });
                    
                    // Pick first non-expired batch with remaining quantity
                    let active = null;
                    for (const b of sorted) {
                        const remaining = (b.remainingQuantity ?? b.batchQuantity ?? b.quantity ?? 0);
                        const isExpired = (b.status === 'expired') || false;
                        if (remaining > 0 && !isExpired) { active = b; break; }
                    }
                    if (active) {
                        const batchData = batchesMap?.[product._id] ?? productBatches[product._id];
                        latestBatchData[product._id] = {
                            latestBatch: {
                                _id: active._id,
                                productId: active.productId || product._id,
                                productName: active.productName || product.name,
                                supplierName: active.supplierName || (active.receipt?.supplier?.name) || 'Unknown',
                                unitPrice: active.unitPrice ?? active.importPrice ?? 0,
                                sellingPrice: active.sellingPrice ?? active.unitPrice ?? 0,
                                batchQuantity: active.batchQuantity ?? active.quantity ?? 0,
                                remainingInThisBatch: active.remainingQuantity ?? 0,
                                soldFromThisBatch: active.soldQuantity ?? 0,
                                importDate: active.importDate,
                                expiryDate: active.expiryDate,
                                status: active.status || 'valid'
                            },
                            summary: {
                                totalInStock: batchData?.totalInStock ?? 0,
                                totalSold: batchData?.totalSold ?? 0,
                                totalBatches: batchData?.batches.length ?? 0
                            }
                        };
                    } else {
                        productsNeedingAPI.push(product);
                    }
                } else {
                    productsNeedingAPI.push(product);
                }
            });
            
            // 🔥 Chỉ gọi API cho những sản phẩm thực sự cần
            if (productsNeedingAPI.length > 0) {
                console.log(`📞 Fetching API for ${productsNeedingAPI.length} products...`);
                const apiPromises = productsNeedingAPI.map(async (product) => {
                    try {
                        const data = await getLatestBatchInfo(product._id);
                        latestBatchData[product._id] = data;
                    } catch (error) {
                        latestBatchData[product._id] = {
                            latestBatch: null,
                            summary: { totalInStock: product.onHand || 0, totalSold: 0, totalBatches: 0 }
                        };
                    }
                });
                await Promise.all(apiPromises);
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
                            <b>{latestBatch?.latestBatch ? 
                                (Number(latestBatch.latestBatch.sellingPrice) || 0).toLocaleString() : 
                                <span>—</span>
                            }</b>
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
