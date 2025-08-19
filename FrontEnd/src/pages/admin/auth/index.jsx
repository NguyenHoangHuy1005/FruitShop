import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "./style.scss";
import { verifyAccount, resendCode } from "../../../component/redux/apiRequest";
import { setPendingEmail } from "../../../component/redux/authSlice";
import { ROUTERS } from "../../../utils/router";

export default function Verify() {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const pendingEmail =
        useSelector((state) => state.auth.pendingEmail) ||
        localStorage.getItem("PENDING_EMAIL");

    const [token, setToken] = useState("");
    const [errMsg, setErrMsg] = useState("");
    const [loading, setLoading] = useState(false);

    // Chỉ redirect về signup 1 LẦN khi component mount
    const didMountGuard = useRef(false);
    // Khóa double-submit/double-navigate trong StrictMode
    const navigatingRef = useRef(false);
    const submittingRef = useRef(false);

    useEffect(() => {
        if (didMountGuard.current) return;
        didMountGuard.current = true;

        if (!pendingEmail) {
        navigate(ROUTERS.ADMIN.SIGNUP || "/admin/signup", { replace: true });
        }
    }, [pendingEmail, navigate]);

    const onVerify = async (e) => {
        e.preventDefault();
        if (loading || submittingRef.current) return;
        submittingRef.current = true;

        setErrMsg("");
        setLoading(true);

        const result = await verifyAccount({ email: pendingEmail, token }, dispatch);

        setLoading(false);
        submittingRef.current = false;

        if (!result?.ok) {
        setErrMsg(result?.message || "Mã không đúng, vui lòng nhập lại.");
        return;
        }

        // Đánh dấu trạng thái để Login hiển thị thông báo (kể cả F5)
        sessionStorage.setItem("JUST_VERIFIED", "1");

        // Dọn dẹp pendingEmail
        localStorage.removeItem("PENDING_EMAIL");
        dispatch(setPendingEmail(null));

        // Điều hướng về Login (replace để không quay lại Verify)
        if (!navigatingRef.current) {
        navigatingRef.current = true;
        navigate(ROUTERS.ADMIN.LOGIN || "/admin/login", {
            replace: true,
            state: { justVerified: true },
        });
        }
    };

    const onResend = async () => {
        const ok = await resendCode(pendingEmail, dispatch);
        if (ok) alert("Đã gửi lại mã. Hãy kiểm tra email (cả thư rác).");
    };

    return (
        <div className="auth-verify">
        <div className="auth-verify__card">
            <h2 className="auth-verify__title">Xác minh email</h2>
            <p className="auth-verify__hint">
            Mã xác minh đã gửi đến: <b>{pendingEmail}</b> (hết hạn sau 10 phút).
            </p>

            <form className="auth-verify__form" onSubmit={onVerify}>
            <div className="auth-verify__group">
                <label className="auth-verify__label">Mã 6 chữ số</label>
                <input
                className={`auth-verify__input ${errMsg ? "auth-verify__input--error" : ""}`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").trim())}
                aria-invalid={!!errMsg}
                value={token}
                />
                {errMsg && <div className="auth-verify__error">{errMsg}</div>}
            </div>

            <button
                className="auth-verify__button"
                type="submit"
                disabled={loading || token.length !== 6}
            >
                {loading ? "Đang xác minh..." : "Xác minh"}
            </button>
            </form>

            <button
            className="auth-verify__button auth-verify__button--secondary"
            onClick={onResend}
            disabled={loading}
            style={{ marginTop: 12 }}
            >
            Gửi lại mã
            </button>
        </div>
        </div>
    );
}
