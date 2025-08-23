import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./style.scss";
import { ROUTERS } from "../../../utils/router";
import { requestPasswordReset, resetPassword } from "../../../component/redux/apiRequest";

function maskEmail(email) {
    if (!email) return "";
    const [name, domain] = email.split("@");
    const left = name.slice(0, 2);
    return `${left}${"*".repeat(Math.max(0, name.length - 2))}@${domain}`;
}

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const initialEmail =
        (location.state && location.state.email) ||
        localStorage.getItem("PENDING_EMAIL") ||
        "";

    const [email] = useState(String(initialEmail || "").trim());
    const [token, setToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);
    const [canResend, setCanResend] = useState(false);

    const [errors, setErrors] = useState({
        token: "",
        newPassword: "",
        confirm: "",
        api: "",
    });

    const tokenRef = useRef(null);
    const newPassRef = useRef(null);
    const confirmRef = useRef(null);

    useEffect(() => {
        if (!email) {
        setMsg("Thiếu email. Vui lòng quay lại và yêu cầu mã đặt lại.");
        }
        setTimeout(() => tokenRef.current?.focus(), 50);
    }, [email]);

    const clearErrors = () =>
        setErrors({ token: "", newPassword: "", confirm: "", api: "" });

    const handleResend = async () => {
        if (!email) return;
        setLoading(true);
        const r = await requestPasswordReset(email);
        setLoading(false);
        if (r.ok) {
        setMsg("Đã gửi lại mã xác nhận. Kiểm tra email (hết hạn 10 phút).");
        setCanResend(false);
        setToken("");
        tokenRef.current?.focus();
        } else {
        setErrors((p) => ({ ...p, api: r.error || "Gửi lại mã thất bại." }));
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        clearErrors();
        setMsg(null);

        const t = String(token || "").trim();
        if (!/^\d{6}$/.test(t)) {
            setErrors((p) => ({ ...p, token: "Mã OTP gồm 6 chữ số." }));
            setToken("");
            tokenRef.current?.focus();
            return;
        }
        if ((newPassword || "").length < 6) {
            setErrors((p) => ({ ...p, newPassword: "Mật khẩu phải từ 6 ký tự." }));
            setNewPassword("");
            setConfirm("");
            newPassRef.current?.focus();
            return;
        }
        if (newPassword !== confirm) {
            setErrors((p) => ({ ...p, confirm: "Xác nhận mật khẩu không khớp." }));
            setConfirm("");
            confirmRef.current?.focus();
            return;
        }

        setLoading(true);
        const r = await resetPassword({
            email,
            token: t,
            newPassword,
            password_confirm: confirm,
        });
        setLoading(false);

        if (r.ok) {
            setMsg(r.data?.message || "Đổi mật khẩu thành công.");
            sessionStorage.setItem("JUST_RESET", "1");
            setTimeout(() => navigate(ROUTERS.ADMIN.LOGIN || "/admin/login"), 1200);
            return;
        }

        switch (r.error?.code) {
            case "EXPIRED":
                setMsg("Mã đã hết hạn. Vui lòng bấm 'Gửi lại mã' để nhận mã mới.");
                setCanResend(true);
                setToken("");
                tokenRef.current?.focus();
                return;
            case "INVALID_TOKEN":
                setErrors((p) => ({ ...p, token: r.error.message || "Mã không đúng." }));
                setToken("");
                tokenRef.current?.focus();
                return;
            case "MISMATCH":
                setErrors((p) => ({ ...p, confirm: r.error.message || "Xác nhận mật khẩu không khớp." }));
                setConfirm("");
                confirmRef.current?.focus();
                return;
            case "WEAK_PASSWORD":
                setErrors((p) => ({ ...p, newPassword: r.error.message || "Mật khẩu quá yếu." }));
                setNewPassword("");
                setConfirm("");
                newPassRef.current?.focus();
                return;
            default:
                setErrors((p) => ({ ...p, api: r.error?.message || "Đổi mật khẩu thất bại." }));
                return;
        }
    };

    return (
        <div className="forgot">
        <div className="forgot__container">
            <h2 className="forgot__title">XÁC NHẬN MÃ & ĐỔI MẬT KHẨU</h2>

            {email && (
            <div className="alert">
                Mã đã gửi tới: <b>{maskEmail(email)}</b>
            </div>
            )}
            {msg && <div className="alert">{msg}</div>}
            {errors.api && <div className="alert alert--error">{errors.api}</div>}

            <form className="forgot__form" onSubmit={handleReset}>
            <input type="hidden" value={email} readOnly />

            <div className="form-group">
                <label htmlFor="token">Mã xác nhận (OTP)</label>
                <input
                id="token"
                type="text"
                inputMode="numeric"
                ref={tokenRef}
                required
                maxLength={6}
                className={errors.token ? "is-error" : ""}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Nhập 6 số"
                />
                {errors.token && <small className="help">{errors.token}</small>}
            </div>

            <div className="form-group">
                <label htmlFor="newpass">Mật khẩu mới</label>
                <input
                id="newpass"
                type="password"
                ref={newPassRef}
                required
                className={errors.newPassword ? "is-error" : ""}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Từ 6 ký tự"
                />
                {errors.newPassword && <small className="help">{errors.newPassword}</small>}
            </div>

            <div className="form-group">
                <label htmlFor="confirm">Xác nhận mật khẩu mới</label>
                <input
                id="confirm"
                type="password"
                ref={confirmRef}
                required
                className={errors.confirm ? "is-error" : ""}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                />
                {errors.confirm && <small className="help">{errors.confirm}</small>}
            </div>

            <div className="forgot__actions">
                {email && (
                <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={loading}
                    onClick={handleResend}
                >
                    Gửi lại mã
                </button>
                )}
                <button disabled={loading || !email} type="submit" className="btn">
                {loading ? "Đang đổi..." : "Đổi mật khẩu"}
                </button>
            </div>

            {!email && (
                <div style={{ marginTop: 12 }}>
                <small className="help">
                    Không tìm thấy email. Hãy quay lại đăng nhập và chọn “Quên mật khẩu?” để nhận mã.
                </small>
                </div>
            )}
            </form>
        </div>
        </div>
    );
};

export default ForgotPasswordPage;
