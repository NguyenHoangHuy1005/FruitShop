import { useState } from "react";
import { useSelector } from "react-redux";
import { changePassword } from "../../../component/redux/apiRequest";
import "../../../component/orders/orderStatus.scss";
import "../theme.scss";
import "./style.scss";

const Profile = () => {
  const user = useSelector((s) => s.auth?.login?.currentUser);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");
    try {
      setLoading(true);
      await changePassword({
        currentPassword: form.current,
        newPassword: form.next,
        confirmPassword: form.confirm,
      });
      setStatus("Đổi mật khẩu thành công.");
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setStatus(err?.message || "Đổi mật khẩu thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shipper-page">
      <h1>Thông tin shipper</h1>
      <div className="shipper-card shipper-profile__card">
        <div><strong>Tên:</strong> {user?.username || user?.fullname || "N/A"}</div>
        <div><strong>Email:</strong> {user?.email}</div>
        <div><strong>Phone:</strong> {user?.phone}</div>
        <div><strong>Role:</strong> {user?.role || "shipper"}</div>
      </div>
      <div className="shipper-card shipper-profile__card">
        <h3>Đổi mật khẩu</h3>
        {status && <p className="shipper-profile__status">{status}</p>}
        <form className="shipper-profile__form" onSubmit={handleSubmit}>
          <label>
            <span>Mật khẩu hiện tại</span>
            <input
              type="password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              required
            />
          </label>
          <label>
            <span>Mật khẩu mới</span>
            <input
              type="password"
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <label>
            <span>Nhập lại mật khẩu mới</span>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
              minLength={6}
            />
          </label>
          <div className="shipper-profile__actions">
            <button type="submit" className="action-btn action-btn--confirm" disabled={loading}>
              {loading ? "Đang đổi..." : "Cập nhật"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
