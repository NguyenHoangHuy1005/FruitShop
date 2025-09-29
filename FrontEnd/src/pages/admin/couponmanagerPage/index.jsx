import { memo, useState, useEffect, useMemo } from "react";
import "./style.scss";
import { useSelector, useDispatch } from "react-redux";
import ProductForm from "../../../component/modals/addProductModal";
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

    // Modal tạo mới coupon (có minOrder)
    const [createModal, setCreateModal] = useState({
        open: false,
        submitting: false,
        data: {
        code: "",
        discountType: "percent",
        value: 0,
        startDate: "",
        endDate: "",
        usageLimit: 0,
        minOrder: 0,
        },
    });

    useEffect(() => {
        loadCoupons();
    }, []);

    const loadCoupons = async () => {
        try {
        const data = await getAllCoupons();
        setCoupons(data);
        } catch (e) {
        console.error("Load coupons fail:", e);
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
                startDate: startDateISO,                      // [ADD]
                endDate:   endDateISO,                        // [CHANGE] gửi ISO cuối ngày
                minOrder: Number(p.minOrder) || 0,
                usageLimit: Number(p.usageLimit) || 0,
            });

            await loadCoupons();
            setCreateModal({
                open: false,
                submitting: false,
                data: {
                    code: "",
                    discountType: "percent",
                    value: 0,
                    startDate: "",                              // [RESET]
                    endDate: "",
                    usageLimit: 0,
                    minOrder: 0,
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
        alert("Gia hạn coupon thành công!");
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
                    <input
                        type="text"
                        placeholder="Mã code"
                        value={couponFilter.code}
                        onChange={(e) => setCouponFilter((s) => ({ ...s, code: e.target.value }))}
                    />

                    {/* + ADD: lọc đơn vị */}
                    <select
                        value={couponFilter.type}
                        onChange={(e) => setCouponFilter((s) => ({ ...s, type: e.target.value }))}
                        title="Lọc theo đơn vị giảm"
                    >
                        <option value="all">Tất cả đơn vị</option>
                        <option value="percent">%</option>
                        <option value="fixed">VNĐ</option>
                    </select>

                    {/* + CHANGE: lọc theo khoảng ngày endDate */}
                    <input
                        type="date"
                        value={couponFilter.fromDate}
                        onChange={(e) => setCouponFilter((s) => ({ ...s, fromDate: e.target.value }))}
                        title="Từ ngày (endDate)"
                    />
                    <span className="range-sep">→</span>
                    <input
                        type="date"
                        value={couponFilter.toDate}
                        onChange={(e) => setCouponFilter((s) => ({ ...s, toDate: e.target.value }))}
                        title="Đến ngày (endDate)"
                    />

                    {/* + CHANGE: reset đúng các trường mới */}
                    <button onClick={() => setCouponFilter({ code: "", type: "all", fromDate: "", toDate: "" })}>
                        Xóa lọc
                    </button>

                    <button
                        className="btn-add"
                        onClick={() => setCreateModal((s) => ({ ...s, open: true }))}
                    >
                        + Thêm Coupon
                    </button>
                </div>


                <table className="coupon-table">
                <thead>
                    <tr>
                    <th>Code</th>
                    <th>Loại</th>
                    <th>Giá trị</th>
                    <th>Đơn tối thiểu</th>
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
                        <tr key={c._id} className={!c.active || expired || usedUp ? "expired" : ""}>
                            <td>{c.code}</td>
                            <td>{c.discountType === "percent" ? "%" : "VNĐ"}</td>
                            <td>
                            {c.discountType === "percent"
                                ? `${c.value}%`
                                : `${(c.value || 0).toLocaleString()} ₫`}
                            </td>
                            <td>{c.minOrder ? `${Number(c.minOrder).toLocaleString()} ₫` : "—"}</td>
                            <td>{c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"}</td>
                            <td>{new Date(c.endDate).toLocaleDateString()}</td>
                            <td>{c.usedCount}/{c.usageLimit || "∞"}</td>
                            <td>
                                {notStarted ? "Chưa bắt đầu" : (expired || usedUp) ? "Hết hạn/Đã dùng hết" : c.active ? "Đang hoạt động" : "Ngưng"}
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
                        <td colSpan="8" className="no-data">Không có mã giảm giá</td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
            {/* ===== Modal gia hạn coupon ===== */}
            {extendModal.open && (
                <div className="modal-overlay" onClick={() => setExtendModal((s) => ({ ...s, open: false }))}>
                    <div className="modal-content extend-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Gia hạn Coupon: <span className="code">{extendModal.coupon?.code}</span></h3>

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
                                Bật lại coupon nếu đang ngưng/hết hạn
                            </label>
                        </div>

                        <div className="actions">
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
                        <label>
                            Mã code
                            <input
                            type="text"
                            value={createModal.data.code}
                            onChange={(e) => setCreateModal((s) => ({ ...s, data: { ...s.data, code: e.target.value } }))}
                            />
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
        </div>
    );
};

export default memo(CouponManagerPage);
