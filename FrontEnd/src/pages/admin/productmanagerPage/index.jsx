import { memo, useState, useEffect, useMemo } from "react";
import "./style.scss";
import { useSelector, useDispatch } from "react-redux";
import ProductForm from "../../../component/modals/addProductModal";
import {
    getAllProduct,
    createProduct,
    updateProduct,
    deleteProduct,
} from "../../../component/redux/apiRequest";

const ProductManagerPage = () => {
    const dispatch = useDispatch();
    const products = useSelector((state) => state.product.products?.allProducts || []);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingProduct, setEditingProduct] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // 🔥 NEW: State cho giảm giá hàng loạt
    const [bulkDiscountModal, setBulkDiscountModal] = useState({
        open: false,
        selectedProducts: [],
        discountPercent: 0,
        discountStartDate: "",
        discountEndDate: "",
        submitting: false,
        searchTerm: "",
    });

    useEffect(() => {
        getAllProduct(dispatch);
    }, [dispatch]);
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

    const filteredProducts = useMemo(() => {
        const key = (searchTerm || "").trim().toLowerCase();
        if (!key) return products;
        return products.filter((p) => (p?.name || "").toLowerCase().includes(key));
    }, [products, searchTerm]);

    // 🔥 NEW: Hàm xử lý giảm giá hàng loạt
    const handleBulkDiscount = async () => {
        const { selectedProducts, discountPercent, discountStartDate, discountEndDate } = bulkDiscountModal;
        
        if (selectedProducts.length === 0) {
            alert("Vui lòng chọn ít nhất 1 sản phẩm!");
            return;
        }

        if (discountPercent < 0 || discountPercent > 100) {
            alert("% giảm giá phải từ 0 đến 100!");
            return;
        }

        try {
            setBulkDiscountModal((s) => ({ ...s, submitting: true }));
            
            const payload = { 
                productIds: selectedProducts, 
                discountPercent: Number(discountPercent),
            };

            // Thêm ngày nếu có
            if (discountStartDate) {
                payload.discountStartDate = discountStartDate;
            }
            if (discountEndDate) {
                payload.discountEndDate = discountEndDate;
            }

            console.log("🔥 Payload gửi đi:", payload);
            console.log("🔑 Token:", localStorage.getItem("accessToken"));

            const response = await fetch("http://localhost:3000/api/product/bulk-discount", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            
            console.log("📦 Response:", { status: response.status, data });
            
            if (!response.ok) {
                throw new Error(data.message || "Giảm giá thất bại!");
            }

            alert(data.message || "Giảm giá thành công!");
            await getAllProduct(dispatch);
            setBulkDiscountModal({ 
                open: false, 
                selectedProducts: [], 
                discountPercent: 0,
                discountStartDate: "",
                discountEndDate: "",
                submitting: false, 
                searchTerm: "" 
            });
        } catch (e) {
            console.error("❌ Lỗi:", e);
            alert(e.message || "Có lỗi xảy ra!");
            setBulkDiscountModal((s) => ({ ...s, submitting: false }));
        }
    };

    return (
        <div className="container">
            <h2>QUẢN LÝ SẢN PHẨM</h2>

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
                <button
                    className="btn-bulk-discount"
                    onClick={() => setBulkDiscountModal((s) => ({ ...s, open: true }))}
                >
                    ⚡ Giảm giá hàng loạt
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
                        <td>{(Number(product.price) || 0).toLocaleString()} VND</td>
                        <td>{Number(product.discountPercent || 0)}%</td>
                        <td><b>{Number(product.onHand || 0)}</b></td>
                        <td><b>{product.unit || "kg"}</b></td>
                        <td>{product.family || "—"}</td>
                        <td>{product.category || "Chưa phân loại"}</td>
                        <td>
                            <span
                            className={
                                product.status === "Còn hàng" ? "status in-stock" : "status out-stock"
                            }
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
                    <td colSpan="10" className="no-data">Không tìm thấy sản phẩm</td>
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

            {/* 🔥 NEW: Modal giảm giá hàng loạt */}
            {bulkDiscountModal.open && (
                <div className="modal-overlay" onClick={() => setBulkDiscountModal({ open: false, selectedProducts: [], discountPercent: 0, discountStartDate: "", discountEndDate: "", submitting: false, searchTerm: "" })}>
                    <div className="modal-content bulk-discount-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>⚡ Giảm giá hàng loạt</h3>

                        <div className="discount-input-group">
                            <label>% Giảm giá (0-100)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={bulkDiscountModal.discountPercent}
                                onChange={(e) => {
                                    let val = Number(e.target.value);
                                    if (val < 0) val = 0;
                                    if (val > 100) val = 100;
                                    setBulkDiscountModal((s) => ({ ...s, discountPercent: val }));
                                }}
                            />
                        </div>

                        <div className="date-range-group">
                            <div className="date-field">
                                <label>Ngày bắt đầu giảm giá</label>
                                <input
                                    type="date"
                                    value={bulkDiscountModal.discountStartDate}
                                    onChange={(e) => setBulkDiscountModal((s) => ({ ...s, discountStartDate: e.target.value }))}
                                />
                                <small>Để trống = áp dụng ngay</small>
                            </div>
                            <div className="date-field">
                                <label>Ngày kết thúc giảm giá</label>
                                <input
                                    type="date"
                                    value={bulkDiscountModal.discountEndDate}
                                    onChange={(e) => setBulkDiscountModal((s) => ({ ...s, discountEndDate: e.target.value }))}
                                />
                                <small>Để trống = vô thời hạn</small>
                            </div>
                        </div>

                        <div>
                            <div className="selection-toolbar">
                                <label>Chọn sản phẩm áp dụng</label>
                                <div className="toolbar-buttons">
                                    <button
                                        type="button"
                                        className="btn-select-all"
                                        onClick={() => {
                                            const allIds = products.map(p => p._id);
                                            setBulkDiscountModal((s) => ({ ...s, selectedProducts: allIds }));
                                        }}
                                    >
                                        Chọn tất cả
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-deselect-all"
                                        onClick={() => setBulkDiscountModal((s) => ({ ...s, selectedProducts: [] }))}
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            </div>
                            
                            {/* 🔍 Ô tìm kiếm sản phẩm */}
                            <div className="search-box">
                                <input
                                    type="text"
                                    placeholder="🔍 Tìm kiếm sản phẩm..."
                                    value={bulkDiscountModal.searchTerm}
                                    onChange={(e) => setBulkDiscountModal((s) => ({ ...s, searchTerm: e.target.value }))}
                                />
                            </div>
                            
                            <div className="products-list">
                                {products.length > 0 ? (
                                    products
                                        .filter((p) => {
                                            const searchKey = (bulkDiscountModal.searchTerm || "").trim().toLowerCase();
                                            if (!searchKey) return true;
                                            return (p?.name || "").toLowerCase().includes(searchKey);
                                        })
                                        .map((p) => (
                                        <label 
                                            key={p._id}
                                            className={`product-item ${bulkDiscountModal.selectedProducts.includes(p._id) ? 'selected' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={bulkDiscountModal.selectedProducts.includes(p._id)}
                                                onChange={(e) => {
                                                    const selected = e.target.checked
                                                        ? [...bulkDiscountModal.selectedProducts, p._id]
                                                        : bulkDiscountModal.selectedProducts.filter(id => id !== p._id);
                                                    setBulkDiscountModal((s) => ({ ...s, selectedProducts: selected }));
                                                }}
                                            />
                                            <span className="name">{p.name}</span>
                                            <span className="family">{p.family || "—"}</span>
                                            <span className="price">{Number(p.price || 0).toLocaleString()}₫</span>
                                            <span className={`discount ${p.discountPercent > 0 ? 'has-discount' : ''}`}>
                                                {p.discountPercent || 0}%
                                            </span>
                                        </label>
                                    ))
                                ) : (
                                    <p className="no-products">Không có sản phẩm</p>
                                )}
                            </div>
                            <small className="selection-count">
                                Đang chọn: <b>{bulkDiscountModal.selectedProducts.length}</b> / {products.length} sản phẩm
                            </small>
                        </div>

                        <div className="actions">
                            <button 
                                className="btn-cancel"
                                onClick={() => setBulkDiscountModal({ open: false, selectedProducts: [], discountPercent: 0, discountStartDate: "", discountEndDate: "", submitting: false, searchTerm: "" })}
                            >
                                Hủy
                            </button>
                            <button 
                                className="btn-apply"
                                onClick={handleBulkDiscount}
                                disabled={bulkDiscountModal.submitting}
                            >
                                {bulkDiscountModal.submitting ? "Đang áp dụng..." : "Áp dụng giảm giá"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(ProductManagerPage);
