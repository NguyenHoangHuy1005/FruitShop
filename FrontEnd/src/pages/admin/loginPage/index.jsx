import { useNavigate, useLocation, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import "./style.scss";
import React, { useState, useEffect, memo } from "react";
import { ROUTERS } from "../../../utils/router";
import { loginUser } from "../../../component/redux/apiRequest";

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
        loginUser({ username, password, remember }, dispatch, navigate);
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
            </form>
        </div>
        </div>
    );
};

export default memo(LoginAdminPage);
