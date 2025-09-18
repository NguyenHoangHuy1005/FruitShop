import { memo, useEffect, useMemo, useState } from "react";
import "./style.scss";
import {
    listStock,
    stockIn,
    stockSet,
    getAllProduct,
    stockInWithInvoice,
    getAllSuppliers,
    addSupplier,
} from "../../../component/redux/apiRequest";
import { useDispatch } from "react-redux";

const StockManagerPage = () => {
    const dispatch = useDispatch();
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);

    const [suppliers, setSuppliers] = useState([]);

    // modal state
    const [showModal, setShowModal] = useState(false);
    const [supplierId, setSupplierId] = useState("");
    const [productId, setProductId] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [unitPrice, setUnitPrice] = useState(0);
    const [note, setNote] = useState("");
    // Thêm state quản lý modal NCC
    const [showAddSupplier, setShowAddSupplier] = useState(false);
    const [supplierForm, setSupplierForm] = useState({
        name: "",
        contact_name: "",
        phone: "",
        email: "",
        address: ""
    });

    const load = async () => {
        setBusy(true);
        try {
        const data = await listStock();
        setRows(Array.isArray(data) ? data : []);
        } finally {
        setBusy(false);
        }
    };

    useEffect(() => { load(); }, []);
    useEffect(() => {
        (async () => {
            try {
            const s = await getAllSuppliers();
            console.log("Suppliers API result:", s); // debug thử
            setSuppliers(Array.isArray(s) ? s : []); // đúng với backend trả về mảng
            } catch (e) {
            console.error("Lỗi load suppliers:", e);
            }
        })();
    }, []);



    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter((r) =>
        (r.productDoc?.name || "").toLowerCase().includes(s)
        );
    }, [rows, q]);

    const onStockIn = async (productId) => {
        const v = prompt("Nhập số lượng cần nhập thêm (+):", "10");
        if (v === null) return;
        const qty = Math.max(1, parseInt(v, 10) || 0);
        if (!qty) return;

        setBusy(true);
        try {
        await stockIn(productId, qty);
        await load();
        await getAllProduct(dispatch);
        alert("Nhập kho thành công!");
        } catch (e) {
        alert(e?.message || "Nhập kho thất bại!");
        } finally {
        setBusy(false);
        }
    };

    const onStockSet = async (productId) => {
        const v = prompt("Đặt lại số tồn (>=0):", "0");
        if (v === null) return;
        const qty = Math.max(0, parseInt(v, 10) || 0);

        setBusy(true);
        try {
        await stockSet(productId, qty);
        await load();
        await getAllProduct(dispatch);
        alert("Cập nhật tồn kho thành công!");
        } catch (e) {
        alert(e?.message || "Cập nhật tồn kho thất bại!");
        } finally {
        setBusy(false);
        }
    };

    const openModal = (pid) => {
        setProductId(pid);
        setSupplierId("");
        setQuantity(0);
        setUnitPrice(0);
        setNote("");
        setShowModal(true);
    };

    const handleSubmitInvoice = async () => {
        if (!supplierId || !productId || quantity <= 0 || unitPrice <= 0) {
        alert("Vui lòng điền đầy đủ thông tin!");
        return;
        }
        setBusy(true);
        try {
        const res = await stockInWithInvoice({
            supplierId,
            items: [{ productId, quantity, unitPrice }],
            note,
        });

        alert(`Đã tạo phiếu nhập thành công! Mã hóa đơn: ${res.receiptId}`);

        setShowModal(false);
        await load();
        await getAllProduct(dispatch);
        alert("Đã tạo phiếu nhập thành công!");
        } catch (e) {
        alert(e.message || "Lỗi nhập kho!");
        } finally {
        setBusy(false);
        }
    };

    return (
        <div className="container stock-manager">
        <h2>QUẢN LÝ TỒN KHO</h2>

        <div className="toolbar">
            <input
            type="text"
            placeholder="Tìm theo tên sản phẩm..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            />
            {busy && <span className="busy">Đang xử lý...</span>}
        </div>

        <table className="stock-table">
            <thead>
            <tr>
                <th>Ảnh</th>
                <th>Tên sản phẩm</th>
                <th>Tồn hiện tại</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
            </tr>
            </thead>
            <tbody>
            {filtered.map((r) => {
                const p = r.productDoc || {};
                const img = Array.isArray(p.image)
                ? p.image[0] || "/placeholder.png"
                : p.image || "/placeholder.png";
                return (
                <tr key={String(r._id || p._id)}>
                    <td>
                    <img
                        src={img}
                        alt={p.name || ""}
                        style={{ width: 56, height: 56, objectFit: "cover" }}
                    />
                    </td>
                    <td>{p.name || "—"}</td>
                    <td><b>{Number(r.onHand || 0)}</b></td>
                    <td>
                    <span className={Number(r.onHand || 0) > 0 ? "status in-stock" : "status out-stock"}>
                        {Number(r.onHand || 0) > 0 ? "Còn hàng" : "Hết hàng"}
                    </span>
                    </td>
                    <td className="actions">
                    <button className="btn" onClick={() => onStockIn(p._id)}>Nhập kho nhanh</button>
                    <button className="btn special" onClick={() => openModal(p._id)}>Nhập NCC</button>
                    <button className="btn outline" onClick={() => onStockSet(p._id)}>Đặt tồn</button>
                    </td>
                </tr>
                );
            })}
            {!filtered.length && (
                <tr><td colSpan={5} className="no-data">Không có dữ liệu</td></tr>
            )}
            </tbody>
        </table>

        {showModal && (
            <div className="modal-backdrop">
                <div className="modal">
                    <h3>Nhập kho từ Nhà cung cấp</h3>

                    <label>Nhà cung cấp:</label>
                    <div className="supplier-select">
                        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                            <option value="">-- Chọn --</option>
                            {suppliers.map((s) => (
                            <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            className="btn add-supplier"
                            onClick={() => setShowAddSupplier(true)}
                            >
                            ➕
                        </button>

                    </div>
                    <label>Số lượng:</label>
                    <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)} />

                    <label>Đơn giá nhập:</label>
                    <input type="number"  min="0" value={unitPrice} onChange={(e) => setUnitPrice(parseInt(e.target.value, 10) || 0)} />

                    <label>Ghi chú:</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} />

                    <div className="modal-actions">
                    <button className="btn special" onClick={handleSubmitInvoice}>Lưu phiếu</button>
                    <button className="btn outline" onClick={() => setShowModal(false)}>Hủy</button>
                    </div>
                </div>
            </div>
        )}
        {showAddSupplier && (
            <div className="modal-backdrop">
                <div className="modal">
                <h3>Thêm Nhà cung cấp mới</h3>

                <label>Tên NCC:</label>
                <input
                    type="text"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                />

                <label>Người liên hệ:</label>
                <input
                    type="text"
                    value={supplierForm.contact_name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                />

                <label>Điện thoại:</label>
                <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                />

                <label>Email:</label>
                <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                />

                <label>Địa chỉ:</label>
                <textarea
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                />

                <div className="modal-actions">
                    <button
                        className="btn special"
                        onClick={async () => {
                            if (!supplierForm.name.trim()) {
                                alert("Tên NCC là bắt buộc!");
                                return;
                            }
                            if (!/^(0|\+84)\d{9}$/.test(supplierForm.phone)) {
                                alert("Số điện thoại không hợp lệ! Định dạng: 0xxxxxxxxx hoặc +84xxxxxxxxx");
                                return;
                            }
                            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierForm.email)) {
                                alert("Email không hợp lệ!");
                                return;
                            }

                            try {
                            const newS = await addSupplier(supplierForm);
                            setSuppliers([...suppliers, newS]);
                            setSupplierId(newS._id); // chọn luôn NCC vừa tạo
                            setShowAddSupplier(false);
                            setSupplierForm({ name: "", contact_name: "", phone: "", email: "", address: "" });
                            alert("Đã thêm NCC thành công!");
                            } catch (e) {
                            alert(e.message || "Lỗi thêm NCC!");
                            }
                        }}
                    >
                    Lưu NCC
                    </button>
                    <button className="btn outline" onClick={() => setShowAddSupplier(false)}>
                    Hủy
                    </button>
                </div>
                </div>
            </div>
        )}

        </div>
    );
};

export default memo(StockManagerPage);
