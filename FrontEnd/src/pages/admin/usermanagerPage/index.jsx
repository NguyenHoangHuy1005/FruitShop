import { useNavigate } from "react-router-dom";
import "./style.scss";
import { memo, useEffect, useState } from "react";
import { ROUTERS } from "../../../utils/router";
import { getAllUsers, deleteUser, updateUser } from "../../../component/redux/apiRequest";
import { useSelector, useDispatch } from "react-redux";
import EditUserModal from "../../../component/modals/editUserModal";

// Chuẩn hóa đầu/cuối ngày cho lọc khoảng
const toStartOfDay = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};
const toEndOfDay = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
};


const UserManagerPage = () => {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.login?.currentUser);
    const userList = useSelector((state) => state.user.users?.allUsers);

    const [editingUser, setEditingUser] = useState(null);
    const [viewingUser, setViewingUser] = useState(null); // ✅ user đang xem
    // Bộ lọc
    const [q, setQ] = useState("");           // mã/username/email/phone
    const [fromDate, setFromDate] = useState(""); // YYYY-MM-DD
    const [toDate, setToDate]     = useState(""); // YYYY-MM-DD


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
        setEditingUser(null);
    };

    console.log("Danh sách user:", userList);

    const viewUsers = (Array.isArray(userList) ? userList : []).filter((u) => {
        const key = q.trim().toLowerCase();
        const from = toStartOfDay(fromDate);
        const to   = toEndOfDay(toDate);

        // match text: id, username, email, phone
        const haystack = [
            u?._id, u?.username, u?.email, u?.phone
        ].map(x => (x || "").toString().toLowerCase()).join(" | ");

        let ok = !key || haystack.includes(key);

        const created = u?.createdAt ? new Date(u.createdAt) : null;
        if (ok && from && created) ok = created >= from;
        if (ok && to   && created) ok = created <= to;

        return ok;
    });

    return (
        <div className="container">
            <div className="user-management">
                <h2>QUẢN LÝ KHÁCH HÀNG</h2>

                {/* Toolbar bộ lọc */}
                <div className="user-toolbar toolbar-card">
                    <div className="field grow">
                        <label>Tìm kiếm</label>
                        <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="ID / Username / Email / SĐT…"
                        />
                    </div>

                    <div className="field">
                        <label>Từ ngày</label>
                        <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        title="Từ ngày (ngày đăng ký)"
                        />
                    </div>

                    <div className="dash">→</div>

                    <div className="field">
                        <label>Đến ngày</label>
                        <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        title="Đến ngày (ngày đăng ký)"
                        />
                    </div>

                    <button
                        className="btn-clear"
                        onClick={() => { setQ(""); setFromDate(""); setToDate(""); }}
                    >
                        Xóa lọc
                    </button>
                </div>


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

                        {viewUsers.length > 0 ? (
                            [...viewUsers]
                                .sort((a, b) => a._id.localeCompare(b._id))
                                .map((u, index) => (
                                    <tr key={u._id}>
                                        <td>{index + 1}</td>
                                        <td>{u.username || "-"}</td>
                                        <td>{u.email || "-"}</td>
                                        <td>{u.phone || "-"}</td>
                                        <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}</td>
                                        <td>{u.totalOrders}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    type="button"
                                                    className="view-btn"
                                                    onClick={() => setViewingUser(u)} // ✅ gán user đang xem
                                                >
                                                    Xem
                                                </button>
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
                                    Không có khách hàng phù hợp bộ lọc.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* ✅ Khu vực hiển thị chi tiết user ngay trong trang */}
                {viewingUser && (
                    <div className="user-details">
                        <h3>Chi tiết khách hàng</h3>
                        <p><b>Tên người dùng:</b> {viewingUser.username || "-"}</p>
                        <p><b>Email:</b> {viewingUser.email || "-"}</p>
                        <p><b>Số điện thoại:</b> {viewingUser.phone || "-"}</p>
                        <p><b>Ngày đăng ký:</b> {viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleString() : "-"}</p>
                        <p><b>Số đơn hàng:</b> {viewingUser.totalOrders ?? 0}</p>

                        <button className="close-btn" onClick={() => setViewingUser(null)}>Đóng</button>
                    </div>
                )}
            </div>

            {/* Modal sửa */}
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
