import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import "./style.scss";
import { memo } from 'react';
import React, { useState } from 'react';
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
        const phoneRegex = /^(0|\+84)(\d{9})$/; // Ví dụ số VN 10 số, bắt đầu bằng 0 hoặc +84
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
            email: email,
            username: username,
            password: password,
            phone: phone,
        };

        registerUser(newUser, dispatch, navigate);
    }
    //navigate(ROUTERS.ADMIN.LOGIN);

    return <div className="login">
        <div className="login__container">
            <h2 className="login__title">---ĐĂNG KÝ---</h2>

            <form className="login__form" onSubmit={handleSubmit}>
                <div className="login__form-group">
                    <label htmlFor="Username" className="login__label">
                        Tên đăng nhập
                    </label>
                    <input type="text" name="username" id="username" required
                        onChange={(e) => setUsername(e.target.value)} />
                </div>

                <div className="login__form-group">
                    <label htmlFor="Password" className="login__label">
                        Mật khẩu
                    </label>
                    <input type="password" name="password" id="password" required
                        onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="login__form-group">
                    <label htmlFor="Password" className="login__label">
                        Nhập lại mật khẩu
                    </label>
                    <input type="password" name="ConfirmPassword" id="ConfirmPassword" required
                        onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>

                <div className="login__form-group">
                    <label htmlFor="email" className="login__label">
                        Email
                    </label>
                    <input type="email" name="email" id="email" required
                        onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div className="login__form-group">
                    <label htmlFor="phone" className="login__label">
                        Số điện thoại
                    </label>
                    <input type="phone" name="phone" id="phone" required
                        onChange={(e) => setPhone(e.target.value)} />
                </div>

                <button type="submit" className="login__button">Đăng KÝ</button>


            </form>

        </div>
    </div>
};

export default memo(SignupPage);
