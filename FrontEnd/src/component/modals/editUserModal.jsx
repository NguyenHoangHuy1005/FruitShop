import React, { useState } from "react";
import "./style.scss";
import { useDispatch, useSelector } from "react-redux";
import { updateUser } from "../redux/apiRequest";


const EditUserModal = ({ user, onClose }) => {
  const currentUser = useSelector((state) => state.auth.login?.currentUser);
  const accessToken = currentUser?.accessToken;

  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");

  const dispatch = useDispatch();

  const handleSubmit = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phoneRegex = /^(0|\+84)(\d{9})$/; // Ví dụ số VN 10 số, bắt đầu bằng 0 hoặc +84

    if (!username || !email || !phone) {
      alert("Vui lòng điền đầy đủ thông tin!");
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
    const updatedUser = { username, email, phone };
    updateUser(user._id, updatedUser, accessToken, dispatch);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Chỉnh sửa người dùng</h3>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button onClick={handleSubmit}>Lưu</button>
        <button onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
};


export default EditUserModal;
