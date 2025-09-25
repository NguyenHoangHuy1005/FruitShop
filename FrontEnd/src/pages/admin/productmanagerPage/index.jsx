import { memo, useState, useEffect, useMemo } from "react";
import "./style.scss";
import { useSelector, useDispatch } from "react-redux";
import ProductForm from "../../../component/modals/addProductModal";
import {
    getAllProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getAllCoupons,
    createCoupon,
    deleteCoupon,
    toggleCoupon,
    extendCoupon,
} from "../../../component/redux/apiRequest";

const ProductManagerPage = () => {
    const dispatch = useDispatch();
    const products = useSelector((state) => state.product.products?.allProducts || []);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingProduct, setEditingProduct] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Coupons state
    const [coupons, setCoupons] = useState([]);
    const [newCoupon, setNewCoupon] = useState({
        code: "",
        discountType: "percent",
        value: 0,
        endDate: "",
        usageLimit: 0,
    });
    const [extendModal, setExtendModal] = useState({
        open: false,
        coupon: null,
        addUsage: 0,
        newEndDate: "",
        reactivate: true, // mặc định bật lại nếu đã ngưng/hết hạn
        submitting: false,
    });
    const fmtDateInput = (d) => {
        try {
        const dd = new Date(d);
        if (Number.isNaN(dd.getTime())) return "";
        const y = dd.getFullYear();
        const m = String(dd.getMonth() + 1).padStart(2, "0");
        const day = String(dd.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
        } catch {
        return "";
        }
    };

    useEffect(() => {
        getAllProduct(dispatch);
        loadCoupons();
    }, [dispatch]);

    const loadCoupons = async () => {
        try {
        const data = await getAllCoupons();
        setCoupons(data);
        } catch (e) {
        console.error("Load coupons fail:", e);
        }
    };

    const handleAddCoupon = async () => {
        try {
        if (!newCoupon.code || !newCoupon.value || !newCoupon.endDate) {
            alert("Nhập đủ thông tin mã giảm giá!");
            return;
        }

        await createCoupon({
            code: newCoupon.code,
            discountType: newCoupon.discountType,
            value: Number(newCoupon.value),
            endDate: newCoupon.endDate,
            minOrder: 0,
            usageLimit: Number(newCoupon.usageLimit), // ✅ thêm số lần được dùng
        });

        alert("Thêm coupon thành công!");
        setNewCoupon({
            code: "",
            discountType: "percent",
            value: 0,
            endDate: "",
            usageLimit: 0,
        });
        await loadCoupons();
        } catch (e) {
        alert(e?.response?.data?.message || "Tạo coupon thất bại!");
        }
    };
    const openExtend = (c) => {
        setExtendModal({
        open: true,
        coupon: c,
        addUsage: 0,
        newEndDate: fmtDateInput(c?.endDate) || "",
        reactivate: true,
        submitting: false,
        });
    };

    // ... trong component ProductManagerPage
    const submitExtend = async () => {
        const { coupon, addUsage, newEndDate, reactivate } = extendModal;
        if (!coupon) return;

        const payload = {};
        const addNum = Number(addUsage);
        if (Number.isFinite(addNum) && addNum > 0) payload.addUsage = addNum;
        if (newEndDate && newEndDate.trim()) payload.newEndDate = newEndDate.trim();
        if (reactivate) payload.reactivate = true;

        if (!payload.addUsage && !payload.newEndDate && !payload.reactivate) {
        alert("Không có thay đổi nào được chọn.");
        return;
        }

        try {
        setExtendModal((s) => ({ ...s, submitting: true }));
        await extendCoupon(coupon._id, payload);
        await loadCoupons();
        setExtendModal({ open: false, coupon: null, addUsage: 0, newEndDate: "", reactivate: true, submitting: false });
        alert("Gia hạn coupon thành công!");
        } catch (e) {
        alert(e?.response?.data?.message || e?.message || "Gia hạn không thành công.");
        setExtendModal((s) => ({ ...s, submitting: false }));
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

    const filteredProducts = useMemo(() => {
        const key = (searchTerm || "").trim().toLowerCase();
        if (!key) return products;
        return products.filter((p) => (p?.name || "").toLowerCase().includes(key));
    }, [products, searchTerm]);

    return (
        <div className="container">
            <h2>QUẢN LÝ SẢN PHẨM</h2>

            {/* Thanh công cụ */}
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

            {/* Bảng sản phẩm */}
            <table className="product-table">
                <thead>
                    <tr>
                        <th>Tên sản phẩm</th>
                        <th>Hình ảnh</th>
                        <th>Giá (VNĐ)</th>
                        <th>Giảm (%)</th>
                        <th>Số lượng</th>
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
                            <td colSpan="8" className="no-data">Không tìm thấy sản phẩm</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Form Coupon */}
            <div className="coupon-section">
                <h3>QUẢN LÝ MÃ GIẢM GIÁ</h3>

                <div className="coupon-form">
                <input
                    type="text"
                    placeholder="Mã code"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
                />

                <select
                    value={newCoupon.discountType}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                >
                    <option value="percent">Giảm theo %</option>
                    <option value="fixed">Giảm theo VNĐ</option>
                </select>

                <input
                    type="number"
                    min="0"
                    max={newCoupon.discountType === "percent" ? 100 : undefined}
                    value={newCoupon.value}
                    onChange={(e) => {
                        let val = Number(e.target.value);
                        if (newCoupon.discountType === "percent" && val > 100) val = 100; // fix % max = 100
                        setNewCoupon({ ...newCoupon, value: val });
                    }}
                    placeholder="Giá trị"
                />

                <input
                    type="date"
                    value={newCoupon.endDate}
                    onChange={(e) => setNewCoupon({ ...newCoupon, endDate: e.target.value })}
                />

                <input
                    type="number"
                    min="0"
                    value={newCoupon.usageLimit}
                    onChange={(e) =>
                        setNewCoupon({ ...newCoupon, usageLimit: Number(e.target.value) })
                    }
                    placeholder="Số lần sử dụng"
                />

                <button onClick={handleAddCoupon}>+ Thêm Coupon</button>
                </div>

                <table className="coupon-table">
                <thead>
                    <tr>
                    <th>Code</th>
                    <th>Loại</th>
                    <th>Giá trị</th>
                    <th>Hạn sử dụng</th>
                    <th>Sử dụng</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    {coupons.length > 0 ? (
                    coupons.map((c) => {
                        const expired = new Date(c.endDate) < new Date();
                        const usedUp = c.usageLimit > 0 && c.usedCount >= c.usageLimit;

                        return (
                        <tr key={c._id} className={!c.active || expired || usedUp ? "expired" : ""}>
                            <td>{c.code}</td>
                            <td>{c.discountType === "percent" ? "%" : "VNĐ"}</td>
                            <td>
                            {c.discountType === "percent"
                                ? `${c.value}%`
                                : `${c.value.toLocaleString()} ₫`}
                            </td>
                            <td>{new Date(c.endDate).toLocaleDateString()}</td>
                            <td>{c.usedCount}/{c.usageLimit || "∞"}</td>
                            <td>
                                {expired || usedUp ? "Hết hạn/Đã dùng hết" : c.active ? "Đang hoạt động" : "Ngưng"}
                            </td>
                            <td>
                            {/* Toggle */}
                            <button
                                className="btn-toggle"
                                disabled={expired || usedUp}
                                onClick={async () => {
                                try {
                                    await toggleCoupon(c._id);
                                    await loadCoupons();
                                } catch (e) {
                                    console.error("Toggle lỗi:", e);
                                    alert("Không thể thay đổi trạng thái!");
                                }
                                }}
                            >
                                {c.active ? "Ngưng" : "Bật"}
                            </button>
                            {/* ✅ NEW: Gia hạn */}
                            <button
                                className="btn-extend"
                                onClick={() => openExtend(c)}
                                title="Tăng lượt dùng và/hoặc dời ngày hết hạn"
                            >
                                Gia hạn
                            </button>
                            {/* Xóa */}
                            <button
                                className="btn-delete"
                                onClick={async () => {
                                if (window.confirm("Xóa coupon này?")) {
                                    try {
                                        await deleteCoupon(c._id);
                                        await loadCoupons();
                                    } catch (e) {
                                        console.error("Toggle lỗi:", e);
                                        alert("Xóa thất bại!");
                                    }
                                }
                                }}
                            >
                                Xóa
                            </button>
                            </td>
                        </tr>
                        );
                    })
                    ) : (
                    <tr>
                        <td colSpan="7" className="no-data">Không có mã giảm giá</td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>

            {/* Modal Form */}
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

            {/* ✅ NEW: Modal gia hạn coupon */}
            {extendModal.open && (
                <div className="modal-overlay" onClick={() => setExtendModal((s) => ({ ...s, open: false }))}>
                <div className="modal-content extend-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Gia hạn Coupon: <span className="code">{extendModal.coupon?.code}</span></h3>

                    <div className="meta">
                    <div>
                        Hạn hiện tại: <b>{new Date(extendModal.coupon?.endDate).toLocaleString()}</b>
                    </div>
                    <div>
                        Đã dùng: <b>{extendModal.coupon?.usedCount}</b> /
                        Giới hạn: <b>{extendModal.coupon?.usageLimit || "∞"}</b>
                    </div>
                    </div>

                    <div className="form-grid">
                    <label>
                        Thêm số lượt sử dụng
                        <input
                        type="number"
                        min={0}
                        step={1}
                        value={extendModal.addUsage}
                        onChange={(e) => setExtendModal((s) => ({ ...s, addUsage: e.target.value }))}
                        placeholder="0"
                        />
                    </label>

                    <label>
                        Ngày hết hạn mới
                        <input
                        type="date"
                        value={extendModal.newEndDate}
                        onChange={(e) => setExtendModal((s) => ({ ...s, newEndDate: e.target.value }))}
                        />
                    </label>

                    <label className="reactivate">
                        <input
                        type="checkbox"
                        checked={extendModal.reactivate}
                        onChange={(e) => setExtendModal((s) => ({ ...s, reactivate: e.target.checked }))}
                        />
                        Bật lại coupon nếu đang ngưng/hết hạn
                    </label>
                    </div>

                    <div className="actions">
                    <button className="btn-cancel" onClick={() => setExtendModal((s) => ({ ...s, open: false }))}>
                        Hủy
                    </button>
                    <button
                        className="btn-save"
                        onClick={submitExtend}
                        disabled={extendModal.submitting}
                    >
                        {extendModal.submitting ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
};

export default memo(ProductManagerPage);
