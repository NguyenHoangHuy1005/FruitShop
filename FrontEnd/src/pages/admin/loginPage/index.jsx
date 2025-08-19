import { useNavigate, useLocation, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import "./style.scss";
import React, { useState, useEffect, memo } from "react";
import { ROUTERS } from "../../../utils/router";
import { loginUser } from "../../../component/redux/apiRequest";

const LoginAdminPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showVerifiedMsg, setShowVerifiedMsg] = useState(false);

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();

    // Hiện thông báo khi vừa xác minh xong (kể cả user F5)
    useEffect(() => {
        const fromState = !!(location.state && location.state.justVerified);
        const fromSession = sessionStorage.getItem("JUST_VERIFIED") === "1";

        if (fromState || fromSession) {
        setShowVerifiedMsg(true);

        // Dọn cờ + reset state để không lặp lại
        sessionStorage.removeItem("JUST_VERIFIED");
        if (fromState) {
            navigate(ROUTERS.ADMIN.LOGIN || "/admin/login", { replace: true, state: {} });
        }

        const t = setTimeout(() => setShowVerifiedMsg(false), 3000);
        return () => clearTimeout(t);
        }
    }, [location.state, navigate]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const newUser = { username, password };
        loginUser(newUser, dispatch, navigate);
    };

    return (
        <div className="login">
        <div className="login__container">
            <h2 className="login__title">---ĐĂNG NHẬP---</h2>

            {showVerifiedMsg && (
            <div className="alert alert-success" role="status" aria-live="polite">
                Xác minh thành công! Bạn có thể đăng nhập.
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

            <button type="submit" className="login__button">Đăng nhập</button>

            <Link to={ROUTERS.ADMIN.SIGNUP}>Đăng ký</Link>
            <p>Hoặc</p>
            <Link to="#">Quên mật khẩu?</Link>
            </form>
        </div>
        </div>
    );
};

export default memo(LoginAdminPage);
