import { memo, useState, useEffect } from "react";
import "./style.scss";
import { useSelector, useDispatch } from "react-redux";
import ProductForm from "../../../component/modals/addProductModal";
import { getAllProduct, createProduct } from "../../../component/redux/apiRequest";

const ProductManagerPage = () => {
    const dispatch = useDispatch();
    const products = useSelector((state) => state.product.products?.allProducts || []);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingProduct, setEditingProduct] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        getAllProduct(dispatch);
    }, [dispatch]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleSubmitProduct = (newProduct) => {
        setProducts([...products, { id: Date.now(), ...newProduct }]);
        setShowModal(false); // đóng modal sau khi thêm
    };

    const handleCloseModal = () => {
        setShowModal(false);
    };

    const handleEdit = (products) => {
        setEditingProduct(products);  // lưu sản phẩm đang sửa
        setShowModal(true);          // mở modal
    };

    const handleDelete = (id) => {
        if (window.confirm("Bạn có chắc muốn xóa sản phẩm này?")) {
            setProducts(products.filter((p) => p.id !== id));
        }
    };

    const filteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container">
            <h2>QUẢN LÝ SẢN PHẨM</h2>

            {/* Thanh công cụ */}
            <div className="toolbar">
                <button
                    className="btn-add"
                    onClick={() => {
                        setEditingProduct(null); // XÓA dữ liệu đang sửa
                        setShowModal(true);      // Mở modal
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
                        <th>Danh mục</th>
                        <th>Trạng thái</th>
                        <th>Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => (
                            <tr key={product._id}>
                                <td>{product.name}</td>
                                <td>
                                    <img src={product.image} alt={product.name} />
                                </td>
                                <td>{product.price.toLocaleString()}</td>
                                <td>{product.category}</td>
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
                                        onClick={() => handleEdit(product._id)}
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
                        ))
                    ) : (
                        <tr>
                            <td colSpan="6" className="no-data">
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
                                    // // Gọi API update sản phẩm
                                    // await updateProduct(editingProduct.id, data, dispatch);
                                } else {
                                    // Gọi API tạo sản phẩm
                                    await createProduct(data, dispatch);
                                }
                                setShowModal(false); // đóng modal sau khi thêm
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(ProductManagerPage);
