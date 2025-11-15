import { useNavigate, useLocation, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import "./style.scss";
import React, { useState, useEffect, memo } from "react";
import GoogleButton from "../../../component/auth/GoogleButton";
import { ROUTERS } from "../../../utils/router";
import * as authApi from "../../../component/redux/apiRequest";

const LoginAdminPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    // ----- verified message -----
    const [showVerifiedMsg, setShowVerifiedMsg] = useState(false);
    const [remember, setRemember] = useState(false);
    // ----- reset password message -----
    const [showResetMsg, setShowResetMsg] = useState(
        () => sessionStorage.getItem("JUST_RESET") === "1"
    );

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const [googleProcessing, setGoogleProcessing] = useState(false);
    const [googleStatus, setGoogleStatus] = useState("");
    const googleClientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";

    // Hiện thông báo khi vừa xác minh xong (kể cả user F5)
    useEffect(() => {
        const fromState = !!(location.state && location.state.justVerified);
        const fromSession = sessionStorage.getItem("JUST_VERIFIED") === "1";

        if (fromState || fromSession) {
        setShowVerifiedMsg(true);
        sessionStorage.removeItem("JUST_VERIFIED");
        if (fromState) {
            navigate(ROUTERS.ADMIN.LOGIN, { replace: true, state: {} });
        }
        const t = setTimeout(() => setShowVerifiedMsg(false), 3000);
        return () => clearTimeout(t);
        }
    }, [location.state, navigate]);

    // Tự ẩn thông báo reset sau 3s & dọn cờ session
    useEffect(() => {
        if (showResetMsg) {
        sessionStorage.removeItem("JUST_RESET");
        const t = setTimeout(() => setShowResetMsg(false), 3000);
        return () => clearTimeout(t);
        }
    }, [showResetMsg]);

    const handleSubmit = (e) => {
        e.preventDefault();
        authApi.loginUser({ username, password, remember }, dispatch, navigate);
    };

    const handleGoogleLogin = (credential) => authApi.loginGoogle(dispatch, credential, navigate);

    const onGoogleSuccess = async (credential) => {
        if (!credential || googleProcessing) return;
        try {
            setGoogleProcessing(true);
            setGoogleStatus("Đang xử lý đăng nhập Google...");
            await handleGoogleLogin(credential);
            setGoogleStatus("");
        } catch (error) {
            setGoogleStatus(error?.message || "Đăng nhập Google thất bại.");
        } finally {
            setGoogleProcessing(false);
        }
    };

    const onGoogleError = (error) => {
        setGoogleProcessing(false);
        setGoogleStatus(error?.message || "Đăng nhập Google thất bại.");
    };

    return (
        <div className="login">
        <div className="login__container">
            <h2 className="login__title">Đăng nhập</h2>

            {/* ✅ Đặt alert bên trong return */}
            {showVerifiedMsg && (
            <div className="alert alert-success" role="status" aria-live="polite">
                Xác minh thành công! Bạn có thể đăng nhập.
            </div>
            )}

            {showResetMsg && (
            <div className="alert alert-success" role="status" aria-live="polite">
                Đặt lại mật khẩu thành công! Hãy đăng nhập.
            </div>
            )}

            <form className="login__form" onSubmit={handleSubmit}>
            <div className="login__form-group">
                <label htmlFor="username" className="login__label">Tên đăng nhập</label>
                <input
                    type="text"
                    name="username"
                    id="username"
                    required
                    onChange={(e) => setUsername(e.target.value)}
                    value={username}
                />
            </div>

            <div className="login__form-group">
                <label htmlFor="password" className="login__label">Mật khẩu</label>
                <input
                    type="password"
                    name="password"
                    id="password"
                    required
                    onChange={(e) => setPassword(e.target.value)}
                    value={password}
                />
            </div>

            <div className="login__form-group login__remember">
                <input
                    type="checkbox"
                    id="remember"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                />
                <label htmlFor="remember">
                Ghi nhớ đăng nhập
                </label>
            </div>

            <div className="login__actions">
                <button type="submit" className="login__button">Đăng nhập</button>
                <div className="login__alt-actions">
                <Link to={ROUTERS.ADMIN.FORGOT} className="login__button login__button--ghost">
                    Quên mật khẩu
                </Link>
                <Link to={ROUTERS.ADMIN.SIGNUP} className="login__button login__button--outline">
                    Tạo tài khoản
                </Link>
                </div>
            </div>

            <div className="login__divider" aria-hidden="true">
                <span>Hoặc</span>
            </div>

            <div className="login__google-wrapper">
                <GoogleButton
                    clientId={googleClientId}
                    disabled={googleProcessing}
                    onSuccess={onGoogleSuccess}
                    onError={onGoogleError}
                />
                {googleStatus && (
                    <p className={`login__google-status${googleProcessing ? " login__google-status--loading" : ""}`}>
                        {googleStatus}
                    </p>
                )}
            </div>
            </form>
        </div>
        </div>
    );
};

export default memo(LoginAdminPage);
