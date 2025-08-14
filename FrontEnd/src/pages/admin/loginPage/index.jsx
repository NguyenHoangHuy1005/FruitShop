import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import "./style.scss";
import React, { useState } from 'react'
import { memo } from 'react';
import { Link } from "react-router-dom";
import { ROUTERS } from "../../../utils/router";
import { loginUser } from "../../../component/redux/apiRequest";
const LoginAdminPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        // navigate(ROUTERS.ADMIN.ORDERS);
        const newUser = {
            username: username,
            password: password
        };

        loginUser(newUser, dispatch, navigate);
    };


    return <div className="login">
        <div className="login__container">
            <h2 className="login__title">---ĐĂNG NHẬP---</h2>

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
                <button type="submit" className="login__button">Đăng nhập</button>
                <Link to={ROUTERS.ADMIN.SIGNUP}>Đăng ký</Link>
                <p>Hoặc</p>
                <Link to="#">Quên mật khẩu?</Link>
            </form>

        </div>
    </div>
};

export default memo(LoginAdminPage);
