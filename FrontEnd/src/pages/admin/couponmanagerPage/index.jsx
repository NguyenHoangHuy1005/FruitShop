import { memo, useState, useEffect, useMemo } from "react";
import { formatter } from "../../../utils/fomater";
import "./style.scss";
import {
    getAllCoupons,
    createCoupon,
    toggleCoupon,
    extendCoupon,
    getAllProduct,
    getPriceRange,
    getLatestBatchInfo,
    API,
    ensureAccessToken,
} from "../../../component/redux/apiRequest";
import { useDispatch } from "react-redux";

const CouponManagerPage = () => {
    const dispatch = useDispatch();

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
    const [priceLookup, setPriceLookup] = useState({});
    const [latestBatchLookup, setLatestBatchLookup] = useState({});
    const [productsLoading, setProductsLoading] = useState(false); // trang thai load san pham

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
        loading: false,
    });

    const resolveProductPrice = (product) => {
        const id = typeof product === "object" ? product?._id : product;
        const latest = id ? latestBatchLookup[id] : undefined;
        if (latest) {
            const selling = Number(latest?.sellingPrice ?? latest?.price);
            if (Number.isFinite(selling) && selling > 0) return selling;
        }
        const range = id ? priceLookup[id] : undefined;
        const rangePrice =
            range?.minPrice ??
            range?.maxPrice ??
            range?.minBasePrice ??
            range?.maxBasePrice;
        if (rangePrice !== undefined) {
            const val = Number(rangePrice);
            if (Number.isFinite(val)) return val;
        }

        const raw = typeof product === "object" ? product?.price : undefined;
        const num = Number(raw);
        return Number.isFinite(num) ? num : 0;
    };

    const resolveProductDiscount = (product) => {
        const id = typeof product === "object" ? product?._id : product;
        const range = id ? priceLookup[id] : undefined;
        if (range) {
            const base =
                Number(range.minBasePrice ?? range.maxBasePrice ?? range.maxPrice ?? range.minPrice);
            const final = Number(range.minPrice ?? range.maxPrice);
            if (Number.isFinite(base) && Number.isFinite(final) && base > 0 && final < base) {
                return Math.min(100, Math.max(0, Math.round((1 - final / base) * 100)));
            }
        }
        const pct = Number(product?.discountPercent);
        return Number.isFinite(pct) ? Math.max(0, pct) : 0;
    };

    const displayProducts = useMemo(() => {
        return allProducts.map((p) => ({
            ...p,
            displayPrice: resolveProductPrice(p),
            displayDiscount: resolveProductDiscount(p),
        }));
    }, [allProducts, priceLookup, latestBatchLookup]);

    // xu ly danh sach san pham ap dung trong modal xem chi tiet
    const viewProducts = useMemo(() => {
        const coupon = viewProductsModal.coupon;
        if (!coupon) return [];

        const raw = Array.isArray(coupon.applicableProducts)
            ? coupon.applicableProducts
            : null;

        // Neu khong co danh sach rieng => ap dung cho tat ca
        const source = !raw || raw.length === 0 ? displayProducts : raw;

        console.log(
            "[coupon-view] code:",
            coupon?.code,
            "| applicable len:",
            Array.isArray(raw) ? raw.length : "null",
            "| using source len:",
            source.length
        );

        return source
            .map((item, idx) => {
                let id = null;
                let fromCoupon = {};

                if (typeof item === "string") {
                    id = item;
                } else if (item && typeof item === "object") {
                    id = item._id || item.id || item.product || item.productId || null;
                    fromCoupon = item;
                }

                if (!id) id = `fallback-${idx}`;

                const fromList = displayProducts.find((p) => String(p._id) === String(id));

                const merged = {
                    ...(fromCoupon || {}),
                    ...(fromList || {}),
                    _id: id,
                };

                return {
                    ...merged,
                    name: merged.name || "Không tìm thấy",
                    family: merged.family || merged.category || "—",
                    price: resolveProductPrice(merged),
                    discountPercent: resolveProductDiscount(merged),
                };
            })
            .filter(Boolean);
    }, [viewProductsModal.coupon, displayProducts, priceLookup]);

    // 🔥 NEW: Modal chỉnh sửa sản phẩm áp dụng
    const [editProductsModal, setEditProductsModal] = useState({
        open: false,
        coupon: null,
        selectedProducts: [],
        submitting: false,
        searchTerm: "",
    });

    // 🔥 NEW: Modal giảm giá hàng loạt
    const [bulkDiscountModal, setBulkDiscountModal] = useState({
        open: false,
        selectedProducts: [],
        discountPercent: 0,
        discountStartDate: "",
        discountEndDate: "",
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
            let token = await ensureAccessToken(null);
            if (!token) token = localStorage.getItem("accessToken") || "";

            const res = await API.get("/coupon", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                validateStatus: () => true,
            });

            if (res.status === 200 && Array.isArray(res.data)) {
                setCoupons(res.data);
            } else {
                console.error("Load coupons fail status:", res.status, res.data);
            }
        } catch (e) {
            console.error("Load coupons fail:", e);
        }
    };

    const loadProducts = async () => {
        setProductsLoading(true);
        try {
            let token = await ensureAccessToken(null);
            if (!token) token = localStorage.getItem("accessToken") || "";

            const res = await API.get("/product?admin=1", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                validateStatus: () => true,
            });
            const data = Array.isArray(res.data) ? res.data : [];
            setAllProducts(data);

                if (!data.length) {
                    setPriceLookup({});
                    setLatestBatchLookup({});
                    return;
                }

            const priceMap = {};
            const latestMap = {};
            const chunkSize = 6;

            for (let i = 0; i < data.length; i += chunkSize) {
                const slice = data.slice(i, i + chunkSize);
                const [rangeResults, latestResults] = await Promise.all([
                    Promise.allSettled(slice.map((p) => getPriceRange(p._id))),
                    Promise.allSettled(slice.map((p) => getLatestBatchInfo(p._id))),
                ]);

                rangeResults.forEach((result, idx) => {
                    if (result.status !== "fulfilled" || !result.value) return;
                    const payload = result.value;
                    const priceCandidate =
                        payload?.minPrice ??
                        payload?.maxPrice ??
                        payload?.minBasePrice ??
                        payload?.maxBasePrice;

                    if (priceCandidate !== undefined) {
                        priceMap[slice[idx]._id] = payload;
                    }
                });

                latestResults.forEach((result, idx) => {
                    if (result.status !== "fulfilled") return;
                    const latestPayload = result.value;
                    if (latestPayload?.latestBatch) {
                        latestMap[slice[idx]._id] = latestPayload.latestBatch;
                    }
                });
            }

            setPriceLookup(priceMap);
            setLatestBatchLookup(latestMap);
        } catch (e) {
            console.error("Load products fail:", e);
        } finally {
            setProductsLoading(false);
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

    // 🔥 NEW: mở modal xem sản phẩm áp dụng (fetch chi tiết kèm populate)
    const openViewProducts = async (c) => {
        if (!c || !c._id) return;

        // Hiển thị modal ngay, đồng thời fetch chi tiết (populate) để chắc chắn có danh sách sản phẩm
        setViewProductsModal({ open: true, coupon: c, loading: true });

        try {
            let token = await ensureAccessToken(null);
            if (!token) {
                token = localStorage.getItem("accessToken") || "";
            }

            // dam bao da co danh sach san pham truoc khi render
            if (allProducts.length === 0) {
                await loadProducts();
            }

            const res = await API.get(`/coupon/${c._id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                validateStatus: () => true,
            });

            const detail = res?.data?.coupon;
            if (res.status === 200 && detail) {
                // đồng bộ lại danh sách coupons trong state
                setCoupons((prev) => {
                    const exists = prev.some((cp) => String(cp._id) === String(detail._id));
                    if (!exists) return [detail, ...prev];
                    return prev.map((cp) => (String(cp._id) === String(detail._id) ? detail : cp));
                });

                setViewProductsModal({ open: true, coupon: detail, loading: false });
                return;
            }

            // Nếu API chi tiết fail, thử dùng lại danh sách (đã populate)
            if (coupons.length > 0) {
                const found = coupons.find((cp) => String(cp._id) === String(c._id));
                if (found) {
                    setViewProductsModal({ open: true, coupon: found, loading: false });
                    return;
                }
            }
        } catch (err) {
            console.error("Load coupon detail fail:", err);
        }

        // fallback: giữ dữ liệu cũ
        setViewProductsModal({ open: true, coupon: c, loading: false });
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

            const response = await fetch("http://localhost:3000/api/product/bulk-discount", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || "Giảm giá thất bại!");
            }

            alert(data.message || "Giảm giá thành công!");
            await getAllProduct(dispatch, true);
            await loadProducts();
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

    // tinh state hien thi san pham trong modal (khong dung hook khac)
    const couponView = viewProductsModal.coupon;
    const viewRawLen = Array.isArray(couponView?.applicableProducts)
        ? couponView.applicableProducts.length
        : null;
    const viewAppliesAll = viewRawLen === 0;
    const viewRows = couponView ? (viewAppliesAll ? displayProducts : viewProducts) : [];
    const viewLoading = viewProductsModal.loading || productsLoading;


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
                            placeholder="Mã code giảm giá"
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
                        + TẠO MÃ GIẢM GIÁ
                    </button>

                    <button
                        className="btn-bulk-discount"
                        onClick={() => setBulkDiscountModal((s) => ({ ...s, open: true }))}
                    >
                        ⚡ GIẢM GIÁ HÀNG LOẠT
                    </button>
                </div>


                <table className="coupon-table">
                <thead>
                    <tr>
                    <th>Mã giảm</th>
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
                                onClick={() => openViewProducts(c)}
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
                        <h3>Tạo Mã Giảm Giá</h3>

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
                                            const allIds = displayProducts.map(p => p._id);
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
                                {displayProducts.length > 0 ? (
                                    displayProducts
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
                                                    {formatter(p.displayPrice ?? resolveProductPrice(p))}
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
                                Đang chọn: <b>{createModal.data.applicableProducts.length}</b> / {displayProducts.length} sản phẩm
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
                <div className="modal-overlay" onClick={() => setViewProductsModal({ open: false, coupon: null, loading: false })}>
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
                            Sản phẩm áp dụng {viewAppliesAll ? "(Tất cả)" : `(${viewRows.length})`}:
                        </h4>
                        {viewLoading ? (
                            <div className="empty-state">
                                <p>Đang tải danh sách sản phẩm...</p>
                            </div>
                        ) : !couponView ? (
                            <div className="empty-state">
                                <p>Chưa có dữ liệu coupon.</p>
                            </div>
                        ) : viewAppliesAll ? (
                            <div className="empty-state apply-all">
                                <p>
                                    Áp dụng cho toàn bộ sản phẩm.
                                </p>
                                {displayProducts.length === 0 && (
                                    <small>Chưa tải được danh sách sản phẩm.</small>
                                )}
                            </div>
                        ) : viewRows.length > 0 ? (
                            <div className="products-table-wrapper">
                                <table className="products-table">
                                    <thead>
                                        <tr>
                                            <th className="col-index">#</th>
                                            <th className="col-name">Tên sản phẩm</th>
                                            <th className="col-family">Họ</th>
                                            <th className="col-price">Giá</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewRows.map((p, idx) => (
                                            <tr key={idx}>
                                                <td className="col-index">{idx + 1}</td>
                                                <td>{p?.name || "N/A"}</td>
                                                <td>
                                                    <span className="product-family-badge">
                                                        {p?.family || "—"}
                                                    </span>
                                                </td>
                                                <td className="product-price-cell">
                                                    {formatter(resolveProductPrice(p))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>Không có sản phẩm để hiển thị.</p>
                                {Array.isArray(couponView?.applicableProducts) && couponView.applicableProducts.length > 0 && (
                                    <small>Không tìm thấy thông tin các sản phẩm đã chọn. Vui lòng kiểm tra danh sách sản phẩm.</small>
                                )}
                            </div>
                        )}

                        <div className="actions">
                            <button 
                                className="btn-cancel" 
                                onClick={() => setViewProductsModal({ open: false, coupon: null, loading: false })}
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
                                            const allIds = displayProducts.map(p => p._id);
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
                                {displayProducts.length > 0 ? (
                                    displayProducts
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
                                                    {formatter(p.displayPrice ?? resolveProductPrice(p))}
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
                                Đang chọn: <b>{editProductsModal.selectedProducts.length}</b> / {displayProducts.length} sản phẩm
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
                                            const allIds = displayProducts.map(p => p._id);
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
                                {displayProducts.length > 0 ? (
                                    displayProducts
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
                                            <span className="price">{formatter(p.displayPrice ?? resolveProductPrice(p))}</span>
                                            <span className={`discount ${resolveProductDiscount(p) > 0 ? 'has-discount' : ''}`}>
                                                {resolveProductDiscount(p)}%
                                            </span>
                                        </label>
                                    ))
                                ) : (
                                    <p className="no-products">Không có sản phẩm</p>
                                )}
                            </div>
                            <small className="selection-count">
                                Đang chọn: <b>{bulkDiscountModal.selectedProducts.length}</b> / {displayProducts.length} sản phẩm
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

export default memo(CouponManagerPage);
