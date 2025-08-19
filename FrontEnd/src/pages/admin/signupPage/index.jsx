// src/pages/admin/signup/SignupPage.jsx (đường dẫn thực tế của bạn)
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import "./style.scss";
import { memo, useState } from "react";
import { ROUTERS } from "../../../utils/router";
import { registerUser } from "../../../component/redux/apiRequest";

const SignupPage = () => {
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const navigate = useNavigate();
    const dispatch = useDispatch();

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

        registerUser(newUser, dispatch, navigate);
    };

    return (
        <div className="login">
        <div className="login__container">
            <h2 className="login__title">---ĐĂNG KÝ---</h2>
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

            <button type="submit" className="login__button">Đăng ký</button>
            </form>
        </div>
        </div>
    );
};

export default memo(SignupPage);
