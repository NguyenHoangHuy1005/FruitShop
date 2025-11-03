import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Breadcrumb from "../theme/breadcrumb";
import { formatter } from "../../../utils/fomater";
import {
    cancelPaymentSession,
    confirmPaymentSession,
    fetchPaymentSession,
    createSePayQr,
} from "../../../component/redux/apiRequest";
import { ROUTERS } from "../../../utils/router";
import "./style.scss";

const PAYMENT_QR_SAMPLES = [
    {
        key: "SePay",
        title: "SePay - Ngân hàng nội địa (Mã QR)",
        description: "Quét QR code trực tiếp bằng ứng dụng ngân hàng nội địa (Vietcombank, BIDV, Techcombank, MBBank, ...).",
        image:
            "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20160%20200%22%3E%0A%20%20%3Crect%20width%3D%22160%22%20height%3D%22200%22%20fill%3D%22%230d9488%22%20rx%3D%2216%22%2F%3E%0A%20%20%3Crect%20x%3D%2216%22%20y%3D%2216%22%20width%3D%22128%22%20height%3D%22128%22%20fill%3D%22%23fff%22%20rx%3D%228%22%2F%3E%0A%20%20%3Cg%20fill%3D%22%230d9488%22%3E%0A%20%20%20%20%3Crect%20x%3D%2228%22%20y%3D%2228%22%20width%3D%2224%22%20height%3D%2224%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2268%22%20y%3D%2228%22%20width%3D%2216%22%20height%3D%2216%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22100%22%20y%3D%2228%22%20width%3D%2220%22%20height%3D%2220%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2228%22%20y%3D%2264%22%20width%3D%2216%22%20height%3D%2216%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2252%22%20y%3D%2272%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2276%22%20y%3D%2264%22%20width%3D%2224%22%20height%3D%2224%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22108%22%20y%3D%2272%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2244%22%20y%3D%22100%22%20width%3D%2220%22%20height%3D%2220%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2276%22%20y%3D%22100%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22100%22%20y%3D%22100%22%20width%3D%2216%22%20height%3D%2216%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Ctext%20x%3D%2280%22%20y%3D%22172%22%20font-size%3D%2216%22%20fill%3D%22%23fff%22%20text-anchor%3D%22middle%22%20font-family%3D%22'Inter'%2Csans-serif%22%3EVIETQR%20DEMO%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2280%22%20y%3D%22188%22%20font-size%3D%2212%22%20fill%3D%22%23ccfbf1%22%20text-anchor%3D%22middle%22%20font-family%3D%22'Inter'%2Csans-serif%22%3ENg%C3%A2n%20h%C3%A0ng%20n%E1%BB%99i%20%C4%91%E1%BB%8Ba%3C%2Ftext%3E%0A%3C%2Fsvg%3E",
        // sửa hint này thành thông tin người nhận và nội dung chuyển khoản 
            hints: [
            "Mở ứng dụng ngân hàng và chọn chức năng quét QR.",
            "Đối chiếu tên người nhận, số tài khoản và số tiền hiển thị.",
            "Hoàn tất chuyển khoản, sau đó quay lại trang này để cập nhật trạng thái.",
        ],
    },
    {
        key: "card",
        title: "Thẻ quốc tế (Visa/Mastercard)",
        description: "Quét mã QR giả lập cho cổng thanh toán hỗ trợ thẻ quốc tế và credit/debit.",
        image:
            "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20160%20200%22%3E%0A%20%20%3Crect%20width%3D%22160%22%20height%3D%22200%22%20fill%3D%22%232563eb%22%20rx%3D%2216%22%2F%3E%0A%20%20%3Crect%20x%3D%2216%22%20y%3D%2216%22%20width%3D%22128%22%20height%3D%22128%22%20fill%3D%22%23fff%22%20rx%3D%228%22%2F%3E%0A%20%20%3Cg%20fill%3D%22%232563eb%22%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2224%22%20width%3D%2224%22%20height%3D%2224%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2264%22%20y%3D%2224%22%20width%3D%2240%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22112%22%20y%3D%2224%22%20width%3D%2220%22%20height%3D%2220%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2260%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2244%22%20y%3D%2260%22%20width%3D%2220%22%20height%3D%2220%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2276%22%20y%3D%2256%22%20width%3D%2232%22%20height%3D%2232%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22116%22%20y%3D%2268%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%22100%22%20width%3D%2216%22%20height%3D%2216%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2260%22%20y%3D%22108%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2284%22%20y%3D%22100%22%20width%3D%2228%22%20height%3D%2220%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Ctext%20x%3D%2280%22%20y%3D%22168%22%20font-size%3D%2216%22%20fill%3D%22%23bfdbfe%22%20text-anchor%3D%22middle%22%20font-family%3D%22'Inter'%2Csans-serif%22%3ECARD%20QR%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2280%22%20y%3D%22186%22%20font-size%3D%2212%22%20fill%3D%22%23dbeafe%22%20text-anchor%3D%22middle%22%20font-family%3D%22'Inter'%2Csans-serif%22%3EVisa%20%2F%20Mastercard%20demo%3C%2Ftext%3E%0A%3C%2Fsvg%3E",
        hints: [
            "Quét mã bằng app hỗ trợ thanh toán qua thẻ (VNPAY, ZaloPay, ...).",
            "Nhập hoặc xác nhận 3DS theo hướng dẫn của ngân hàng phát hành thẻ.",
            "Sau khi giao dịch thành công, hệ thống sẽ đánh dấu đơn là đã thanh toán.",
        ],
    },
    {
        key: "momo",
        title: "Ví MoMo",
        description: "Ví điện tử MoMo phổ biến với thao tác quét mã nhanh chóng.",
        image:
            "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20160%20200%22%3E%0A%20%20%3Crect%20width%3D%22160%22%20height%3D%22200%22%20fill%3D%22%23db2777%22%20rx%3D%2216%22%2F%3E%0A%20%20%3Crect%20x%3D%2216%22%20y%3D%2216%22%20width%3D%22128%22%20height%3D%22128%22%20fill%3D%22%23fff%22%20rx%3D%228%22%2F%3E%0A%20%20%3Cg%20fill%3D%22%23db2777%22%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2224%22%20width%3D%2228%22%20height%3D%2228%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2264%22%20y%3D%2224%22%20width%3D%2220%22%20height%3D%2220%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2296%22%20y%3D%2224%22%20width%3D%2228%22%20height%3D%2228%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2224%22%20y%3D%2268%22%20width%3D%2220%22%20height%3D%2220%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2252%22%20y%3D%2268%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2272%22%20y%3D%2260%22%20width%3D%2232%22%20height%3D%2232%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%22112%22%20y%3D%2272%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%22104%22%20width%3D%2220%22%20height%3D%2220%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2268%22%20y%3D%22104%22%20width%3D%2212%22%20height%3D%2212%22%2F%3E%0A%20%20%20%20%3Crect%20x%3D%2296%22%20y%3D%22108%22%20width%3D%2224%22%20height%3D%2216%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Ctext%20x%3D%2280%22%20y%3D%22168%22%20font-size%3D%2216%22%20fill%3D%22%23fff%22%20text-anchor%3D%22middle%22%20font-family%3D%22'Inter'%2Csans-serif%22%3EMoMo%20PAY%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2280%22%20y%3D%22186%22%20font-size%3D%2212%22%20fill%3D%22%23fbcfe8%22%20text-anchor%3D%22middle%22%20font-family%3D%22'Inter'%2Csans-serif%22%3EV%C3%AD%20%C4%91i%E1%BB%87n%20t%E1%BB%AD%20demo%3C%2Ftext%3E%0A%3C%2Fsvg%3E",
        hints: [
            "Mở ứng dụng MoMo và chọn mục Quét mã.",
            "Xác nhận nội dung chuyển khoản hiển thị trên màn hình.",
            "Thanh toán xong, chạm nút 'Đã thanh toán' trong MoMo để hệ thống nhận webhook.",
        ],
    },
];

