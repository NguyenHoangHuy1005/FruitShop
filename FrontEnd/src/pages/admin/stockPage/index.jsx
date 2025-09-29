import { memo, useEffect, useMemo, useState, useCallback } from "react";
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

/* --------------------- Modal Quản lý NCC --------------------- */
function SupplierManagerModal({
    open,
    onClose,
    suppliers,
    onPick,         // (supplier) => void
    onAddSuccess,   // (newSupplier) => void
    initialTab = "list", // "list" | "add"
    }) {
    const [tab, setTab] = useState(initialTab);
    const [filters, setFilters] = useState({ name: "", phone: "", email: "" });
    const [form, setForm] = useState({
        name: "",
        contact_name: "",
        phone: "",
        email: "",
        address: "",
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setTab(initialTab);
            setFilters({ name: "", phone: "", email: "" });
            setForm({ name: "", contact_name: "", phone: "", email: "", address: "" });
            setError("");
        }
    }, [open, initialTab]);

    const filtered = useMemo(() => {
        const n = filters.name.trim().toLowerCase();
        const p = filters.phone.trim().toLowerCase();
        const e = filters.email.trim().toLowerCase();
        return (Array.isArray(suppliers) ? suppliers : []).filter((s) => {
        const okName = !n || (s.name || "").toLowerCase().includes(n);
        const okPhone = !p || (s.phone || "").toLowerCase().includes(p);
        const okEmail = !e || (s.email || "").toLowerCase().includes(e);
        return okName && okPhone && okEmail;
        });
    }, [suppliers, filters]);

    const validate = () => {
        if (!form.name.trim()) return "Tên NCC là bắt buộc.";
        if (!/^(0|\+84)\d{9}$/.test(form.phone || "")) return "Số điện thoại không hợp lệ (0xxxxxxxxx hoặc +84xxxxxxxxx).";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || "")) return "Email không hợp lệ.";
        return "";
    };

    const handleAdd = async () => {
        const msg = validate();
        if (msg) {
            setError(msg);
            return;
        }
        setBusy(true);
        setError("");
        try {
            const created = await addSupplier(form);
            onAddSuccess?.(created);
            // Sau khi thêm, chuyển sang tab danh sách và highlight lựa chọn
            setTab("list");
            setForm({ name: "", contact_name: "", phone: "", email: "", address: "" });
        } catch (e) {
            setError(e?.message || "Lỗi thêm NCC!");
        } finally {
            setBusy(false);
        }
    };

    if (!open) return null;
    return (
        <div className="modal-backdrop">
            <div className="modal modal-lg">
                <div className="modal-header">
                    <h3>Quản lý Nhà cung cấp</h3>
                    <div className="tabs">
                        <button
                            className={`tab ${tab === "list" ? "active" : ""}`}
                            onClick={() => setTab("list")}
                            >
                            Danh sách
                        </button>
                        <button
                            className={`tab ${tab === "add" ? "active" : ""}`}
                            onClick={() => setTab("add")}
                            >
                            Thêm mới
                        </button>
                    </div>
                </div>

                {tab === "list" && (
                <>
                    <div className="filters">
                        <input
                            placeholder="Lọc theo tên..."
                            value={filters.name}
                            onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                        />
                        <input
                            placeholder="Lọc theo điện thoại..."
                            value={filters.phone}
                            onChange={(e) => setFilters((f) => ({ ...f, phone: e.target.value }))}
                        />
                        <input
                            placeholder="Lọc theo email..."
                            value={filters.email}
                            onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
                        />
                    </div>

                    <div className="supplier-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tên NCC</th>
                                    <th>Liên hệ</th>
                                    <th>Điện thoại</th>
                                    <th>Email</th>
                                    <th>Địa chỉ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s) => (
                                    <tr key={s._id}>
                                        <td>{s.name}</td>
                                        <td>{s.contact_name || "—"}</td>
                                        <td>{s.phone}</td>
                                        <td>{s.email}</td>
                                        <td>{s.address || "—"}</td>
                                    </tr>
                                ))}
                                {!filtered.length && (
                                    <tr><td colSpan={5} className="no-data">Không có NCC phù hợp</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
                )}

                {tab === "add" && (
                <>
                    {error && <div className="error">{error}</div>}

                    <label>Tên NCC *</label>
                    <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />

                    <label>Người liên hệ</label>
                    <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    />

                    <label>Điện thoại *</label>
                    <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />

                    <label>Email *</label>
                    <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />

                    <label>Địa chỉ</label>
                    <textarea
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />

                    <div className="modal-actions">
                        <button className="btn special" disabled={busy} onClick={handleAdd}>
                            {busy ? "Đang lưu..." : "Lưu NCC"}
                        </button>
                        <button className="btn outline" onClick={() => setTab("list")}>Hủy</button>
                    </div>
                </>
                )}

                <div className="modal-actions mt-8">
                    <button className="btn outline" onClick={onClose}>Đóng</button>
                </div>
            </div>
        </div>
    );
}

/* --------------------- Trang Quản lý Tồn kho --------------------- */
const StockManagerPage = () => {
    const dispatch = useDispatch();
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);

    const [suppliers, setSuppliers] = useState([]);

    // modal nhập phiếu
    const [showModal, setShowModal] = useState(false);
    const [supplierId, setSupplierId] = useState("");
    const [productId, setProductId] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [unitPrice, setUnitPrice] = useState(0);
    const [note, setNote] = useState("");

    // modal quản lý NCC (hợp nhất danh sách + thêm mới)
    const [supplierManager, setSupplierManager] = useState({ open: false, initialTab: "list" });

    const openSupplierManager = useCallback((tab = "list") => {
        setSupplierManager({ open: true, initialTab: tab });
    }, []);

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
            setSuppliers(Array.isArray(s) ? s : []);
        } catch (e) {
            console.error("Lỗi load suppliers:", e);
        }
        })();
    }, []);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter((r) => (r.productDoc?.name || "").toLowerCase().includes(s));
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
        } catch (e) {
        alert(e.message || "Lỗi nhập kho!");
        } finally {
        setBusy(false);
        }
    };

    // khi nhập SL mà chưa chọn NCC => bật modal quản lý NCC ở tab "add"
    const handleQuantityFocus = () => {
        if (!supplierId) openSupplierManager("add");
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

                {/* Nút Quản lý NCC moved ra ngoài, cùng hàng với ô tìm SP */}
                <button
                    className="btn outline"
                    onClick={() => openSupplierManager("list")}
                    title="Quản lý/Thêm NCC"
                >
                    Quản lý NCC
                </button>

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

            {/* Modal nhập kho từ NCC */}
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
                        </div>

                        <label>Số lượng:</label>
                        <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                        />

                        <label>Đơn giá nhập:</label>
                        <input
                        type="number"
                        min="0"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(parseInt(e.target.value, 10) || 0)}
                        />

                        <label>Ghi chú:</label>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} />

                        <div className="modal-actions">
                            <button className="btn special" onClick={handleSubmitInvoice}>Lưu phiếu</button>
                            <button className="btn outline" onClick={() => setShowModal(false)}>Hủy</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Quản lý NCC (danh sách + thêm mới) */}
            <SupplierManagerModal
                open={supplierManager.open}
                initialTab={supplierManager.initialTab}
                suppliers={suppliers}
                onClose={() => setSupplierManager({ open: false, initialTab: "list" })}
                onAddSuccess={(newS) => {
                    setSuppliers((prev) => [...prev, newS]);
                }}
            />
        </div>
    );
};

export default memo(StockManagerPage);
