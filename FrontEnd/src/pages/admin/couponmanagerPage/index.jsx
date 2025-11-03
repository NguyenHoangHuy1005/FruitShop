import { memo, useState, useEffect, useMemo } from "react";
import "./style.scss";
import {
    getAllCoupons,
    createCoupon,
    deleteCoupon,
    toggleCoupon,
    extendCoupon,
} from "../../../component/redux/apiRequest";

const CouponManagerPage = () => {

    // ===== Helpers =====
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
    // + ADD: chuẩn hóa đầu/ngày cuối cho lọc khoảng
    const toStartOfDay = (iso) => {
        if (!iso) return null;
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
    };
    const toEndOfDay = (iso) => {
        if (!iso) return null;
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
    };


    // ===== Coupons =====
    const [coupons, setCoupons] = useState([]);
    const [allProducts, setAllProducts] = useState([]);

    const [couponFilter, setCouponFilter] = useState({
        code: "",
        type: "all",   // all | percent | fixed
        fromDate: "",  // YYYY-MM-DD
        toDate: "",    // YYYY-MM-DD
    });


    // Modal gia hạn
    const [extendModal, setExtendModal] = useState({
        open: false,
        coupon: null,
        addUsage: 0,
        newEndDate: "",
        reactivate: true,
        submitting: false,
        minOrder: 0,
    });

    // 🔥 NEW: Modal xem sản phẩm áp dụng
    const [viewProductsModal, setViewProductsModal] = useState({
        open: false,
        coupon: null,
    });

    // 🔥 NEW: Modal chỉnh sửa sản phẩm áp dụng
    const [editProductsModal, setEditProductsModal] = useState({
        open: false,
        coupon: null,
        selectedProducts: [],
        submitting: false,
        searchTerm: "",
    });

    // Modal tạo mới coupon (có minOrder + applicableProducts)
    const [createModal, setCreateModal] = useState({
        open: false,
        submitting: false,
        searchTerm: "",
        data: {
            code: "",
            discountType: "percent",
            value: 0,
            startDate: "",
            endDate: "",
            usageLimit: 0,
            minOrder: 0,
            applicableProducts: [], // Array of product IDs
        },
    });

    useEffect(() => {
        loadCoupons();
        loadProducts();
    }, []);

    const loadCoupons = async () => {
        try {
            const data = await getAllCoupons();
            setCoupons(data);
        } catch (e) {
            console.error("Load coupons fail:", e);
        }
    };

    const loadProducts = async () => {
        try {
            const { API } = await import("../../../component/redux/apiRequest");
            const res = await API.get("/product");
            const data = res.data;
            setAllProducts(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Load products fail:", e);
        }
    };

    // ===== CREATE COUPON (modal) =====
    const submitCreateCoupon = async () => {
        const p = createModal.data;

        if (!p.code || !p.value || !p.startDate || !p.endDate) {
            alert("Vui lòng nhập đủ: Mã, Giá trị, Ngày bắt đầu, Ngày hết hạn.");
            return;
        }

        try {
            // ép kiểu & clamp %
            let value = Number(p.value);
            if (p.discountType === "percent" && value > 100) value = 100;

            // chuẩn hoá ngày: start = 00:00:00.000, end = 23:59:59.999
            const sd = new Date(p.startDate);
            const ed = new Date(p.endDate);
            if (isNaN(sd.getTime()) || isNaN(ed.getTime())) {
                alert("Ngày không hợp lệ.");
                return;
            }
            const startDateISO = new Date(sd.setHours(0,0,0,0)).toISOString();
            const endDateISO   = new Date(ed.setHours(23,59,59,999)).toISOString();
            if (new Date(endDateISO) < new Date(startDateISO)) {
                alert("Ngày hết hạn phải sau hoặc bằng ngày bắt đầu.");
                return;
            }

            setCreateModal((s) => ({ ...s, submitting: true }));
            await createCoupon({
                code: p.code.trim(),
                discountType: p.discountType,
                value,
                startDate: startDateISO,
                endDate: endDateISO,
                minOrder: Number(p.minOrder) || 0,
                usageLimit: Number(p.usageLimit) || 0,
                applicableProducts: Array.isArray(p.applicableProducts) ? p.applicableProducts : [],
            });

            await loadCoupons();
            setCreateModal({
                open: false,
                submitting: false,
                searchTerm: "",
                data: {
                    code: "",
                    discountType: "percent",
                    value: 0,
                    startDate: "",
                    endDate: "",
                    usageLimit: 0,
                    minOrder: 0,
                    applicableProducts: [],
                },
            });
            alert("Tạo coupon thành công!");
        } catch (e) {
            alert(e?.response?.data?.message || "Tạo coupon thất bại!");
            setCreateModal((s) => ({ ...s, submitting: false }));
        }
    };


    // ===== EXTEND COUPON =====
    const openExtend = (c) => {
        setExtendModal({
            open: true,
            coupon: c,
            addUsage: 0,
            newEndDate: fmtDateInput(c?.endDate) || "",
            reactivate: true,
            submitting: false,
            newMinOrder: Number(c?.minOrder || 0),
        });
    };

    // 🔥 NEW: Mở modal chỉnh sửa sản phẩm áp dụng
    const openEditProducts = (c) => {
        const productIds = (c.applicableProducts || []).map(p => 
            typeof p === 'object' ? p._id : p
        );
        setEditProductsModal({
            open: true,
            coupon: c,
            selectedProducts: productIds,
            submitting: false,
            searchTerm: "",
        });
    };

    // 🔥 NEW: Submit chỉnh sửa sản phẩm áp dụng
    const submitEditProducts = async () => {
        const { coupon, selectedProducts } = editProductsModal;
        if (!coupon) return;

        try {
            setEditProductsModal((s) => ({ ...s, submitting: true }));
            await extendCoupon(coupon._id, { applicableProducts: selectedProducts });
            await loadCoupons();
            setEditProductsModal({ open: false, coupon: null, selectedProducts: [], submitting: false, searchTerm: "" });
            alert("Cập nhật sản phẩm áp dụng thành công!");
        } catch (e) {
            alert(e?.response?.data?.message || "Cập nhật thất bại!");
            setEditProductsModal((s) => ({ ...s, submitting: false }));
        }
    };

    const submitExtend = async () => {
        const { coupon, addUsage, newEndDate, reactivate, newMinOrder } = extendModal;
        if (!coupon) return;

        const payload = {};
        const addNum = Number(addUsage);
        if (Number.isFinite(addNum) && addNum > 0) payload.addUsage = addNum;
        if (newEndDate && newEndDate.trim()) payload.newEndDate = newEndDate.trim();
        if (reactivate) payload.reactivate = true;
        //  thêm block minOrder
        if (newMinOrder !== undefined && newMinOrder !== null) {
            const v = Number(newMinOrder);
            if (!Number.isNaN(v) && v >= 0) {
                // (tuỳ bạn) chỉ gửi khi thay đổi
                if (v !== Number(coupon?.minOrder || 0)) {
                payload.newMinOrder = v;
                }
            } else {
                alert("Đơn tối thiểu phải là số ≥ 0.");
                return;
            }
        }

        if (!payload.addUsage && !payload.newEndDate && !payload.reactivate && payload.newMinOrder === undefined) {
            alert("Không có thay đổi nào được chọn.");
            return;
        }

        try {
        setExtendModal((s) => ({ ...s, submitting: true }));
        await extendCoupon(coupon._id, payload);
        await loadCoupons();
        setExtendModal({ open: false, coupon: null, addUsage: 0, newEndDate: "", reactivate: true, submitting: false });
        alert("Gia hạn mã giảm giá thành công!");
        } catch (e) {
        alert(e?.response?.data?.message || e?.message || "Gia hạn không thành công.");
        setExtendModal((s) => ({ ...s, submitting: false }));
        }
    };
    // ===== FILTER COUPONS (theo mã + ngày hết hạn) =====
    const filteredCoupons = useMemo(() => {
        const codeKey = (couponFilter.code || "").trim().toLowerCase();
        const { type, fromDate, toDate } = couponFilter;

        const from = toStartOfDay(fromDate);
        const to = toEndOfDay(toDate);

        return (coupons || []).filter((c) => {
            const okCode = !codeKey || (c?.code || "").toLowerCase().includes(codeKey);
            const okType = type === "all" || c?.discountType === type;

            let okDate = true;
            const end = c?.endDate ? new Date(c.endDate) : null;
            if (from && end) okDate = okDate && end >= from;
            if (to && end)   okDate = okDate && end <= to;

            return okCode && okType && okDate;
        });
    }, [coupons, couponFilter]);


    return (
        <div className="container">
            <h2>QUẢN LÝ MÃ GIẢM GIÁ</h2>
            <div className="coupon-section">
                {/* Toolbar lọc coupon */}
                <div className="coupon-toolbar">
                    <div className="filter-field">
                        <label>TÌM KIẾM</label>
                        <input
                            type="text"
                            placeholder="Mã HD / Nhà cung cấp / Người nhập..."
                            value={couponFilter.code}
                            onChange={(e) => setCouponFilter((s) => ({ ...s, code: e.target.value }))}
                        />
                    </div>

                    <div className="filter-field">
                        <label>TỪ NGÀY</label>
                        <input
                            type="date"
                            value={couponFilter.fromDate}
                            onChange={(e) => setCouponFilter((s) => ({ ...s, fromDate: e.target.value }))}
                            title="Từ ngày (endDate)"
                        />
                    </div>

                    <span className="range-sep">→</span>

                    <div className="filter-field">
                        <label>ĐẾN NGÀY</label>
                        <input
                            type="date"
                            value={couponFilter.toDate}
                            onChange={(e) => setCouponFilter((s) => ({ ...s, toDate: e.target.value }))}
                            title="Đến ngày (endDate)"
                        />
                    </div>

                    <div className="filter-field">
                        <label>SỐ DÒNG</label>
                        <select
                            value={couponFilter.type}
                            onChange={(e) => setCouponFilter((s) => ({ ...s, type: e.target.value }))}
                            title="Lọc theo đơn vị giảm"
                        >
                            <option value="all">20 / trang</option>
                            <option value="percent">%</option>
                            <option value="fixed">VNĐ</option>
                        </select>
                    </div>

                    <button className="btn-filter" onClick={() => setCouponFilter({ code: "", type: "all", fromDate: "", toDate: "" })}>
                        XÓA LỌC
                    </button>

                    <button
                        className="btn-add"
                        onClick={() => setCreateModal((s) => ({ ...s, open: true }))}
                    >
                        + THÊM COUPON
                    </button>
                </div>


                <table className="coupon-table">
                <thead>
                    <tr>
                    <th>Code</th>
                    <th>Bắt đầu</th>
                    <th>Hạn sử dụng</th>
                    <th>Sử dụng</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredCoupons.length > 0 ? (
                    filteredCoupons.map((c) => {
                        const expired = new Date(c.endDate) < new Date();
                        const usedUp = c.usageLimit > 0 && c.usedCount >= c.usageLimit;
                        const notStarted = c.startDate && new Date(c.startDate) > new Date();

                        return (
                        <tr key={c._id} className={!c.active || expired || usedUp ? "row-expired" : ""}>
                            <td className={!c.active || expired || usedUp ? "code-expired" : ""}>{c.code}</td>
                            <td>{c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"}</td>
                            <td>{new Date(c.endDate).toLocaleDateString()}</td>
                            <td>{c.usedCount}/{c.usageLimit || "∞"}</td>
                            <td>
                                {notStarted ? "Chưa bắt đầu" : (expired || usedUp) ? "Hết hạn/Đã dùng hết" : c.active ? "Đang hoạt động" : "Ngưng"}
                            </td>
                            <td>
                            {/* Xem */}
                            <button
                                className="btn-view"
                                onClick={() => setViewProductsModal({ open: true, coupon: c })}
                                title="Xem chi tiết coupon"
                            >
                                Xem
                            </button>

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

                            {/* Gia hạn */}
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
                                    console.error("Delete lỗi:", e);
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
                        <td colSpan="6" className="no-data">Không có mã giảm giá</td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
            {/* ===== Modal gia hạn mã giảm giá ===== */}
            {extendModal.open && (
                <div className="modal-overlay" onClick={() => setExtendModal((s) => ({ ...s, open: false }))}>
                    <div className="modal-content extend-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Gia hạn mã giảm giá: <span className="code">{extendModal.coupon?.code}</span></h3>

                        <div className="meta">
                            <div>Đơn tối thiểu hiện tại: <b>{Number(extendModal.coupon?.minOrder || 0).toLocaleString()} ₫</b></div>
                            <div>Áp dụng từ: <b>{extendModal.coupon?.startDate ? new Date(extendModal.coupon.startDate).toLocaleDateString() : "—"}</b></div>
                            <div>Hạn hiện tại: <b>{new Date(extendModal.coupon?.endDate).toLocaleString()}</b></div>
                            <div>Đã dùng: <b>{extendModal.coupon?.usedCount}</b> / Giới hạn: <b>{extendModal.coupon?.usageLimit || "∞"}</b></div>
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

                            <label>
                                Đơn tối thiểu (VNĐ)
                                <input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    value={extendModal.newMinOrder}
                                    onChange={(e) => {
                                    const v = e.target.value;
                                    setExtendModal((s) => ({ ...s, newMinOrder: v === "" ? "" : Number(v) }));
                                    }}
                                    placeholder="0"
                                />
                            </label>

                            <label className="reactivate">
                                <input
                                type="checkbox"
                                checked={extendModal.reactivate}
                                onChange={(e) => setExtendModal((s) => ({ ...s, reactivate: e.target.checked }))}
                                />
                                Bật lại mã giảm giá nếu đang ngưng/hết hạn
                            </label>
                        </div>

                        <div className="actions">
                            <button 
                                className="btn-edit-products"
                                onClick={() => {
                                    setExtendModal((s) => ({ ...s, open: false }));
                                    openEditProducts(extendModal.coupon);
                                }}
                            >
                                Sửa SP áp dụng
                            </button>
                            <button className="btn-cancel" onClick={() => setExtendModal((s) => ({ ...s, open: false }))}>
                                Hủy
                            </button>
                            <button className="btn-save" onClick={submitExtend} disabled={extendModal.submitting}>
                                {extendModal.submitting ? "Đang lưu..." : "Lưu thay đổi"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Modal tạo coupon ===== */}
            {createModal.open && (
                <div className="modal-overlay" onClick={() => setCreateModal((s) => ({ ...s, open: false }))}>
                    <div className="modal-content coupon-modal create-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Tạo Coupon mới</h3>

                        <div className="form-grid">
                        <label className="code-field">
                            Mã code
                            <div className="code-field__input-row">
                                <input
                                    type="text"
                                    value={createModal.data.code}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        // Chỉ cho phép chữ và số, tối đa 10 ký tự
                                        if (/^[A-Z0-9]*$/.test(val) && val.length <= 10) {
                                            setCreateModal((s) => ({ ...s, data: { ...s.data, code: val } }));
                                        }
                                    }}
                                    placeholder="VD: KM20250126 hoặc KMTET2025"
                                    className="code-input"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = new Date();
                                        const yyyymmdd = today.toISOString().split('T')[0].replace(/-/g, '');
                                        setCreateModal((s) => ({ ...s, data: { ...s.data, code: `KM${yyyymmdd}` } }));
                                    }}
                                    className="btn-auto-code"
                                >
                                    KM + Ngày
                                </button>
                            </div>
                            <small className="helper-text">
                                Định dạng: KM + tối đa 8 ký tự (chữ/số). VD: KM20250126 hoặc KMTET2025
                            </small>
                        </label>

                        <label>
                            Loại giảm
                            <select
                            value={createModal.data.discountType}
                            onChange={(e) => setCreateModal((s) => ({ ...s, data: { ...s.data, discountType: e.target.value } }))}
                            >
                            <option value="percent">Giảm theo %</option>
                            <option value="fixed">Giảm theo VNĐ</option>
                            </select>
                        </label>

                        <label>
                            Giá trị
                            <input
                            type="number"
                            min={0}
                            max={createModal.data.discountType === "percent" ? 100 : undefined}
                            value={createModal.data.value}
                            onChange={(e) => {
                                let val = Number(e.target.value);
                                if (createModal.data.discountType === "percent" && val > 100) val = 100;
                                setCreateModal((s) => ({ ...s, data: { ...s.data, value: val } }));
                            }}
                            />
                        </label>

                        <label>
                            Ngày bắt đầu áp dụng
                            <input
                                type="date"
                                value={createModal.data.startDate}
                                onChange={(e) =>
                                setCreateModal((s) => ({
                                    ...s,
                                    data: { ...s.data, startDate: e.target.value }
                                }))
                                }
                            />
                        </label>

                        <label>
                            Ngày hết hạn
                            <input
                            type="date"
                            value={createModal.data.endDate}
                            onChange={(e) => setCreateModal((s) => ({ ...s, data: { ...s.data, endDate: e.target.value } }))}
                            />
                        </label>

                        <label>
                            Số lần sử dụng (0 = ∞)
                            <input
                            type="number"
                            min={0}
                            value={createModal.data.usageLimit}
                            onChange={(e) => setCreateModal((s) => ({ ...s, data: { ...s.data, usageLimit: Number(e.target.value) } }))}
                            />
                        </label>

                        <label>
                            Đơn tối thiểu (VNĐ)
                            <input
                            type="number"
                            min={0}
                            value={createModal.data.minOrder}
                            onChange={(e) => setCreateModal((s) => ({ ...s, data: { ...s.data, minOrder: Number(e.target.value) } }))}
                            />
                        </label>

                        <label className="product-selection">
                            <div className="product-selection__header">
                                <span className="product-selection__title">
                                    Sản phẩm áp dụng (để trống = tất cả)
                                </span>
                                <div className="product-selection__actions">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allIds = allProducts.map(p => p._id);
                                            setCreateModal((s) => ({ ...s, data: { ...s.data, applicableProducts: allIds } }));
                                        }}
                                        className="btn-select-all"
                                    >
                                        Chọn tất cả
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCreateModal((s) => ({ ...s, data: { ...s.data, applicableProducts: [] } }))}
                                        className="btn-clear"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            </div>
                            
                            {/* 🔍 Ô tìm kiếm sản phẩm */}
                            <div className="search-wrapper">
                                <input
                                    type="text"
                                    placeholder="🔍 Tìm kiếm sản phẩm..."
                                    value={createModal.searchTerm}
                                    onChange={(e) => setCreateModal((s) => ({ ...s, searchTerm: e.target.value }))}
                                    className="search-input"
                                />
                            </div>
                            
                            <div className="products-list">
                                {allProducts.length > 0 ? (
                                    allProducts
                                        .filter((p) => {
                                            const searchKey = (createModal.searchTerm || "").trim().toLowerCase();
                                            if (!searchKey) return true;
                                            return (p?.name || "").toLowerCase().includes(searchKey);
                                        })
                                        .map((p) => (
                                        <label
                                            key={p._id}
                                            className={`product-item ${createModal.data.applicableProducts.includes(p._id) ? "selected" : ""}`.trim()}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={createModal.data.applicableProducts.includes(p._id)}
                                                onChange={(e) => {
                                                    const selected = e.target.checked
                                                        ? [...createModal.data.applicableProducts, p._id]
                                                        : createModal.data.applicableProducts.filter(id => id !== p._id);
                                                    setCreateModal((s) => ({ ...s, data: { ...s.data, applicableProducts: selected } }));
                                                }}
                                            />
                                            <span className="product-name">
                                                {p.name}
                                            </span>
                                            <span className="product-family">
                                                {p.family || "—"}
                                            </span>
                                            <span className="product-price">
                                                {Number(p.price || 0).toLocaleString()}₫
                                            </span>
                                        </label>
                                    ))
                                ) : (
                                    <p className="empty-text">
                                        Không có sản phẩm
                                    </p>
                                )}
                            </div>
                            <small className="selection-info">
                                Đang chọn: <b>{createModal.data.applicableProducts.length}</b> / {allProducts.length} sản phẩm
                            </small>
                        </label>
                    </div>

                    <div className="actions">
                        <button className="btn-cancel" onClick={() => setCreateModal((s) => ({ ...s, open: false }))}>
                            Hủy
                        </button>
                        <button className="btn-save" onClick={submitCreateCoupon} disabled={createModal.submitting}>
                            {createModal.submitting ? "Đang tạo..." : "Tạo coupon"}
                        </button>
                    </div>
                    </div>
                </div>
            )}

            {/* 🔥 NEW: Modal xem chi tiết coupon */}
            {viewProductsModal.open && (
                <div className="modal-overlay" onClick={() => setViewProductsModal({ open: false, coupon: null })}>
                    <div className="modal-content view-products-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>
                            Chi tiết mã giảm giá: <span>{viewProductsModal.coupon?.code}</span>
                        </h3>

                        {/* Thông tin coupon */}
                        <div className="coupon-info-card">
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>
                                        Loại giảm giá
                                    </label>
                                    <div className="value">
                                        {viewProductsModal.coupon?.discountType === "percent" ? "Giảm theo %" : "Giảm theo VNĐ"}
                                    </div>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Giá trị
                                    </label>
                                    <div className="value highlight">
                                        {viewProductsModal.coupon?.discountType === "percent"
                                            ? `${viewProductsModal.coupon?.value}%`
                                            : `${(viewProductsModal.coupon?.value || 0).toLocaleString()} ₫`}
                                    </div>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Đơn tối thiểu
                                    </label>
                                    <div className="value">
                                        {viewProductsModal.coupon?.minOrder 
                                            ? `${Number(viewProductsModal.coupon.minOrder).toLocaleString()} ₫`
                                            : "Không yêu cầu"}
                                    </div>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Số lần sử dụng
                                    </label>
                                    <div className="value">
                                        {viewProductsModal.coupon?.usedCount} / {viewProductsModal.coupon?.usageLimit || "∞"}
                                    </div>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Ngày bắt đầu
                                    </label>
                                    <div className="value">
                                        {viewProductsModal.coupon?.startDate 
                                            ? new Date(viewProductsModal.coupon.startDate).toLocaleDateString("vi-VN")
                                            : "—"}
                                    </div>
                                </div>

                                <div className="info-item">
                                    <label>
                                        Ngày hết hạn
                                    </label>
                                    <div className="value danger">
                                        {new Date(viewProductsModal.coupon?.endDate).toLocaleDateString("vi-VN")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Danh sách sản phẩm */}
                        <h4 className="products-title">
                            Sản phẩm áp dụng:
                        </h4>
                        
                        {viewProductsModal.coupon?.applicableProducts && viewProductsModal.coupon.applicableProducts.length > 0 ? (
                            <div className="products-table-wrapper">
                                <table className="products-table">
                                    <thead>
                                        <tr>
                                            <th className="col-name">Tên sản phẩm</th>
                                            <th className="col-family">Họ</th>
                                            <th className="col-price">Giá</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewProductsModal.coupon.applicableProducts.map((p, idx) => (
                                            <tr key={idx}>
                                                <td>{p?.name || "N/A"}</td>
                                                <td>
                                                    <span className="product-family-badge">
                                                        {p?.family || "—"}
                                                    </span>
                                                </td>
                                                <td className="product-price-cell">
                                                    {p?.price ? `${Number(p.price).toLocaleString()} ₫` : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>
                                    ✨ Áp dụng cho tất cả sản phẩm
                                </p>
                            </div>
                        )}

                        <div className="actions">
                            <button 
                                className="btn-cancel" 
                                onClick={() => setViewProductsModal({ open: false, coupon: null })}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔥 NEW: Modal chỉnh sửa sản phẩm áp dụng */}
            {editProductsModal.open && (
                <div className="modal-overlay" onClick={() => setEditProductsModal({ open: false, coupon: null, selectedProducts: [], submitting: false, searchTerm: "" })}>
                    <div className="modal-content edit-products-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Chỉnh sửa sản phẩm áp dụng: <span>{editProductsModal.coupon?.code}</span></h3>

                        <label className="product-selection">
                            <div className="product-selection__header">
                                <span className="product-selection__title">
                                    Chọn sản phẩm (để trống = tất cả)
                                </span>
                                <div className="product-selection__actions">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allIds = allProducts.map(p => p._id);
                                            setEditProductsModal((s) => ({ ...s, selectedProducts: allIds }));
                                        }}
                                        className="btn-select-all"
                                    >
                                        Chọn tất cả
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditProductsModal((s) => ({ ...s, selectedProducts: [] }))}
                                        className="btn-clear"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            </div>

                            {/* 🔍 Ô tìm kiếm sản phẩm */}
                            <div className="search-wrapper">
                                <input
                                    type="text"
                                    placeholder="🔍 Tìm kiếm sản phẩm..."
                                    value={editProductsModal.searchTerm}
                                    onChange={(e) => setEditProductsModal((s) => ({ ...s, searchTerm: e.target.value }))}
                                    className="search-input"
                                />
                            </div>

                            <div className="products-list">
                                {allProducts.length > 0 ? (
                                    allProducts
                                        .filter((p) => {
                                            const searchKey = (editProductsModal.searchTerm || "").trim().toLowerCase();
                                            if (!searchKey) return true;
                                            return (p?.name || "").toLowerCase().includes(searchKey);
                                        })
                                        .map((p) => (
                                            <label
                                                key={p._id}
                                                className={`product-item ${editProductsModal.selectedProducts.includes(p._id) ? "selected" : ""}`.trim()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={editProductsModal.selectedProducts.includes(p._id)}
                                                    onChange={(e) => {
                                                        const selected = e.target.checked
                                                            ? [...editProductsModal.selectedProducts, p._id]
                                                            : editProductsModal.selectedProducts.filter(id => id !== p._id);
                                                        setEditProductsModal((s) => ({ ...s, selectedProducts: selected }));
                                                    }}
                                                    className="product-checkbox"
                                                />
                                                <span className="product-name">
                                                    {p.name}
                                                </span>
                                                <span className="product-family">
                                                    {p.family || "—"}
                                                </span>
                                                <span className="product-price">
                                                    {Number(p.price || 0).toLocaleString()}₫
                                                </span>
                                            </label>
                                        ))
                                ) : (
                                    <p className="empty-text">
                                        Không có sản phẩm
                                    </p>
                                )}
                            </div>
                            <small className="selection-info">
                                Đang chọn: <b>{editProductsModal.selectedProducts.length}</b> / {allProducts.length} sản phẩm
                            </small>
                        </label>

                        <div className="actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setEditProductsModal({ open: false, coupon: null, selectedProducts: [], submitting: false, searchTerm: "" })}
                            >
                                Hủy
                            </button>
                            <button
                                className="btn-save"
                                onClick={submitEditProducts}
                                disabled={editProductsModal.submitting}
                            >
                                {editProductsModal.submitting ? "Đang lưu..." : "Lưu thay đổi"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(CouponManagerPage);
