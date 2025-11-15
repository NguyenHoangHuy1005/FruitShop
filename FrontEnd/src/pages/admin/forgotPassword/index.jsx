    import React, { useRef, useState } from "react";
    import { useNavigate } from "react-router-dom";
    import "./style.scss";
    import { ROUTERS } from "../../../utils/router";
    import { requestPasswordReset, resetPassword } from "../../../component/redux/apiRequest";

    const ForgotPasswordPage = () => {
        const navigate = useNavigate();

        // steps: 1 = nhập email, 2 = nhập OTP + mật khẩu mới
        const [step, setStep] = useState(1);
        const [email, setEmail] = useState("");
        const [token, setToken] = useState("");
        const [newPassword, setNewPassword] = useState("");
        const [confirm, setConfirm] = useState("");

        const [loading, setLoading] = useState(false);
        const [msg, setMsg] = useState(null);
        const [canResend, setCanResend] = useState(false);

        const [errors, setErrors] = useState({ email: "", token: "", newPassword: "", confirm: "", api: "" });

        const emailRef = useRef(null);
        const tokenRef = useRef(null);
        const newPassRef = useRef(null);
        const confirmRef = useRef(null);

        const clearErrors = () => setErrors({ email: "", token: "", newPassword: "", confirm: "", api: "" });
        const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

        const handleRequest = async (e) => {
            e.preventDefault();
            clearErrors();
            setMsg(null);

            if (!validateEmail(email)) {
            setErrors((p) => ({ ...p, email: "Email không hợp lệ." }));
            emailRef.current?.focus();
            return;
            }

            setLoading(true);
            const r = await requestPasswordReset(email.trim());
            setLoading(false);

            if (r.ok) {
            setMsg(r.data?.message || "Nếu email tồn tại, mã đã được gửi (hết hạn 10 phút).");
            setStep(2);
            setCanResend(false);
            setToken("");
            setNewPassword("");
            setConfirm("");
            setTimeout(() => tokenRef.current?.focus(), 50);
            } else {
            setErrors((p) => ({ ...p, api: r.error?.message || "Không thể gửi yêu cầu." }));
            }
        };

        const handleResend = async () => {
            if (!validateEmail(email)) {
            setErrors((p) => ({ ...p, email: "Email không hợp lệ." }));
            setStep(1);
            emailRef.current?.focus();
            return;
            }
            setLoading(true);
            const r = await requestPasswordReset(email.trim());
            setLoading(false);
            if (r.ok) {
            setMsg("Đã gửi lại mã xác nhận. Vui lòng kiểm tra email (hết hạn 10 phút).");
            setCanResend(false);
            setToken("");
            tokenRef.current?.focus();
            } else {
            setErrors((p) => ({ ...p, api: r.error?.message || "Gửi lại mã thất bại." }));
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
            const r = await resetPassword({ email: email.trim(), token: t, newPassword, password_confirm: confirm });
            setLoading(false);

            if (r.ok) {
            setMsg(r.data?.message || "Đổi mật khẩu thành công.");
            sessionStorage.setItem("JUST_RESET", "1");
            setTimeout(() => navigate(ROUTERS.ADMIN.LOGIN), 1200);
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
            case "MISSING":
                setErrors((p) => ({ ...p, api: r.error.message || "Thiếu dữ liệu." }));
                return;
            default:
                setErrors((p) => ({ ...p, api: r.error?.message || "Đổi mật khẩu thất bại." }));
                return;
            }
        };

        return (
            <div className="forgot">
            <div className="forgot__container">
                <div className="forgot__back">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(ROUTERS.ADMIN.LOGIN)}
                >
                    ← Quay lại đăng nhập
                </button>
                </div>
                <h2 className="forgot__title">ĐẶT LẠI MẬT KHẨU</h2>

                {msg && <div className="alert">{msg}</div>}
                {errors.api && <div className="alert alert--error">{errors.api}</div>}

                {step === 1 && (
                <form className="forgot__form" onSubmit={handleRequest}>
                    <div className="form-group">
                    <label htmlFor="email">Email đã đăng ký</label>
                    <input id="email" type="email" ref={emailRef} required className={errors.email ? "is-error" : ""}
                            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                    {errors.email && <small className="help">{errors.email}</small>}
                    </div>
                    <button disabled={loading} type="submit" className="btn">{loading ? "Đang gửi..." : "Gửi mã đặt lại"}</button>
                </form>
                )}

                {step === 2 && (
                <form className="forgot__form" onSubmit={handleReset}>
                    <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={email} readOnly />
                    </div>

                    <div className="form-group">
                    <label htmlFor="token">Mã xác nhận (OTP)</label>
                    <input id="token" type="text" inputMode="numeric" ref={tokenRef} required maxLength={6}
                            className={errors.token ? "is-error" : ""}
                            value={token} onChange={(e) => setToken(e.target.value)} placeholder="Nhập 6 số" />
                    {errors.token && <small className="help">{errors.token}</small>}
                    </div>

                    <div className="form-group">
                    <label htmlFor="newpass">Mật khẩu mới</label>
                    <input id="newpass" type="password" ref={newPassRef} required className={errors.newPassword ? "is-error" : ""}
                            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Từ 6 ký tự" />
                    {errors.newPassword && <small className="help">{errors.newPassword}</small>}
                    </div>

                    <div className="form-group">
                    <label htmlFor="confirm">Xác nhận mật khẩu mới</label>
                    <input id="confirm" type="password" ref={confirmRef} required className={errors.confirm ? "is-error" : ""}
                            value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu" />
                    {errors.confirm && <small className="help">{errors.confirm}</small>}
                    </div>

                    <div className="forgot__actions">
                    <button type="button" className="btn btn-secondary" onClick={() => { setStep(1); clearErrors(); setMsg(null); setTimeout(() => emailRef.current?.focus(), 50); }}>
                        ← Nhập email khác
                    </button>

                    <div style={{ display: "flex", gap: 10 }}>
                        {canResend && (
                        <button type="button" className="btn btn-secondary" disabled={loading} onClick={handleResend}>
                            Gửi lại mã
                        </button>
                        )}
                        <button disabled={loading} type="submit" className="btn">{loading ? "Đang đổi..." : "Đổi mật khẩu"}</button>
                    </div>
                    </div>
                </form>
                )}
            </div>
            </div>
        );
    };

    export default ForgotPasswordPage;
