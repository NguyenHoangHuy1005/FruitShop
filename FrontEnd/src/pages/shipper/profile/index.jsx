import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  confirmEmailChange,
  requestEmailChange,
  requestPasswordReset,
  resetPassword,
  updateProfile,
} from "../../../component/redux/apiRequest";
import "../../../component/orders/orderStatus.scss";
import "../theme.scss";
import "./style.scss";

const normalizeOtp = (value) => String(value || "").replace(/\D/g, "").slice(0, 6);

const StatusLine = ({ state }) =>
  state?.message ? (
    <p className={`shipper-profile__status shipper-profile__status--${state.type || "info"}`}>
      {state.message}
    </p>
  ) : null;

const Profile = () => {
  const user = useSelector((s) => s.auth?.login?.currentUser);
  const dispatch = useDispatch();

  const [profileForm, setProfileForm] = useState({
    fullname: user?.fullname || user?.username || "",
    phone: user?.phone || "",
  });
  useEffect(() => {
    setProfileForm({
      fullname: user?.fullname || user?.username || "",
      phone: user?.phone || "",
    });
  }, [user?.fullname, user?.phone, user?.username]);

  const [profileStatus, setProfileStatus] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [emailForm, setEmailForm] = useState({ newEmail: "", otp: "" });
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [pwdForm, setPwdForm] = useState({ current: "", otp: "", newPassword: "", confirm: "" });
  const [pwdStatus, setPwdStatus] = useState(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const disabled = !user;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileStatus(null);
    try {
      setProfileLoading(true);
      const { ok, error } = await updateProfile(profileForm, dispatch);
      if (!ok) throw new Error(error?.message || "Cập nhật thất bại");
      setProfileStatus({ type: "success", message: "Đã cập nhật thông tin" });
    } catch (err) {
      setProfileStatus({ type: "error", message: err?.message || "Không thể cập nhật" });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleRequestEmailOtp = async () => {
    const mail = String(emailForm.newEmail || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setEmailStatus({ type: "error", message: "Email mới không hợp lệ" });
      return;
    }
    setEmailStatus(null);
    try {
      setEmailLoading(true);
      const res = await requestEmailChange(mail);
      if (res?.status === 200) {
        setEmailStatus({
          type: "success",
          message: res?.data?.message || "Đã gửi mã xác nhận tới email hiện tại",
        });
      } else {
        setEmailStatus({
          type: "error",
          message: res?.data?.message || "Không thể gửi mã xác nhận",
        });
      }
    } catch (err) {
      setEmailStatus({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Không thể gửi mã xác nhận",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleConfirmEmail = async () => {
    const otp = normalizeOtp(emailForm.otp);
    if (otp.length !== 6) {
      setEmailStatus({ type: "error", message: "Mã xác nhận phải có 6 chữ số" });
      return;
    }
    setEmailStatus(null);
    try {
      setEmailLoading(true);
      const res = await confirmEmailChange(otp, dispatch);
      if (res?.status === 200) {
        setEmailStatus({ type: "success", message: res?.data?.message || "Đổi email thành công" });
        setEmailForm({ newEmail: "", otp: "" });
        setShowEmailForm(false);
      } else {
        setEmailStatus({
          type: "error",
          message: res?.data?.message || "Không thể xác nhận email mới",
        });
      }
    } catch (err) {
      setEmailStatus({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Không thể xác nhận email",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const otp = normalizeOtp(pwdForm.otp);
    if (otp.length !== 6) {
      setPwdStatus({ type: "error", message: "Mã xác thực phải có 6 chữ số" });
      return;
    }
    if (!pwdForm.current.trim()) {
      setPwdStatus({ type: "error", message: "Vui lòng nhập mật khẩu hiện tại" });
      return;
    }
    if (!pwdForm.newPassword.trim()) {
      setPwdStatus({ type: "error", message: "Vui lòng nhập mật khẩu mới" });
      return;
    }
    if (!pwdForm.newPassword || pwdForm.newPassword.length < 6) {
      setPwdStatus({ type: "error", message: "Mật khẩu mới cần ít nhất 6 ký tự" });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirm) {
      setPwdStatus({ type: "error", message: "Xác nhận mật khẩu không khớp" });
      return;
    }
    setPwdStatus(null);
    try {
      setPwdLoading(true);
      const { ok, error, data } = await resetPassword({
        email: user?.email,
        token: otp,
        newPassword: pwdForm.newPassword,
        password_confirm: pwdForm.confirm,
        currentPassword: pwdForm.current,
      });
      if (!ok) throw new Error(error?.message || data?.message || "Đổi mật khẩu thất bại");
      setPwdStatus({ type: "success", message: data?.message || "Đổi mật khẩu thành công" });
      setPwdForm({ current: "", otp: "", newPassword: "", confirm: "" });
    } catch (err) {
      setPwdStatus({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Không thể đổi mật khẩu",
      });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleRequestPwdOtp = async () => {
    if (!user?.email) {
      setPwdStatus({ type: "error", message: "Không tìm thấy email tài khoản" });
      return;
    }
    try {
      setPwdLoading(true);
      const { ok, data, error } = await requestPasswordReset(user.email);
      if (!ok) throw new Error(error?.message || "Không thể gửi mã");
      setPwdStatus({
        type: "success",
        message: data?.message || "Đã gửi mã xác thực (hiệu lực 10 phút)",
      });
    } catch (err) {
      setPwdStatus({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Không thể gửi mã xác thực",
      });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="shipper-page shipper-profile">
      <h1>Thông tin shipper</h1>
      <div className="shipper-profile__grid">
        <section className="shipper-card shipper-profile__card">
          <div>
            <h3>Cập nhật thông tin</h3>
            <p className="shipper-profile__hint">
              Tên hiển thị và số điện thoại giúp cửa hàng liên hệ với bạn nhanh hơn.
            </p>
          </div>
          <StatusLine state={profileStatus} />
          <form className="shipper-profile__form" onSubmit={handleProfileSubmit}>
            <label>
              <span>Họ tên</span>
              <input
                type="text"
                value={profileForm.fullname}
                disabled={disabled || profileLoading}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, fullname: e.target.value }))
                }
                placeholder="Nhập họ tên của bạn"
              />
            </label>
            <label>
              <span>Số điện thoại</span>
              <input
                type="tel"
                value={profileForm.phone}
                disabled={disabled || profileLoading}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Ví dụ: 09xxxxxxxx"
              />
            </label>
            <div className="shipper-profile__actions">
              <button
                type="submit"
                className="action-btn action-btn--confirm"
                disabled={disabled || profileLoading}
              >
                {profileLoading ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </section>

        <section className="shipper-card shipper-profile__card">
          <div>
            <h3>Đổi email đăng nhập</h3>
            <p className="shipper-profile__hint">
              Mã OTP sẽ gửi đến email hiện tại: <strong>{user?.email}</strong>
            </p>
          </div>
          <StatusLine state={emailStatus} />
          {!showEmailForm ? (
            <div className="shipper-profile__actions">
              <button
                type="button"
                className="action-btn action-btn--reorder"
                onClick={() => setShowEmailForm(true)}
                disabled={disabled}
              >
                Đổi email
              </button>
            </div>
          ) : (
            <div className="shipper-profile__form">
              <label>
                <span>Email mới</span>
                <input
                  type="email"
                  value={emailForm.newEmail}
                  disabled={emailLoading}
                  onChange={(e) => setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))}
                  placeholder="ví dụ: shipper@gmail.com"
                />
              </label>
              <div className="shipper-profile__inline-row">
                <button
                  type="button"
                  className="action-btn action-btn--accept"
                  onClick={handleRequestEmailOtp}
                  disabled={emailLoading}
                >
                  {emailLoading ? "Đang gửi..." : "Gửi mã"}
                </button>
                <input
                  className="shipper-profile__otp"
                  placeholder="Mã 6 số"
                  value={emailForm.otp}
                  disabled={emailLoading}
                  onChange={(e) =>
                    setEmailForm((prev) => ({ ...prev, otp: normalizeOtp(e.target.value) }))
                  }
                />
              </div>
              <div className="shipper-profile__actions">
                <button
                  type="button"
                  className="action-btn action-btn--confirm"
                  onClick={handleConfirmEmail}
                  disabled={emailLoading}
                >
                  Xác nhận
                </button>
                <button
                  type="button"
                  className="action-btn action-btn--cancel"
                  onClick={() => {
                    setShowEmailForm(false);
                    setEmailForm({ newEmail: "", otp: "" });
                    setEmailStatus(null);
                  }}
                  disabled={emailLoading}
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="shipper-card shipper-profile__card">
          <div>
            <h3>Đổi mật khẩu</h3>
            <p className="shipper-profile__hint">
              Nhận mã OTP qua email và đặt mật khẩu mới trong vòng 10 phút.
            </p>
          </div>
          <StatusLine state={pwdStatus} />
          <form className="shipper-profile__form" onSubmit={handlePasswordSubmit}>
            <div className="shipper-profile__inline-row">
              <button
                type="button"
                className="action-btn action-btn--accept"
                onClick={handleRequestPwdOtp}
                disabled={pwdLoading}
              >
                {pwdLoading ? "Đang gửi..." : "Gửi mã OTP"}
              </button>
              <input
                className="shipper-profile__otp"
                placeholder="Mã 6 số"
                value={pwdForm.otp}
                onChange={(e) =>
                  setPwdForm((prev) => ({ ...prev, otp: normalizeOtp(e.target.value) }))
                }
              />
            </div>
            <label>
              <span>Mật khẩu mới</span>
              <input
                type="password"
                value={pwdForm.current}
                onChange={(e) => setPwdForm((prev) => ({ ...prev, current: e.target.value }))}
                placeholder="Nhập mật khẩu hiện tại"
                required
              />
            </label>
            <label>
              <span>Mật khẩu mới</span>
              <input
                type="password"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                minLength={6}
                required
              />
            </label>
            <label>
              <span>Nhập lại mật khẩu</span>
              <input
                type="password"
                value={pwdForm.confirm}
                onChange={(e) => setPwdForm((prev) => ({ ...prev, confirm: e.target.value }))}
                minLength={6}
                required
              />
            </label>
            <div className="shipper-profile__actions">
              <button
                type="submit"
                className="action-btn action-btn--confirm"
                disabled={pwdLoading}
              >
                {pwdLoading ? "Đang đổi..." : "Cập nhật mật khẩu"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Profile;
