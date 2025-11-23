import { memo, useEffect, useMemo, useState, useCallback } from "react";
import "./style.scss";
import {
    listStock,
    stockIn,
    stockOut,
    getAllProduct,
    stockInWithInvoice,
    getAllSuppliers,
    addSupplier,
    getBatchDetails,
    updateBatchQuantity,
    getWarehouses,
    addWarehouse,
} from "../../../component/redux/apiRequest";
import { useDispatch } from "react-redux";
import ImportForm from "../../../component/modals/ImportModal/ImportForm";

const NAME_WITH_NUMBER_REGEX = /^[\p{L}\d\s]+$/u;
const CONTACT_NAME_REGEX = /^[\p{L}\s]+$/u;
const PHONE_REGEX = /^\d{10}$/;
const GMAIL_REGEX = /^[A-Za-z0-9]+@gmail\.com$/i;
const sanitizePhoneInput = (value) => (value || "").replace(/\D/g, "").slice(0, 10);

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
    const [fieldErrors, setFieldErrors] = useState({});
    const [touched, setTouched] = useState({});

    useEffect(() => {
        if (open) {
            setTab(initialTab);
            setFilters({ name: "", phone: "", email: "" });
            setForm({ name: "", contact_name: "", phone: "", email: "", address: "" });
            setError("");
            setFieldErrors({});
            setTouched({});
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

    const validateField = (field, rawValue) => {
        const value = (rawValue || "").trim();
        switch (field) {
        case "name":
            if (!value) return "Tên NCC là bắt buộc.";
            if (!NAME_WITH_NUMBER_REGEX.test(value)) return "Tên NCC chỉ được chứa chữ, số và dấu cách.";
            return "";
        case "phone": {
            const normalized = sanitizePhoneInput(value);
            if (!normalized) return "Số điện thoại là bắt buộc.";
            if (!PHONE_REGEX.test(normalized)) return "Số điện thoại phải gồm đúng 10 chữ số.";
            return "";
        }
        case "email": {
            if (!value) return "Email là bắt buộc.";
            const normalized = value.toLowerCase();
            if (!GMAIL_REGEX.test(normalized)) return "Email phải có dạng ten@gmail.com và không có ký tự đặc biệt.";
            const localPart = normalized.split("@")[0] || "";
            if (!/^[A-Za-z0-9]+$/u.test(localPart)) return "Phần trước @ chỉ được chứa chữ và số.";
            return "";
        }
        case "contact_name":
            if (!value) return "";
            if (!CONTACT_NAME_REGEX.test(value)) return "Tên người phụ trách chỉ được chứa chữ và dấu cách.";
            return "";
        default:
            return "";
        }
    };

    const validateAllFields = () => {
        const nextErrors = {};
        ["name", "phone", "email", "contact_name"].forEach((field) => {
        nextErrors[field] = validateField(field, form[field]);
        });
        return nextErrors;
    };

    const handleFieldChange = (field) => (event) => {
        let value = event.target.value;
        if (field === "phone") value = sanitizePhoneInput(value);
        setForm((prev) => ({ ...prev, [field]: value }));
        setError("");
        if (touched[field]) {
        setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
        }
    };

    const handleFieldBlur = (field) => () => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }));
    };

    const hasFieldError = (field) => touched[field] && fieldErrors[field];
    const handleAdd = async () => {
        const nextErrors = validateAllFields();
        const hasErrors = Object.values(nextErrors).some(Boolean);
        if (hasErrors) {
            setFieldErrors(nextErrors);
            setTouched((prev) => ({
                ...prev,
                name: true,
                phone: true,
                email: true,
                contact_name: prev.contact_name || !!form.contact_name.trim(),
            }));
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
            setError(e?.message || "Lỗi thêm nhà cung cấp!");
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
                    className={hasFieldError("name") ? "input-error" : ""}
                    value={form.name}
                    onChange={handleFieldChange("name")}
                    onBlur={handleFieldBlur("name")}
                    />
                    {hasFieldError("name") && (
                        <small className="field-error-text">{fieldErrors.name}</small>
                    )}

                    <label>Người liên hệ</label>
                    <input
                    type="text"
                    className={hasFieldError("contact_name") ? "input-error" : ""}
                    value={form.contact_name}
                    onChange={handleFieldChange("contact_name")}
                    onBlur={handleFieldBlur("contact_name")}
                    />
                    {hasFieldError("contact_name") && (
                        <small className="field-error-text">{fieldErrors.contact_name}</small>
                    )}

                    <label>Điện thoại *</label>
                    <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    className={hasFieldError("phone") ? "input-error" : ""}
                    value={form.phone}
                    onChange={handleFieldChange("phone")}
                    onBlur={handleFieldBlur("phone")}
                    />
                    {hasFieldError("phone") && (
                        <small className="field-error-text">{fieldErrors.phone}</small>
                    )}

                    <label>Email *</label>
                    <input
                    type="email"
                    className={hasFieldError("email") ? "input-error" : ""}
                    value={form.email}
                    onChange={handleFieldChange("email")}
                    onBlur={handleFieldBlur("email")}
                    />
                    {hasFieldError("email") && (
                        <small className="field-error-text">{fieldErrors.email}</small>
                    )}

                    <label>Địa chỉ</label>
                    <textarea
                    value={form.address}
                    onChange={(e) => {
                            setError("");
                            setForm({ ...form, address: e.target.value });
                        }}
                    />

                    <div className="modal-actions">
                        <button className="btn special" disabled={busy} onClick={handleAdd}>
                            {busy ? "Đang lưu..." : "Lưu nhà cung cấp"}
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

/* --------------------- Modal Quản lý kho --------------------- */
function WarehouseManagerModal({
    open,
    onClose,
    warehouses,
    onAddSuccess,
    initialTab = "list",
}) {
    const [tab, setTab] = useState(initialTab);
    const [filters, setFilters] = useState({ name: "", address: "", phone: "" });
    const [form, setForm] = useState({
        name: "",
        address: "",
        phone: "",
        contactName: "",
        note: "",
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [touched, setTouched] = useState({});

    useEffect(() => {
        if (open) {
            setTab(initialTab);
            setFilters({ name: "", address: "", phone: "" });
            setForm({
                name: "",
                address: "",
                phone: "",
                contactName: "",
                note: "",
            });
            setError("");
            setFieldErrors({});
            setTouched({});
        }
    }, [open, initialTab]);

    const filtered = useMemo(() => {
        const name = filters.name.trim().toLowerCase();
        const addr = filters.address.trim().toLowerCase();
        const phone = filters.phone.trim().toLowerCase();
        return (Array.isArray(warehouses) ? warehouses : []).filter((w) => {
            const okName = !name || (w.name || "").toLowerCase().includes(name);
            const okAddr = !addr || (w.address || "").toLowerCase().includes(addr);
            const okPhone = !phone || (w.phone || "").toLowerCase().includes(phone);
            return okName && okAddr && okPhone;
        });
    }, [warehouses, filters]);

    const validateField = (field, rawValue) => {
        const value = (rawValue || "").trim();
        switch (field) {
        case "name":
            if (!value) return "Tên kho là bắt buộc.";
            if (!NAME_WITH_NUMBER_REGEX.test(value)) return "Tên kho chỉ được chứa chữ, số và dấu cách.";
            return "";
        case "address":
            if (!value) return "Địa chỉ kho là bắt buộc.";
            return "";
        case "phone": {
            const normalized = sanitizePhoneInput(value);
            if (!normalized) return "Số điện thoại là bắt buộc.";
            if (!PHONE_REGEX.test(normalized)) return "Số điện thoại phải gồm đúng 10 chữ số.";
            return "";
        }
        case "contactName":
            if (!value) return "";
            if (!CONTACT_NAME_REGEX.test(value)) return "Tên người phụ trách chỉ được chứa chữ và dấu cách.";
            return "";
        default:
            return "";
        }
    };

    const validateAllFields = () => {
        const nextErrors = {};
        ["name", "address", "phone", "contactName"].forEach((field) => {
        nextErrors[field] = validateField(field, form[field]);
        });
        return nextErrors;
    };

    const handleFieldChange = (field) => (event) => {
        let value = event.target.value;
        if (field === "phone") value = sanitizePhoneInput(value);
        setForm((prev) => ({ ...prev, [field]: value }));
        setError("");
        if (touched[field]) {
        setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
        }
    };

    const handleFieldBlur = (field) => () => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }));
    };

    const hasFieldError = (field) => touched[field] && fieldErrors[field];
    const handleAdd = async () => {
        const nextErrors = validateAllFields();
        const hasErrors = Object.values(nextErrors).some(Boolean);
        if (hasErrors) {
            setFieldErrors(nextErrors);
            setTouched((prev) => ({
                ...prev,
                name: true,
                address: true,
                phone: true,
                contactName: prev.contactName || !!form.contactName.trim(),
            }));
            return;
        }
        setBusy(true);
        setError("");
        try {
            const created = await addWarehouse({
                name: form.name,
                address: form.address,
                phone: form.phone,
                contactName: form.contactName,
                note: form.note,
            });
            onAddSuccess?.(created);
            setTab("list");
            setForm({ name: "", address: "", phone: "", contactName: "", note: "" });
        } catch (err) {
            setError(err?.message || "Lỗi lưu kho.");
        } finally {
            setBusy(false);
        }
    };

    if (!open) return null;
    return (
        <div className="modal-backdrop">
            <div className="modal modal-lg">
                <div className="modal-header">
                    <h3>Quản lý kho</h3>
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
                                placeholder="Lọc theo địa chỉ..."
                                value={filters.address}
                                onChange={(e) => setFilters((f) => ({ ...f, address: e.target.value }))}
                            />
                            <input
                                placeholder="Lọc theo số điện thoại..."
                                value={filters.phone}
                                onChange={(e) => setFilters((f) => ({ ...f, phone: e.target.value }))}
                            />
                        </div>

                        <div className="supplier-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Tên kho</th>
                                        <th>Địa chỉ</th>
                                        <th>Số điện thoại</th>
                                        <th>Người phụ trách</th>
                                        <th>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((w) => (
                                        <tr key={w._id}>
                                            <td>{w.name}</td>
                                            <td>{w.address}</td>
                                            <td>{w.phone || "—"}</td>
                                            <td>{w.contactName || "—"}</td>
                                            <td>{w.note || "—"}</td>
                                        </tr>
                                    ))}
                                    {!filtered.length && (
                                        <tr><td colSpan={5} className="no-data">Không có kho phù hợp</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                                {tab === "add" && (
                <>
                    {error && <div className="error">{error}</div>}

                    <label>Tên kho *</label>
                    <input
                        type="text"
                        className={hasFieldError("name") ? "input-error" : ""}
                        value={form.name}
                        onChange={handleFieldChange("name")}
                        onBlur={handleFieldBlur("name")}
                    />
                    {hasFieldError("name") && (
                        <small className="field-error-text">{fieldErrors.name}</small>
                    )}

                    <label>Địa chỉ *</label>
                    <textarea
                        className={hasFieldError("address") ? "input-error" : ""}
                        value={form.address}
                        onChange={handleFieldChange("address")}
                        onBlur={handleFieldBlur("address")}
                    />
                    {hasFieldError("address") && (
                        <small className="field-error-text">{fieldErrors.address}</small>
                    )}

                    <label>Sốđiện thoại *</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        className={hasFieldError("phone") ? "input-error" : ""}
                        value={form.phone}
                        onChange={handleFieldChange("phone")}
                        onBlur={handleFieldBlur("phone")}
                    />
                    {hasFieldError("phone") && (
                        <small className="field-error-text">{fieldErrors.phone}</small>
                    )}

                    <label>Người phụ trách</label>
                    <input
                        type="text"
                        className={hasFieldError("contactName") ? "input-error" : ""}
                        value={form.contactName}
                        onChange={handleFieldChange("contactName")}
                        onBlur={handleFieldBlur("contactName")}
                    />
                    {hasFieldError("contactName") && (
                        <small className="field-error-text">{fieldErrors.contactName}</small>
                    )}

                    <label>Ghi chú</label>
                    <textarea
                        value={form.note}
                        onChange={(e) => {
                                setError("");
                                setForm({ ...form, note: e.target.value });
                            }}
                    />

                    <div className="modal-actions">
                        <button className="btn special" disabled={busy} onClick={handleAdd}>
                            {busy ? "Đang lưu..." : "Lưu kho"}
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
    const [filterStatus, setFilterStatus] = useState("all"); // "all", "valid", "expiring", "expired", "soldout"

    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    // modal nhập phiếu
    const [showModal, setShowModal] = useState(false);
    const [productId, setProductId] = useState("");

    // modal quản lý NCC (hợp nhất danh sách + thêm mới)
    const [supplierManager, setSupplierManager] = useState({ open: false, initialTab: "list" });
    const [warehouseManager, setWarehouseManager] = useState({ open: false, initialTab: "list" });

    const openSupplierManager = useCallback((tab = "list") => {
        setSupplierManager({ open: true, initialTab: tab });
    }, []);
    const openWarehouseManager = useCallback((tab = "list") => {
        setWarehouseManager({ open: true, initialTab: tab });
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
    useEffect(() => {
        (async () => {
        try {
            const w = await getWarehouses();
            setWarehouses(Array.isArray(w) ? w : []);
        } catch (e) {
            console.error("Lỗi load warehouses:", e);
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

        const now = new Date();

        // Tổng remainingQuantity chỉ từ các lô còn hiệu lực (chưa hết hạn) và còn > 0
        const totalRemaining = batchRows
            .filter(batch => batch.productId === productId)
            .filter(batch => {
                // ignore batches with no remaining quantity
                const rem = batch.remainingQuantity || 0;
                if (rem <= 0) return false;

                // if no expiry date -> still valid
                if (!batch.expiryDate) return true;

                // otherwise only count if expiryDate > now
                const expiryDate = new Date(batch.expiryDate);
                return expiryDate > now;
            })
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
        let soldOutCount = 0;
        
        batches.forEach(batch => {
            // Kiểm tra bán hết trước (remainingQuantity = 0)
            if (batch.remainingQuantity <= 0) {
                soldOutCount++;
                return;
            }
            
            // Determine status based on expiry date first (time-based), not on remainingQuantity
            if (batch.expiryDate) {
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
            } else {
                // No expiry date -> treat as valid (time-based)
                validCount++;
            }
        });
        
        return {
            total: batches.length,
            valid: validCount,
            expiring: expiringCount,
            expired: expiredCount,
            soldOut: soldOutCount
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
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            result = !s ? batchRows : batchRows.filter((r) => 
                (r.productName || "").toLowerCase().includes(s) ||
                (r.supplierName || "").toLowerCase().includes(s)
            );
            
            // Lọc theo trạng thái nếu không phải "all"
            if (filterStatus !== "all") {
                result = result.filter(batch => {
                    // Bán hết
                    if (filterStatus === "soldout") {
                        return batch.remainingQuantity <= 0;
                    }
                    
                    // Bỏ qua các lô bán hết khi lọc theo trạng thái khác
                    if (batch.remainingQuantity <= 0) {
                        return false;
                    }
                    
                    // Hết hạn
                    if (filterStatus === "expired") {
                        if (!batch.expiryDate) return false;
                        const expiryDate = new Date(batch.expiryDate);
                        return expiryDate <= now;
                    }
                    
                    // Sắp hết hạn
                    if (filterStatus === "expiring") {
                        if (!batch.expiryDate) return false;
                        const expiryDate = new Date(batch.expiryDate);
                        return expiryDate > now && expiryDate <= oneWeekFromNow;
                    }
                    
                    // Còn hiệu lực
                    if (filterStatus === "valid") {
                        if (!batch.expiryDate) return true;
                        const expiryDate = new Date(batch.expiryDate);
                        return expiryDate > oneWeekFromNow;
                    }
                    
                    return true;
                });
            } else {
                // Ẩn các lô hết hạn quá 1 tuần nếu đang ở chế độ "all"
                result = result.filter(batch => {
                    // Giữ lại lô bán hết
                    if (batch.remainingQuantity <= 0) return true;
                    
                    // Ẩn lô hết hạn quá 1 tuần
                    if (batch.expiryDate) {
                        const expiryDate = new Date(batch.expiryDate);
                        if (expiryDate <= now) {
                            // Chỉ hiển thị lô hết hạn trong vòng 1 tuần
                            return expiryDate >= oneWeekAgo;
                        }
                    }
                    
                    return true;
                });
            }
            
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
    }, [rows, batchRows, q, viewMode, sortOrder, soldSortOrder, filterStatus, getStockStatus, getActualStock, getBatchStatistics]);

    const onStockIn = async (productId) => {
        const v = prompt("Nhập số lượng: dùng số dương để tăng, bắt đầu bằng '-' để giảm (ví dụ: -2):", "0");
        if (v === null) return;

        // Trim and validate
        const raw = String(v).trim();
        if (!raw) return;

        // Check for negative adjustment
        const isNegative = raw.startsWith("-");
        // Allow formats like "-2" or "- 2"
        const numeric = parseInt(raw.replace(/[^0-9-]/g, ""), 10);
        if (Number.isNaN(numeric) || numeric === 0) return;

        setBusy(true);
        try {
            if (isNegative) {
                const dec = Math.abs(numeric);
                await stockOut(productId, dec);
                await load();
                await loadBatchDetails();
                await getAllProduct(dispatch, true);
                alert(`Giảm ${dec} đơn vị khỏi tồn kho thành công!`);
            } else {
                const inc = Math.abs(numeric);
                await stockIn(productId, inc);
                await load();
                await loadBatchDetails();
                await getAllProduct(dispatch, true);
                alert(`Tăng ${inc} đơn vị vào tồn kho thành công!`);
            }
        } catch (e) {
            alert(e?.message || "Cập nhật tồn kho thất bại!");
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
            await getAllProduct(dispatch, true);
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
                <button
                    className="btn outline"
                    onClick={() => openWarehouseManager("list")}
                    title="Quản lý kho"
                >
                    Quản lý kho
                </button>

                {busy && <span className="busy">Đang xử lý...</span>}
            </div>
            {/* Thống kê số lô - hiển thị ở cả hai trang, có thể click để lọc */}
            {(() => {
                const stats = getBatchStatistics(batchRows);
                return (
                    <div className="batch-statistics">
                        <div 
                            className={`stat-card total ${filterStatus === "all" ? "active" : ""}`}
                            onClick={() => setFilterStatus("all")}
                            style={{ cursor: 'pointer' }}
                            title="Nhấn để xem tất cả"
                        >
                            <div className="stat-icon">📦</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.total}</div>
                                <div className="stat-label">Tổng số lô</div>
                            </div>
                        </div>
                        
                        <div 
                            className={`stat-card valid ${filterStatus === "valid" ? "active" : ""}`}
                            onClick={() => setFilterStatus("valid")}
                            style={{ cursor: 'pointer' }}
                            title="Nhấn để xem lô còn hiệu lực"
                        >
                            <div className="stat-icon">✅</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.valid}</div>
                                <div className="stat-label">Còn hiệu lực</div>
                            </div>
                        </div>
                        
                        <div 
                            className={`stat-card expiring ${filterStatus === "expiring" ? "active" : ""}`}
                            onClick={() => setFilterStatus("expiring")}
                            style={{ cursor: 'pointer' }}
                            title="Nhấn để xem lô sắp hết hạn"
                        >
                            <div className="stat-icon">⚠️</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.expiring}</div>
                                <div className="stat-label">sắp hết hạn</div>
                            </div>
                        </div>
                        
                        <div 
                            className={`stat-card expired ${filterStatus === "expired" ? "active" : ""}`}
                            onClick={() => setFilterStatus("expired")}
                            style={{ cursor: 'pointer' }}
                            title="Nhấn để xem lô hết hạn"
                        >
                            <div className="stat-icon">❌</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.expired}</div>
                                <div className="stat-label">hết hạn sử dụng</div>
                            </div>
                        </div>
                        
                        <div 
                            className={`stat-card soldout ${filterStatus === "soldout" ? "active" : ""}`}
                            onClick={() => setFilterStatus("soldout")}
                            style={{ cursor: 'pointer' }}
                            title="Nhấn để xem lô bán hết"
                        >
                            <div className="stat-icon">✖️</div>
                            <div className="stat-content">
                                <div className="stat-number">{stats.soldOut}</div>
                                <div className="stat-label">Bán hết</div>
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
                                    <button className="btn special" onClick={() => openModal(p._id)}>Nhập kho</button>
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
                            <th>Hư hại</th>
                            <th>Đã bán</th>
                            <th>Đơn giá nhập</th>
                            <th>Ngày nhập</th>
                            <th>Hạn sử dụng</th>
                            <th>Trạng thái</th>
                            <th>Hành động</th>
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
                                // Kiểm tra bán hết trước
                                if ((batch.remainingQuantity || 0) <= 0) return "soldout";
                                
                                const now = new Date();
                                const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                                // Prefer expiry date to determine status (time-based)
                                if (batch.expiryDate) {
                                    const expiryDate = new Date(batch.expiryDate);
                                    if (expiryDate < now) return "expired";
                                    if (expiryDate <= oneWeekFromNow) return "expiring";
                                    return "valid";
                                }

                                // Fallback when no expiryDate
                                return "in-stock";
                            };

                            const getStatusText = () => {
                                // Kiểm tra bán hết trước
                                if ((batch.remainingQuantity || 0) <= 0) return "Bán hết";
                                
                                const now = new Date();
                                const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                                if (batch.expiryDate) {
                                    const expiryDate = new Date(batch.expiryDate);
                                    if (expiryDate < now) return "Hết hạn";
                                    if (expiryDate <= oneWeekFromNow) return "Sắp hết hạn";
                                    return "Còn hạn";
                                }

                                // Fallback wording when no expiry date
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
                                <td><b style={{color: '#ef4444'}}>{batch.damagedQuantity || 0}</b></td>
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
                                <td>
                                    {(() => {
                                        const statusClass = getStatusClass();
                                        // Hide edit button for expired batches or deleted products
                                        if (statusClass === 'expired' || batch.isProductDeleted) return null;

                                        return (
                                            <button
                                                className="btn"
                                                onClick={async () => {
                                                    // Prompt for decrement amount (will be recorded as damagedQuantity)
                                                    const input = prompt(`Nhập số lượng cần trừ khỏi lô (số sẽ được ghi vào cột "Hư hại")`, "0");
                                                    if (input === null) return;
                                                    const delta = parseInt(String(input).trim().replace(/[^0-9]/g, ''), 10);
                                                    if (Number.isNaN(delta) || delta <= 0) {
                                                        alert('Số lượng trừ không hợp lệ (phải là số nguyên dương).');
                                                        return;
                                                    }
                                                    const currentQty = Number(batch.batchQuantity || 0);
                                                    const sold = Number(batch.soldQuantity || 0);
                                                    const existingDamaged = Number(batch.damagedQuantity || 0);

                                                    // maximum amount we can mark as damaged without going below sold units
                                                    const maxDamageable = currentQty - sold - existingDamaged;
                                                    if (maxDamageable <= 0) {
                                                        alert('Không thể ghi nhận hư hại: không còn số lượng khả dụng để đánh dấu hư hại.');
                                                        return;
                                                    }

                                                    if (delta > maxDamageable) {
                                                        alert(`Số lượng hư hại không thể vượt quá ${maxDamageable}. Vui lòng nhập lại.`);
                                                        return;
                                                    }

                                                    // newQty is the resulting total after subtracting delta
                                                    const newQty = currentQty - delta;

                                                    if (newQty < sold) {
                                                        alert(`Không thể trừ ${delta} vì sẽ nhỏ hơn số đã bán (${sold}).`);
                                                        return;
                                                    }
                                                    if (newQty === currentQty) {
                                                        alert('Số lượng không thay đổi.');
                                                        return;
                                                    }

                                                    setBusy(true);
                                                    try {
                                                        await updateBatchQuantity(batch._id, newQty);
                                                        await loadBatchDetails();
                                                        await load();
                                                        await getAllProduct(dispatch, true);
                                                        alert(`Đã trừ ${delta} đơn vị (ghi nhận vào Hư hại) cho lô.`);
                                                    } catch (err) {
                                                        alert(err?.message || 'Cập nhật thất bại');
                                                    } finally {
                                                        setBusy(false);
                                                    }
                                                }}
                                            >
                                                Chỉnh sửa
                                            </button>
                                        );
                                    })()}
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
            <WarehouseManagerModal
                open={warehouseManager.open}
                initialTab={warehouseManager.initialTab}
                warehouses={warehouses}
                onClose={() => setWarehouseManager({ open: false, initialTab: "list" })}
                onAddSuccess={(newW) => {
                    setWarehouses((prev) => [...prev, newW]);
                }}
            />
        </div>
    );
};

export default memo(StockManagerPage);