// src/pages/admin/signup/SignupPage.jsx (đường dẫn thực tế của bạn)
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import "./style.scss";
import { memo, useState } from "react";
import GoogleButton from "../../../component/auth/GoogleButton";
import { ROUTERS } from "../../../utils/router";
import * as authApi from "../../../component/redux/apiRequest";

const SignupPage = () => {
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [googleProcessing, setGoogleProcessing] = useState(false);
    const [googleStatus, setGoogleStatus] = useState("");
    const googleClientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";

    const handleSubmit = (e) => {
        e.preventDefault();

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const phoneRegex = /^(0|\+84)(\d{9})$/;

        if (password !== confirmPassword) {
        alert("Mật khẩu không khớp");
        return;
        }
        if (!emailRegex.test(email)) {
        alert("Email không hợp lệ!");
        return;
        }
        if (!phoneRegex.test(phone)) {
        alert("Số điện thoại không hợp lệ!");
        return;
        }

        const newUser = {
        email,
        username,
        password,
        password_confirm: confirmPassword, // <<< QUAN TRỌNG
        phone,
        };

        authApi.registerUser(newUser, dispatch, navigate);
    };

    const handleGoogleRegister = (credential) => authApi.registerGoogle(dispatch, credential);

    const onGoogleRegisterSuccess = async (credential) => {
        if (!credential || googleProcessing) return;
        try {
            setGoogleProcessing(true);
            setGoogleStatus("Đang xử lý đăng ký Google...");
            await handleGoogleRegister(credential);
            setGoogleStatus("");
        } catch (error) {
            setGoogleStatus(error?.message || "Đăng ký Google thất bại.");
        } finally {
            setGoogleProcessing(false);
        }
    };

    const onGoogleRegisterError = (error) => {
        setGoogleProcessing(false);
        setGoogleStatus(error?.message || "Đăng ký Google thất bại.");
    };

    return (
        <div className="login">
        <div className="login__container">
            <h2 className="login__title">Đăng ký</h2>
            <form className="login__form" onSubmit={handleSubmit}>
            <div className="login__form-group">
                <label className="login__label">Tên đăng nhập</label>
                <input type="text" id="username" required onChange={(e) => setUsername(e.target.value)} />
            </div>

            <div className="login__form-group">
                <label className="login__label">Mật khẩu</label>
                <input type="password" id="password" required onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="login__form-group">
                <label className="login__label">Nhập lại mật khẩu</label>
                <input type="password" id="ConfirmPassword" required onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>

            <div className="login__form-group">
                <label className="login__label">Email</label>
                <input type="email" id="email" required onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="login__form-group">
                <label className="login__label">Số điện thoại</label>
                <input type="tel" id="phone" required onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="login__actions">
                <button type="submit" className="login__button">Đăng ký</button>
                <Link to={ROUTERS.ADMIN.LOGIN} className="login__button login__button--ghost">
                Quay lại đăng nhập
                </Link>
            </div>

            <div className="login__divider" aria-hidden="true">
                <span>Hoặc</span>
            </div>

            <div className="login__google-wrapper">
                <GoogleButton
                    label="Đăng ký với Google"
                    clientId={googleClientId}
                    disabled={googleProcessing}
                    onSuccess={onGoogleRegisterSuccess}
                    onError={onGoogleRegisterError}
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

export default memo(SignupPage);
