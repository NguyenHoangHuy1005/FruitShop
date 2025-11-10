import { memo, useEffect, useMemo, useState, useCallback } from "react";
import "./style.scss";
import {
    listStock,
    stockIn,
    getAllProduct,
    stockInWithInvoice,
    getAllSuppliers,
    addSupplier,
    getBatchDetails,
} from "../../../component/redux/apiRequest";
import { useDispatch } from "react-redux";
import ImportForm from "../../../component/modals/ImportModal/ImportForm";

/* --------------------- Modal Quản lý NCC --------------------- */
function SupplierManagerModal({
    open,
    onClose,
    suppliers,
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
    const [batchRows, setBatchRows] = useState([]); // Dữ liệu chi tiết từng lô
    const [viewMode, setViewMode] = useState("summary"); // "summary" hoặc "batches"
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);
    const [sortOrder, setSortOrder] = useState("asc"); // "asc" hoặc "desc" cho tồn kho
    const [soldSortOrder, setSoldSortOrder] = useState("default"); // "default", "asc" hoặc "desc" cho đã bán

    const [suppliers, setSuppliers] = useState([]);

    // modal nhập phiếu
    const [showModal, setShowModal] = useState(false);
    const [productId, setProductId] = useState("");

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

    const loadBatchDetails = async () => {
        setBusy(true);
        try {
        const data = await getBatchDetails();
        setBatchRows(Array.isArray(data) ? data : []);
        } finally {
        setBusy(false);
        }
    };

    useEffect(() => { 
        load();
        loadBatchDetails();
    }, []);
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

    // Tính số lô hiệu lực cho mỗi sản phẩm
    const getValidBatchCount = useCallback((productId) => {
        if (!productId || !batchRows.length) return 0;
        
        const now = new Date();
        
        // Lọc các lô theo productId và còn hàng
        const productBatches = batchRows.filter(batch => 
            batch.productId === productId && 
            batch.remainingQuantity > 0
        );
        
        // Lọc các lô còn hiệu lực (chưa hết hạn)
        const validBatches = productBatches.filter(batch => {
            if (!batch.expiryDate) return true; // Không có HSD = còn hiệu lực
            const expiryDate = new Date(batch.expiryDate);
            return expiryDate > now; // Chưa hết hạn
        });
        
        return validBatches.length;
    }, [batchRows]);

    // Tính tổng số lượng tồn kho thực tế từ các lô hàng
    const getActualStock = useCallback((productId) => {
        if (!productId || !batchRows.length) return 0;
        
        // Tổng tất cả remainingQuantity của sản phẩm này
        const totalRemaining = batchRows
            .filter(batch => batch.productId === productId)
            .reduce((sum, batch) => sum + (batch.remainingQuantity || 0), 0);
        
        return totalRemaining;
    }, [batchRows]);

    // Tính trạng thái cho trang tổng quan (dựa vào số lượng tồn kho)
    const getStockStatus = useCallback((productId) => {
        const stock = getActualStock(productId);
        
        if (stock <= 0) {
            return { class: 'out-stock', text: 'Hết hàng' };
        } else if (stock < 5) {
            return { class: 'low-stock', text: 'Sắp hết hàng' };
        } else {
            return { class: 'in-stock', text: 'Còn hàng' };
        }
    }, [getActualStock]);

    // Tính thống kê lô hàng
    const getBatchStatistics = useCallback((batches) => {
        const now = new Date();
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        let validCount = 0;
        let expiringCount = 0;
        let expiredCount = 0;
        
        batches.forEach(batch => {
            if (batch.remainingQuantity <= 0) {
                // Hết hàng
                expiredCount++;
            } else if (!batch.expiryDate) {
                // Không có hạn sử dụng = còn hiệu lực
                validCount++;
            } else {
                const expiryDate = new Date(batch.expiryDate);
                if (expiryDate <= now) {
                    // Đã hết hạn
                    expiredCount++;
                } else if (expiryDate <= oneWeekFromNow) {
                    // Sắp hết hạn
                    expiringCount++;
                } else {
                    // Còn hiệu lực
                    validCount++;
                }
            }
        });
        
        return {
            total: batches.length,
            valid: validCount,
            expiring: expiringCount,
            expired: expiredCount
        };
    }, []);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        let result;
        
        if (viewMode === "summary") {
            result = !s ? rows : rows.filter((r) => (r.productDoc?.name || "").toLowerCase().includes(s));
            
            // Sắp xếp theo tồn kho chính, sau đó theo trạng thái (cho trang tổng quan)
            result.sort((a, b) => {
                const aStock = getActualStock(a.productDoc?._id);
                const bStock = getActualStock(b.productDoc?._id);
                
                // Sắp xếp theo tồn kho trước
                if (sortOrder === "asc") {
                    if (aStock !== bStock) {
                        return aStock - bStock; // Tăng dần
                    }
                } else {
                    if (aStock !== bStock) {
                        return bStock - aStock; // Giảm dần
                    }
                }
                
                // Nếu tồn kho bằng nhau, sắp xếp theo trạng thái
                const statusPriority = {
                    'out-stock': 0,      // Hết hàng - ưu tiên cao nhất
                    'low-stock': 1,      // Sắp hết hàng - ưu tiên cao
                    'in-stock': 2        // Còn hàng - ưu tiên thấp
                };
                
                const aStatus = getStockStatus(a.productDoc?._id);
                const bStatus = getStockStatus(b.productDoc?._id);
                
                const aPriority = statusPriority[aStatus.class] ?? 3;
                const bPriority = statusPriority[bStatus.class] ?? 3;
                
                if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                }
                
                // Cuối cùng sắp xếp theo tên
                return (a.productDoc?.name || "").localeCompare(b.productDoc?.name || "");
            });
        } else {
            result = !s ? batchRows : batchRows.filter((r) => 
                (r.productName || "").toLowerCase().includes(s) ||
                (r.supplierName || "").toLowerCase().includes(s)
            );
            
            // Sắp xếp theo bộ lọc được chọn
            result.sort((a, b) => {
                // Nếu chọn sắp xếp theo đã bán
                if (soldSortOrder !== "default") {
                    const aSold = a.soldQuantity || 0;
                    const bSold = b.soldQuantity || 0;
                    
                    if (soldSortOrder === "desc") {
                        // Chạy nhất (đã bán nhiều → ít)
                        if (aSold !== bSold) {
                            return bSold - aSold;
                        }
                    } else {
                        // Chậm nhất (đã bán ít → nhiều)
                        if (aSold !== bSold) {
                            return aSold - bSold;
                        }
                    }
                }
                
                // Sắp xếp theo trạng thái hết hạn (mặc định hoặc khi đã bán bằng nhau)
                const now = new Date();
                
                // Nếu không có ngày hết hạn, xếp cuối
                if (!a.expiryDate && !b.expiryDate) return 0;
                if (!a.expiryDate) return 1;
                if (!b.expiryDate) return -1;
                
                const aExpiry = new Date(a.expiryDate);
                const bExpiry = new Date(b.expiryDate);
                
                const aDaysLeft = Math.ceil((aExpiry - now) / (24 * 60 * 60 * 1000));
                const bDaysLeft = Math.ceil((bExpiry - now) / (24 * 60 * 60 * 1000));
                
                const getStatus = (daysLeft) => {
                    if (daysLeft <= 0) return 'expired';
                    if (daysLeft <= 7) return 'expiring';
                    return 'valid';
                };
                
                const aStatus = getStatus(aDaysLeft);
                const bStatus = getStatus(bDaysLeft);
                
                const statusPriority = { 'expired': 0, 'expiring': 1, 'valid': 2 };
                
                if (aStatus !== bStatus) {
                    return statusPriority[aStatus] - statusPriority[bStatus];
                }
                
                return aExpiry - bExpiry;
            });
        }
        
        return result;
    }, [rows, batchRows, q, viewMode, sortOrder, soldSortOrder, getStockStatus, getActualStock, getBatchStatistics]);

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

    const openModal = (pid) => {
        setProductId(pid);
        setShowModal(true);
    };

    // Lấy thông tin sản phẩm hiện tại
    const currentProduct = useMemo(() => {
        return rows.find(row => row.productDoc?._id === productId)?.productDoc;
    }, [rows, productId]);

    const handleSubmitInvoice = async (formData) => {
        setBusy(true);
        try {
            const res = await stockInWithInvoice({
                supplierId: formData.supplierId,
                items: [{ 
                    productId, 
                    quantity: formData.quantity, 
                    unitPrice: formData.unitPrice,
                    importDate: formData.importDate,
                    expiryDate: formData.expiryDate || null
                }],
                note: formData.note,
            });
            alert(`Đã tạo phiếu nhập thành công! Mã hóa đơn: ${res.receiptId}`);
            setShowModal(false);
            await load();
            await loadBatchDetails();
            await getAllProduct(dispatch);
        } catch (e) {
            alert(e.message || "Lỗi nhập kho!");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="container stock-manager">
            <h2>QUẢN LÝ KHO HÀNG</h2>
            <div className="toolbar">
                <input
                    type="text"
                    placeholder={viewMode === "summary" ? "Tìm theo tên sản phẩm..." : "Tìm theo tên sản phẩm hoặc nhà cung cấp..."}
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
            {/* Thống kê số lô - hiển thị ở cả hai trang */}
            {(() => {
                const stats = getBatchStatistics(batchRows);
                return (
                    <div className="batch-statistics">
                        <div className="stat-card total">
                            <div className="stat-icon">📦</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.total}</div>
                                <div className="stat-label">Tổng số lô</div>
                            </div>
                        </div>
                        
                        <div className="stat-card valid">
                            <div className="stat-icon">✅</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.valid}</div>
                                <div className="stat-label">Lô còn hiệu lực</div>
                            </div>
                        </div>
                        
                        <div className="stat-card expiring">
                            <div className="stat-icon">⚠️</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.expiring}</div>
                                <div className="stat-label">Lô sắp hết hạn</div>
                            </div>
                        </div>
                        
                        <div className="stat-card expired">
                            <div className="stat-icon">❌</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.expired}</div>
                                <div className="stat-label">Lô hết hạn/hết hàng</div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <div className="view-mode-toggle">
                <div className="toggle-buttons">
                    <button
                        className={`toggle-btn ${viewMode === "summary" ? "active" : ""}`}
                        onClick={() => setViewMode("summary")}
                    >
                        Tổng quan kho
                    </button>
                    <button
                        className={`toggle-btn ${viewMode === "batches" ? "active" : ""}`}
                        onClick={() => setViewMode("batches")}
                    >
                        Chi tiết lô hàng
                    </button>
                </div>

                <div className="filter-section">
                    {/* Bộ lọc sắp xếp chỉ hiển thị ở trang tổng quan */}
                    {viewMode === "summary" && (
                        <div className="sort-filters">
                            <label>Sắp xếp tồn kho:</label>
                            <select 
                                value={sortOrder} 
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="sort-select"
                            >
                                <option value="asc">Tăng dần</option>
                                <option value="desc">Giảm dần</option>
                            </select>
                        </div>
                    )}
                    
                    {/* Bộ lọc đã bán - chỉ hiển thị ở trang chi tiết lô hàng */}
                    {viewMode === "batches" && (
                        <div className="sort-filters">
                            <label>Đã bán:</label>
                            <select 
                                value={soldSortOrder} 
                                onChange={(e) => setSoldSortOrder(e.target.value)}
                                className="sort-select"
                            >
                                <option value="default">Mặc định</option>
                                <option value="desc">Chạy nhất</option>
                                <option value="asc">Chậm nhất</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>
            {viewMode === "summary" ? (
                <table className="stock-table">
                    <thead>
                        <tr>
                            <th>Ảnh</th>
                            <th>Tên sản phẩm</th>
                            <th>Tồn hiện tại</th>
                            <th>Số lô</th>
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
                                <td><b>{getActualStock(p._id)}</b></td>
                                <td>
                                    <span className="batch-count">
                                        {getValidBatchCount(p._id)} lô
                                    </span>
                                </td>
                                <td>
                                    {(() => {
                                        const status = getStockStatus(p._id);
                                        return (
                                            <span className={`status ${status.class}`}>
                                                {status.text}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td className="actions">
                                    <button className="btn" onClick={() => onStockIn(p._id)}>Nhập kho nhanh</button>
                                    <button className="btn special" onClick={() => openModal(p._id)}>Nhập NCC</button>
                                </td>
                            </tr>
                            );
                        })}
                        {!filtered.length && (
                            <tr><td colSpan={6} className="no-data">Không có dữ liệu</td></tr>
                        )}
                    </tbody>
                </table>
            ) : (
                <>
                <table className="batch-table">
                    <thead>
                        <tr>
                            <th>Ảnh</th>
                            <th>Tên sản phẩm</th>
                            <th>Nhà cung cấp</th>
                            <th>SL ban đầu</th>
                            <th>Còn lại</th>
                            <th>Đã bán</th>
                            <th>Đơn giá nhập</th>
                            <th>Ngày nhập</th>
                            <th>Hạn sử dụng</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((batch) => {
                            const img = batch.productImage || "/placeholder.png";
                            const formatDate = (dateStr) => {
                                try {
                                    return new Date(dateStr).toLocaleDateString("vi-VN");
                                } catch {
                                    return "N/A";
                                }
                            };
                            
                            const getStatusClass = () => {
                                const now = new Date();
                                const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                                
                                if (batch.remainingQuantity <= 0) return "out-stock";
                                if (batch.expiryDate) {
                                    const expiryDate = new Date(batch.expiryDate);
                                    if (expiryDate < now) return "expired";
                                    if (expiryDate <= oneWeekFromNow) return "expiring";
                                    return "valid";
                                }
                                return "in-stock";
                            };
                            
                            const getStatusText = () => {
                                const now = new Date();
                                const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                                
                                if (batch.remainingQuantity <= 0) return "Hết hàng";
                                if (batch.expiryDate) {
                                    const expiryDate = new Date(batch.expiryDate);
                                    if (expiryDate < now) return "Hết hạn";
                                    if (expiryDate <= oneWeekFromNow) return "Sắp hết hạn";
                                    return "Còn hạn";
                                }
                                return "Còn hàng";
                            };

                            return (
                            <tr key={batch._id} className={`batch-row ${getStatusClass()}`}>
                                <td>
                                    <img
                                        src={img}
                                        alt={batch.productName || ""}
                                        style={{ width: 56, height: 56, objectFit: "cover" }}
                                    />
                                </td>
                                <td><strong>{batch.productName}</strong></td>
                                <td>{batch.supplierName}</td>
                                <td><b>{batch.batchQuantity}</b></td>
                                <td><b className={getStatusClass()}>{batch.remainingQuantity}</b></td>
                                <td><span style={{color: "#7c3aed"}}>{batch.soldQuantity}</span></td>
                                <td><b style={{color: "#008874"}}>{batch.unitPrice?.toLocaleString()} ₫</b></td>
                                <td>{formatDate(batch.importDate)}</td>
                                <td>
                                    {batch.expiryDate ? (
                                        <span className={getStatusClass()}>
                                            {formatDate(batch.expiryDate)}
                                        </span>
                                    ) : (
                                        <span style={{color: "#94a3b8", fontStyle: "italic"}}>Không có</span>
                                    )}
                                </td>
                                <td>
                                    <span className={`status ${getStatusClass()}`}>
                                        {getStatusText()}
                                    </span>
                                </td>
                            </tr>
                            );
                        })}
                        {!filtered.length && (
                            <tr><td colSpan={10} className="no-data">Không có dữ liệu</td></tr>
                        )}
                    </tbody>
                </table>
                </>
            )}

            {/* Modal nhập kho từ NCC */}
            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal modal-import">
                        <ImportForm
                            suppliers={suppliers}
                            productName={currentProduct?.name || ""}
                            onSubmit={handleSubmitInvoice}
                            onCancel={() => setShowModal(false)}
                            busy={busy}
                        />
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
