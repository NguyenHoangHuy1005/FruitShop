import { useState } from "react";
import "./style.scss";

const RoleModal = ({ user, onClose, onSubmit }) => {
    const [role, setRole] = useState(user.admin ? "admin" : "user");

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ admin: role === "admin" });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content role-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Phân quyền người dùng</h3>
                <p><b>Username:</b> {user.username}</p>
                <p><b>Email:</b> {user.email}</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="role">Vai trò:</label>
                        <select 
                            id="role" 
                            value={role} 
                            onChange={(e) => setRole(e.target.value)}
                            className="role-select"
                        >
                            <option value="user">User (Người dùng)</option>
                            <option value="admin">Admin (Quản trị viên)</option>
                        </select>
                    </div>

                    <div className="modal-actions">
                        <button type="submit" className="btn-submit">
                            Lưu thay đổi
                        </button>
                        <button type="button" className="btn-cancel" onClick={onClose}>
                            Hủy
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoleModal;
