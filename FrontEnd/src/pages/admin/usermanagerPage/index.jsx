import { useNavigate } from "react-router-dom";
import "./style.scss";
import { memo, useEffect, useState } from 'react';
import { ROUTERS } from "../../../utils/router";
import { getAllUsers, deleteUser, updateUser } from "../../../component/redux/apiRequest";
import { useSelector, useDispatch } from "react-redux";
import EditUserModal from "../../../component/modals/editUserModal"; // Đảm bảo đúng path

const UserManagerPage = () => {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.login?.currentUser);
    const userList = useSelector((state) => state.user.users?.allUsers);

    const [editingUser, setEditingUser] = useState(null); // để mở modal

    useEffect(() => {
        if (user?.accessToken) {
            getAllUsers(user.accessToken, dispatch);
        }
    }, [user?.accessToken, dispatch]);

    const handleDelete = (id) => {
        deleteUser(user?.accessToken, dispatch, id);
    };

    const handleUpdate = (updatedData) => {
        if (!editingUser) return;
        updateUser(editingUser._id, updatedData, user?.accessToken, dispatch);
        setEditingUser(null); // đóng modal
    };

    return (
        <div className="container">
            <div className="user-management">
                <h2>QUẢN LÝ KHÁCH HÀNG</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Tên người dùng</th>
                            <th>Email</th>
                            <th>Số điện thoại</th>
                            <th>Ngày đăng ký</th>
                            <th>Số đơn hàng</th>
                            <th>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.isArray(userList) && userList.length > 0 ? (
                            [...userList]
                            .sort((a, b) => a._id.localeCompare(b._id))
                            .map((u, index) => (
                                <tr key={u._id}>
                                <td>{index + 1}</td>
                                <td>{u.username || "-"}</td>
                                <td>{u.email || "-"}</td>
                                <td>{u.phone || "-"}</td>
                                <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}</td>
                                <td>{u.totalOrders ?? 0}</td>

                                {/* ✅ Đặt action-buttons trong một ô <td> */}
                                <td>
                                    <div className="action-buttons">
                                    <button type="button" className="view-btn">Xem</button>
                                    <button
                                        type="button"
                                        className="update-btn"
                                        onClick={() => setEditingUser(u)}
                                    >
                                        Sửa
                                    </button>
                                    <button
                                        type="button"
                                        className="ban-btn"
                                        onClick={() => handleDelete(u._id)}
                                    >
                                        Xóa
                                    </button>
                                    </div>
                                </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                            <td colSpan={7} style={{ textAlign: "center", color: "#64748b", padding: 20 }}>
                                Không có khách hàng.
                            </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Hiển thị modal sửa */}
            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSubmit={handleUpdate}
                />
            )}
        </div>
    );
};

export default memo(UserManagerPage);
