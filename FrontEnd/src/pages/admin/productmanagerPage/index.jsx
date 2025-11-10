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



    useEffect(() => {
        const initializePage = async () => {
            try {
                setIsLoading(true);
                
                // Đồng bộ tồn kho trước khi load dữ liệu
                console.log('Đang đồng bộ tồn kho từ các lô hàng...');
                await syncInventoryFromBatches();
                
                // Sau đó load dữ liệu sản phẩm và lô hàng
                await getAllProduct(dispatch);
                await fetchAllProductBatches();
                
                console.log('Tải dữ liệu hoàn tất');
            } catch (error) {
                console.error('Error initializing product manager page:', error);
                // Vẫn load dữ liệu dù sync thất bại
                getAllProduct(dispatch);
                fetchAllProductBatches();
            } finally {
                setIsLoading(false);
            }
        };

        initializePage();
    }, [dispatch]);

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
            // Nhóm các lô theo productId và tính tổng hợp
            const batchesByProduct = {};
            allBatches.forEach(batch => {
                if (!batchesByProduct[batch.productId]) {
                    batchesByProduct[batch.productId] = {
                        batches: [],
                        totalInStock: 0,
                        totalSold: 0,
                        statusCount: { expired: 0, expiring: 0, valid: 0 }
                    };
                }
                
                batchesByProduct[batch.productId].batches.push(batch);
                batchesByProduct[batch.productId].totalInStock += batch.remainingQuantity || 0;
                batchesByProduct[batch.productId].totalSold += batch.soldQuantity || 0;
                
                // Tính trạng thái lô
                const now = new Date();
                let status = 'valid';
                if (batch.expiryDate) {
                    const expiryDate = new Date(batch.expiryDate);
                    const daysLeft = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
                    
                    if (daysLeft <= 0) {
                        status = 'expired';
                    } else if (daysLeft <= 7) {
                        status = 'expiring';
                    }
                }
                
                batchesByProduct[batch.productId].statusCount[status]++;
            });
            setProductBatches(batchesByProduct);
            
            return batchesByProduct;
        } catch (error) {
            console.error('Error fetching batches:', error);
            throw error;
        }
    };

    // Fetch thông tin lô mới nhất cho tất cả sản phẩm
    const fetchAllLatestBatchInfo = async () => {
        try {
            const latestBatchData = {};
            
            // Lấy thông tin lô mới nhất cho từng sản phẩm
            const fetchPromises = products.map(async (product) => {
                try {
                    const data = await getLatestBatchInfo(product._id);
                    latestBatchData[product._id] = data;
                } catch (error) {
                    console.error(`Error fetching latest batch for product ${product._id}:`, error);
                    // Nếu không có lô hàng, sử dụng thông tin từ product
                    latestBatchData[product._id] = {
                        latestBatch: null,
                        summary: {
                            totalInStock: product.onHand || 0,
                            totalSold: 0,
                            totalBatches: 0
                        }
                    };
                }
            });

            await Promise.all(fetchPromises);
            setLatestBatchInfo(latestBatchData);
            
        } catch (error) {
            console.error('Error fetching latest batch info:', error);
        }
    };
    // ===== PRODUCT LIST =====
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
            totalSold: productBatch.totalSold
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
        
        // Sắp xếp theo mức độ ưu tiên: Hết hạn -> Sắp hết hạn -> Còn hạn -> Còn hàng -> Hết hàng
        result.sort((a, b) => {
            // Định nghĩa thứ tự ưu tiên
            const statusPriority = {
                'Hết hạn': 0,      // Cao nhất - cần xử lý gấp
                'Sắp hết hạn': 1,  // Cao
                'Còn hạn': 2,      // Trung bình
                'Còn hàng': 3,     // Thấp (legacy)
                'Hết hàng': 4      // Thấp nhất
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
                {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => {
                    const imgSrc = Array.isArray(product.image)
                        ? product.image[0] || "/placeholder.png"
                        : product.image || "/placeholder.png";

                    const batchSummary = getBatchStatusSummary(product._id);
                    const latestBatch = latestBatchInfo[product._id];

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
                                (Number(latestBatch.latestBatch.sellingPrice) || 0).toLocaleString() + ' VND' : 
                                <span style={{color: '#94a3b8', fontStyle: 'italic'}}>Đang tải giá...</span>
                            }</b>
                        </td>
                        <td>{Number(product.discountPercent || 0)}%</td>
                        <td>
                            <b>{latestBatch?.summary?.totalInStock || (Number(product.onHand || 0))}</b>
                        </td>
                        <td><b>{product.unit || "kg"}</b></td>
                        <td>{product.family || "—"}</td>
                        <td>{product.category || "Chưa phân loại"}</td>
                        <td>
                            {batchSummary ? (
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
                                product.status === "Hết hạn" ? "expired" :
                                product.status === "Sắp hết hạn" ? "expiring" :
                                product.status === "Còn hạn" ? "valid" :
                                product.status === "Còn hàng" ? "in-stock" : "out-stock"
                            }`}
                            >
                            {product.status}
                            </span>
                        </td>
                        <td>
                            <button className="btn-edit" onClick={() => handleEdit(product)}>Sửa</button>
                            <button className="btn-delete" onClick={() => handleDelete(product._id)}>Xóa</button>
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
                    onPriceUpdate={fetchAllLatestBatchInfo}
                />
            )}
        </div>
    );
};

export default memo(ProductManagerPage);