const formatCountdown = (ms) => {
    if (!ms || ms <= 0) return "00:00";
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const PaymentPendingView = memo(() => {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector((s) => s.auth?.login?.currentUser);

    const [state, setState] = useState({
        loading: true,
        error: "",
        order: null,
        deadline: null,
        remainingMs: 0,
        expired: false,
    });
    const expiryTriggeredRef = useRef(false);
    const [selectedChannel, setSelectedChannel] = useState("");
    const [qrData, setQrData] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState("");
    const [isPolling, setIsPolling] = useState(false);
    const pollingIntervalRef = useRef(null);
    const paymentChannels = useMemo(
        () =>
            PAYMENT_QR_SAMPLES.map((sample) => ({
                value: sample.key,
                title: sample.title,
                description: sample.description,
            })),
        []
    );

    const loadSession = useCallback(async () => {
        if (!id) return;
        setState((prev) => ({ ...prev, loading: true, error: "" }));
        try {
            const res = await fetchPaymentSession(id, user?.accessToken, dispatch);
            setState({
                loading: false,
                error: "",
                order: res.order,
                deadline: res.order?.paymentDeadline || null,
                remainingMs: res.remainingMs || 0,
                expired: !!res.expired,
            });
            setSelectedChannel("");
            setQrData(null);
            setQrError("");
        } catch (err) {
            if (err?.code === "AUTH_REQUIRED") {
                navigate(ROUTERS.ADMIN.LOGIN, { replace: true });
                return;
            }
            const message = err?.message || "Không tải được thông tin thanh toán.";
            setState({ loading: false, error: message, order: null, deadline: null, remainingMs: 0, expired: false });
        }
    }, [dispatch, id, navigate, user?.accessToken]);

    useEffect(() => {
        loadSession();
    }, [loadSession]);

    // Tự động polling kiểm tra trạng thái thanh toán khi đã tạo QR
    useEffect(() => {
        // Chỉ polling khi:
        // 1. Đơn hàng đang pending
        // 2. Đã chọn kênh SePay
        // 3. Đã có QR code
        if (!state.order || state.order.status !== "pending" || selectedChannel !== "SePay" || !qrData) {
            // Dọn dẹp polling nếu có
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            setIsPolling(false);
            return;
        }

        // Bắt đầu polling
        setIsPolling(true);
        
        const checkPaymentStatus = async () => {
            try {
                const res = await fetchPaymentSession(id, user?.accessToken, dispatch);
                
                // Nếu đã thanh toán, chuyển sang trang success
                if (res.order?.status === "paid") {
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }
                    setIsPolling(false);
                    
                    // Hiển thị toast thành công
                    toast.success("Thanh toán thành công! Đang chuyển trang...", {
                        autoClose: 2000,
                    });
                    
                    // Chuyển sang trang success sau 1 giây
                    setTimeout(() => {
                        const successPath = ROUTERS.USER.PAYMENT_SUCCESS.replace(":id", id);
                        navigate(successPath, { replace: true, state: { order: res.order } });
                    }, 1000);
                }
            } catch (error) {
                console.error("Polling error:", error);
                // Không hiển thị lỗi cho user, chỉ log
            }
        };

        // Kiểm tra ngay lập tức
        checkPaymentStatus();

        // Polling mỗi 5 giây
        pollingIntervalRef.current = setInterval(checkPaymentStatus, 5000);

        // Cleanup khi component unmount
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [state.order, selectedChannel, qrData, id, user?.accessToken, dispatch, navigate]);

    useEffect(() => {
        if (!state.order || state.order.status !== "pending" || !state.deadline) {
            return undefined;
        }
        const computeRemaining = () => {
            const ms = Math.max(0, new Date(state.deadline).getTime() - Date.now());
            setState((prev) => ({ ...prev, remainingMs: ms }));
        };
        computeRemaining();
        const timer = setInterval(computeRemaining, 1000);
        return () => clearInterval(timer);
    }, [state.deadline, state.order?.status]);

    useEffect(() => {
        if (!state.order || state.order.status !== "pending") {
            expiryTriggeredRef.current = false;
            return undefined;
        }
        if (state.remainingMs > 0) return undefined;
        if (expiryTriggeredRef.current) return undefined;
        expiryTriggeredRef.current = true;
        const timer = setTimeout(() => {
            loadSession();
        }, 600);
        return () => clearTimeout(timer);
    }, [loadSession, state.order, state.remainingMs]);

    const amountTotal = useMemo(() => state.order?.amount?.total ?? 0, [state.order?.amount?.total]);
    const countdownText = useMemo(() => formatCountdown(state.remainingMs), [state.remainingMs]);

    // Tự động tạo QR khi chọn kênh SePay
    useEffect(() => {
        if (!selectedChannel || selectedChannel !== "SePay") {
            setQrData(null);
            setQrError("");
            return;
        }
        
        if (!state.order || state.order.status !== "pending") {
            return;
        }

        // Nếu đã có QR trong paymentMeta, dùng luôn
        if (state.order.paymentMeta?.sepay?.qrUrl) {
            setQrData({
                qrUrl: state.order.paymentMeta.sepay.qrUrl,
                accountName: state.order.paymentMeta.sepay.accountName,
                accountNo: state.order.paymentMeta.sepay.accountNo,
                bankId: state.order.paymentMeta.sepay.bankId,
                amount: state.order.paymentMeta.sepay.amount,
                reference: state.order.paymentMeta.sepay.reference || state.order.paymentMeta.sepay.code,
            });
            return;
        }

        // Chưa có QR, gọi API tạo mới
        const fetchQr = async () => {
            setQrLoading(true);
            setQrError("");
            try {
                const result = await createSePayQr(id, user?.accessToken, dispatch);
                if (result.ok && result.qr) {
                    setQrData({
                        qrUrl: result.qr,
                        accountName: result.order?.paymentMeta?.sepay?.accountName,
                        accountNo: result.order?.paymentMeta?.sepay?.accountNo,
                        bankId: result.order?.paymentMeta?.sepay?.bankId,
                        amount: result.order?.paymentMeta?.sepay?.amount,
                        reference: result.order?.paymentMeta?.sepay?.reference || result.order?.paymentMeta?.sepay?.code,
                    });
                } else {
                    setQrError("Không thể tạo mã QR. Vui lòng thử lại.");
                }
            } catch (error) {
                console.error("Failed to create QR:", error);
                setQrError(error?.message || "Không thể tạo mã QR thanh toán.");
            } finally {
                setQrLoading(false);
            }
        };

        fetchQr();
    }, [selectedChannel, state.order, id, user?.accessToken, dispatch]);

    const handlePayNow = async () => {
        if (!state.order) return;
        if (!selectedChannel) {
            alert("Vui lòng chọn loại hình thanh toán trước khi tiếp tục.");
            return;
        }
        try {
            const txId = `WEB-${Date.now()}`;
            const res = await confirmPaymentSession(
                id,
                { transactionId: txId, channel: selectedChannel },
                user?.accessToken,
                dispatch
            );
            const successPath = ROUTERS.USER.PAYMENT_SUCCESS.replace(":id", id);
            navigate(successPath, { replace: true, state: { order: res.order } });
        } catch (err) {
            if (err?.code === "AUTH_REQUIRED") {
                navigate(ROUTERS.ADMIN.LOGIN, { replace: true });
                return;
            }
            alert(err?.message || "Thanh toán thất bại, vui lòng thử lại.");
            await loadSession();
        }
    };

    const handleCancel = async () => {
        if (!state.order) return;
        if (!window.confirm("Bạn chắc chắn muốn hủy đơn hàng này?")) return;
        try {
            await cancelPaymentSession(id, user?.accessToken, dispatch);
            alert("Đơn hàng đã được hủy.");
            navigate(ROUTERS.USER.ORDERS, { replace: true });
        } catch (err) {
            if (err?.code === "AUTH_REQUIRED") {
                navigate(ROUTERS.ADMIN.LOGIN, { replace: true });
                return;
            }
            alert(err?.message || "Không thể hủy thanh toán.");
            await loadSession();
        }
    };

    if (state.loading) {
        return (
            <>
                <Breadcrumb paths={[{ label: "Thanh toán" }]} />
                <div className="container payment-container"><p>Đang tải thông tin thanh toán…</p></div>
            </>
        );
    }

    if (state.error) {
        return (
            <>
                <Breadcrumb paths={[{ label: "Thanh toán" }]} />
                <div className="container payment-container">
                    <div className="alert alert-danger" role="alert">{state.error}</div>
                    <button type="button" className="button-submit" onClick={() => navigate(ROUTERS.USER.ORDERS)}>
                        Quay lại đơn hàng
                    </button>
                </div>
            </>
        );
    }

    if (!state.order) {
        return (
            <>
                <Breadcrumb paths={[{ label: "Thanh toán" }]} />
                <div className="container payment-container">
                    <p>Không tìm thấy đơn hàng cần thanh toán.</p>
                    <button type="button" className="button-submit" onClick={() => navigate(ROUTERS.USER.ORDERS)}>
                        Quay lại đơn hàng
                    </button>
                </div>
            </>
        );
    }

    const isCancelled = state.order.status === "cancelled";

    return (
        <>
            <Breadcrumb paths={[{ label: "Thanh toán" }]} />
            <div className="container payment-container">
                <div className="payment-card">
                    <header className="payment-card__header">
                        <div>
                            <h2>Thanh toán đơn hàng #{String(state.order.id).slice(-6).toUpperCase()}</h2>
                            <p>Tổng tiền: <strong>{formatter(amountTotal)}</strong></p>
                        </div>
                        <div className="payment-card__status">
                            <span className={`badge status-${state.order.status}`}>{state.order.status}</span>
                            {state.order.status === "pending" && (
                                <div className="payment-card__countdown">
                                    <span>Thời gian còn lại:</span>
                                    <strong>{countdownText}</strong>
                                </div>
                            )}
                        </div>
                    </header>

                    {isCancelled && (
                        <div className="alert alert-warning" role="alert">
                            Đơn hàng đã bị hủy do quá hạn hoặc người dùng hủy thanh toán.
                        </div>
                    )}

                    <section className="payment-card__section">
                        <h3>Thông tin khách hàng</h3>
                        <p>{state.order.customer?.name}</p>
                        <p>{state.order.customer?.phone} — {state.order.customer?.email}</p>
                        <p>{state.order.customer?.address}</p>
                        {state.order.customer?.note && <p>Ghi chú: {state.order.customer.note}</p>}
                    </section>

                    <section className="payment-card__section payment-card__section--channels">
                        <h3>Chọn loại hình thanh toán</h3>
                        <div className="payment-card__channels">
                            {paymentChannels.map((channel) => (
                                <label
                                    key={channel.value}
                                    className={`payment-channel ${selectedChannel === channel.value ? "active" : ""}`}
                                >
                                    <input
                                        type="radio"
                                        name="paymentChannel"
                                        value={channel.value}
                                        checked={selectedChannel === channel.value}
                                        onChange={() => setSelectedChannel(channel.value)}
                                    />
                                    <div className="payment-channel__content">
                                        <span className="payment-channel__title">{channel.title}</span>
                                        <span className="payment-channel__desc">{channel.description}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="payment-card__channels-hint">
                            Vui lòng chọn hình thức thanh toán để tiếp tục. Sau khi quét mã và hoàn tất giao dịch,
                            hệ thống sẽ tự động cập nhật trạng thái đơn hàng.
                        </p>
                    </section>

                    <section className="payment-card__section">
                        <h3>Danh sách sản phẩm</h3>
                        <div className="table__cart">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: "left" }}>Sản phẩm</th>
                                        <th style={{ textAlign: "right" }}>Đơn giá</th>
                                        <th style={{ textAlign: "right" }}>Số lượng</th>
                                        <th style={{ textAlign: "right" }}>Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(state.order.items || []).map((it, idx) => (
                                        <tr key={idx}>
                                            <td>{it.name}</td>
                                            <td style={{ textAlign: "right" }}>{formatter(it.price)}</td>
                                            <td style={{ textAlign: "right" }}>{it.quantity}</td>
                                            <td style={{ textAlign: "right" }}>{formatter(it.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="payment-card__section payment-card__section--qr">
                        <h3>Mã QR thanh toán</h3>
                        {!selectedChannel ? (
                            <p className="payment-card__section-desc">
                            Vui lòng chọn loại hình thanh toán để hiển thị mã QR tương ứng.
                            </p>
                        ) : selectedChannel === "SePay" ? (
                            <div className="payment-card__qr-display">
                                {qrLoading ? (
                                    <div className="payment-card__qr-loading">
                                        <div className="spinner"></div>
                                        <p>Đang tạo mã QR...</p>
                                    </div>
                                ) : qrError ? (
                                    <div className="payment-card__qr-error">
                                        <p style={{ color: "red" }}>{qrError}</p>
                                        <button 
                                            type="button" 
                                            className="button-secondary"
                                            onClick={() => setSelectedChannel("")}
                                        >
                                            Thử lại
                                        </button>
                                    </div>
                                ) : qrData ? (
                                    <article className="payment-card__qr-item active">
                                        <div className="payment-card__qr-visual">
                                            <img className="qr-code-image" src={qrData.qrUrl} alt="SePay QR Code" loading="lazy" />
                                        </div>
                                        <div className="payment-card__qr-info">
                                            <h4>SePay - Ngân hàng nội địa</h4>
                                            <p style={{textAlign: "center", marginBottom: "16px"}}>Quét mã QR bằng ứng dụng ngân hàng của bạn</p>
                                            <div className="payment-card__qr-details">
                                                {qrData.bankId && <p><strong>Ngân hàng:</strong> <span>{qrData.bankId}</span></p>}
                                                {qrData.accountNo && <p><strong>Số tài khoản:</strong> <span>{qrData.accountNo}</span></p>}
                                                {qrData.accountName && <p><strong>Chủ tài khoản:</strong> <span>{qrData.accountName}</span></p>}
                                                {qrData.amount && <p><strong>Số tiền:</strong> <span style={{color: "#059669", fontWeight: "600"}}>{formatter(qrData.amount)}</span></p>}
                                                {qrData.reference && <p><strong>Nội dung CK:</strong> <span style={{color: "#0ea5e9", fontFamily: "monospace", background: "#f0f9ff", padding: "4px 8px", borderRadius: "6px"}}>{qrData.reference}</span></p>}
                                            </div>
                                            <ul>
                                                <li>Mở ứng dụng ngân hàng và chọn chức năng quét QR</li>
                                                <li>Đối chiếu thông tin người nhận và số tiền</li>
                                                <li>Hoàn tất chuyển khoản, hệ thống sẽ tự động cập nhật</li>
                                            </ul>
                                            {isPolling && (
                                                <div className="payment-status-indicator">
                                                    <div className="pulse-dot"></div>
                                                    <span>Đang chờ xác nhận thanh toán...</span>
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                ) : null}
                            </div>
                        ) : (
                            <div className="payment-card__qr-display">
                                {PAYMENT_QR_SAMPLES.filter((sample) => sample.key === selectedChannel).map((sample) => (
                                    <article key={sample.key} className="payment-card__qr-item active">
                                        <div className="payment-card__qr-visual">
                                            <img src={sample.image} alt={sample.title} loading="lazy" />
                                        </div>
                                        <div className="payment-card__qr-info">
                                            <h4>{sample.title}</h4>
                                            <p>{sample.description}</p>
                                            <ul>
                                                {sample.hints.map((hint, idx) => (
                                                    <li key={idx}>{hint}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>


                    <footer className="payment-card__footer">
                        <div className="payment-card__actions">
                            <button type="button" className="button-secondary" onClick={() => navigate(ROUTERS.USER.ORDERS)}>
                                Xem đơn hàng của tôi
                            </button>
                            {state.order.status === "pending" && (
                                <div className="payment-card__action-group">
                                    <button type="button" className="button-cancel" onClick={handleCancel}>
                                        Hủy thanh toán
                                    </button>
                                </div>
                            )}
                        </div>
                    </footer>
                </div>
            </div>
        </>
    );
});

const PaymentSuccessView = memo(() => {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const location = useLocation();
    const user = useSelector((s) => s.auth?.login?.currentUser);

    const [state, setState] = useState({ loading: true, error: "", order: location.state?.order || null });

    useEffect(() => {
        if (state.order && state.order.status === "paid") {
            setState((prev) => ({ ...prev, loading: false }));
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchPaymentSession(id, user?.accessToken, dispatch);
                if (cancelled) return;
                if (res.order?.status !== "paid") {
                    const redirectPath = ROUTERS.USER.PAYMENT.replace(":id", id);
                    navigate(redirectPath, { replace: true });
                    return;
                }
                setState({ loading: false, error: "", order: res.order });
            } catch (err) {
                if (err?.code === "AUTH_REQUIRED") {
                    navigate(ROUTERS.ADMIN.LOGIN, { replace: true });
                    return;
                }
                setState({ loading: false, error: err?.message || "Không lấy được thông tin thanh toán." });
            }
        })();
        return () => { cancelled = true; };
    }, [dispatch, id, navigate, state.order, user?.accessToken]);

    if (state.loading) {
        return (
            <>
                <Breadcrumb paths={[{ label: "Thanh toán" }]} />
                <div className="container payment-container"><p>Đang xác nhận thanh toán…</p></div>
            </>
        );
    }

    if (state.error) {
        return (
            <>
                <Breadcrumb paths={[{ label: "Thanh toán" }]} />
                <div className="container payment-container">
                    <div className="alert alert-danger" role="alert">{state.error}</div>
                    <button type="button" className="button-submit" onClick={() => navigate(ROUTERS.USER.ORDERS)}>
                        Quay lại đơn hàng
                    </button>
                </div>
            </>
        );
    }

    if (!state.order) {
        return (
            <>
                <Breadcrumb paths={[{ label: "Thanh toán" }]} />
                <div className="container payment-container">
                    <p>Không tìm thấy thông tin đơn hàng.</p>
                    <button type="button" className="button-submit" onClick={() => navigate(ROUTERS.USER.ORDERS)}>
                        Quay lại đơn hàng
                    </button>
                </div>
            </>
        );
    }

    const paymentGateway = typeof state.order.payment === 'object' 
        ? (state.order.payment?.gateway || state.order.paymentMeta?.sepay?.bankId || 'MBBank') 
        : (state.order.payment || 'BANK');
    
    const transactionId = state.order.payment?.sepayId || 
        state.order.paymentMeta?.sepay?.reference || 
        String(state.order.id).slice(-8).toUpperCase();
    
    const completedTime = state.order.paymentCompletedAt 
        ? new Date(state.order.paymentCompletedAt).toLocaleString("vi-VN", {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
        : '';

    return (
        <>
            <Breadcrumb paths={[{ label: "Thanh toán" }, { label: "Thành công" }]} />
            <div className="container payment-container">
                <div className="payment-success-card">
                    {/* Success Icon and Title - Centered */}
                    <div className="payment-success-header">
                        <div className="payment-success-icon">
                            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="32" cy="32" r="30" fill="#10b981" stroke="#059669" strokeWidth="2"/>
                                <path d="M20 32L28 40L44 24" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <h1 className="payment-success-title">Thanh toán thành công!</h1>
                        <div className="payment-success-badge">
                            <span className="badge-paid">Paid</span>
                        </div>
                    </div>

                    {/* Order ID */}
                    <div className="payment-success-order-id">
                        <span className="label">Mã đơn:</span>
                        <span className="value">#{String(state.order.id).slice(-6).toUpperCase()}</span>
                    </div>

                    {/* Payment Info Section */}
                    <section className="payment-success-section">
                        <h3 className="section-title">Thông tin thanh toán</h3>
                        <div className="info-grid">
                            <div className="info-row">
                                <span className="info-label">Phương thức:</span>
                                <span className="info-value">{paymentGateway}</span>
                            </div>
                            <div className="info-row highlight">
                                <span className="info-label">Tổng tiền:</span>
                                <span className="info-value amount">{formatter(state.order.amount?.total ?? 0)}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Mã giao dịch:</span>
                                <span className="info-value transaction-id">{transactionId}</span>
                            </div>
                            {completedTime && (
                                <div className="info-row">
                                    <span className="info-label">Thời gian hoàn tất:</span>
                                    <span className="info-value">{completedTime}</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Customer Info Section */}
                    <section className="payment-success-section">
                        <h3 className="section-title">Gửi tới</h3>
                        <div className="customer-info">
                            <div className="customer-row">
                                <strong>{state.order.customer?.name}</strong>
                            </div>
                            <div className="customer-row">
                                {state.order.customer?.phone} — {state.order.customer?.email}
                            </div>
                            <div className="customer-row">
                                {state.order.customer?.address}
                            </div>
                        </div>
                    </section>

                    {/* Action Buttons */}
                    <footer className="payment-success-footer">
                        <button 
                            type="button" 
                            className="btn-primary btn-view-orders" 
                            onClick={() => navigate(ROUTERS.USER.ORDERS)}
                        >
                            XEM ĐƠN HÀNG CỦA TÔI
                        </button>
                        <button 
                            type="button" 
                            className="btn-secondary btn-continue-shopping" 
                            onClick={() => navigate(ROUTERS.USER.PRODUCTS)}
                        >
                            Tiếp tục mua sắm
                        </button>
                    </footer>
                </div>
            </div>
        </>
    );
});

const PaymentPage = () => {
    const location = useLocation();
    const isSuccessView = location.pathname.endsWith("/success");
    return isSuccessView ? <PaymentSuccessView /> : <PaymentPendingView />;
};

export default PaymentPage;