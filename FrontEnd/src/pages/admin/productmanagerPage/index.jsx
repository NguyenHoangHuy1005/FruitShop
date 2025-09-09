import { memo, useState, useEffect, useMemo } from "react";
import "./style.scss";
import { useSelector, useDispatch } from "react-redux";
import ProductForm from "../../../component/modals/addProductModal";
import { getAllProduct, createProduct, updateProduct, deleteProduct } from "../../../component/redux/apiRequest";

const ProductManagerPage = () => {
    const dispatch = useDispatch();
    const products = useSelector((state) => state.product.products?.allProducts || []);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingProduct, setEditingProduct] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => { getAllProduct(dispatch); }, [dispatch]);

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
                    ? (product.image[0] || "/placeholder.png")
                    : (product.image || "/placeholder.png");

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

                    {/* ✅ Cột Tồn: chỉ hiển thị số tồn, không phải ảnh */}
                    <td><b>{Number(product.onHand || 0)}</b></td>

                    <td>{product.category || "Chưa phân loại"}</td>

                    <td>
                        <span
                        className={
                            product.status === "Còn hàng"
                            ? "status in-stock"
                            : "status out-stock"
                        }
                        >
                        {product.status}
                        </span>
                    </td>

                    <td>
                        <button
                        className="btn-edit"
                        onClick={() => handleEdit(product)}
                        >
                        Sửa
                        </button>
                        <button
                        className="btn-delete"
                        onClick={() => handleDelete(product._id)}
                        >
                        Xóa
                        </button>
                    </td>
                    </tr>
                );
                })
            ) : (
                <tr>
                {/* ✅ có 8 cột nên colSpan = 8 */}
                <td colSpan="8" className="no-data">
                    Không tìm thấy sản phẩm
                </td>
                </tr>
            )}
            </tbody>
        </table>

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
        </div>
    );
};

export default memo(ProductManagerPage);
