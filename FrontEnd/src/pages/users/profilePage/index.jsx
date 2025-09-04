import { memo, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    requestEmailChange,
    confirmEmailChange,
    updateProfile,
    uploadAvatar,
    requestPasswordReset,
    resetPassword,
} from "../../../component/redux/apiRequest"; // đảm bảo path này đúng theo project của bạn
import "./style.scss";

const ProfilePage = () => {
    const dispatch = useDispatch();
    const user = useSelector((s) => s.auth?.login?.currentUser);
    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";
    const [profile, setProfile] = useState({ fullname: "", phone: "" });
    const [emailForm, setEmailForm] = useState({ newEmail: "", otp: "" });
    const [pwdForm, setPwdForm] = useState({ otp: "", newPassword: "", confirm: "" });
    const [busy, setBusy] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [showPwdForm, setShowPwdForm] = useState(false);

    useEffect(() => {
        if (user) {
        setProfile({
            fullname: user.fullname || "",
            phone: user.phone || "",
        });
        }
    }, [user]);

    if (!user) {
        return (
        <div className="profile__wrap">
            <h1>Hồ sơ cá nhân</h1>
            <div className="card">
            <p>Vui lòng đăng nhập để xem và chỉnh sửa hồ sơ.</p>
            </div>
        </div>
        );
    }

    const avatarUrl = user.avatar
    ? (user.avatar.startsWith("http") ? user.avatar : `${API_BASE.replace("/api","")}${user.avatar}`)
    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        user.fullname || user.username || "User"
        )}&background=%23e2e8f0`;


    // ===== Avatar upload =====
    const onPickAvatar = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) return alert("Vui lòng chọn file ảnh");
        if (file.size > 3 * 1024 * 1024) return alert("Ảnh tối đa 3MB");
        try {
            setBusy(true);
            await uploadAvatar(file, dispatch);
            alert("Cập nhật avatar thành công");
        } catch (err) {
            console.error(err);
            alert("Upload thất bại");
        } finally {
            setBusy(false);
            e.target.value = "";
        }
    };

    // ===== Lưu thông tin cơ bản =====
    const onSaveProfile = async (e) => {
        e.preventDefault();
        try {
            setBusy(true);
            const { ok, error } = await updateProfile(profile, dispatch);
            if (!ok) return alert(error?.message || "Cập nhật thất bại");
            alert("Lưu thay đổi thành công");
        } finally {
            setBusy(false);
        }
    };

    // ===== Đổi email qua OTP (gửi về email hiện tại) =====
    const onRequestEmailOTP = async () => {
        const mail = String(emailForm.newEmail || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return alert("Email mới không hợp lệ");
        try {
            setBusy(true);
            const r = await requestEmailChange(mail);
            alert(r?.data?.message || (r?.status === 200 ? "Đã gửi mã" : "Gửi mã thất bại"));
        } finally {
            setBusy(false);
        }
    };

    const onConfirmEmailChange = async () => {
        const code = String(emailForm.otp || "").trim();
        if (!/^\d{6}$/.test(code)) return alert("Mã OTP phải gồm 6 chữ số");
        try {
            setBusy(true);
            const r = await confirmEmailChange(code, dispatch);
            alert(r?.data?.message || (r?.status === 200 ? "Đổi email thành công" : "Thất bại"));
            if (r?.status === 200) setEmailForm({ newEmail: "", otp: "" });
        } finally {
            setBusy(false);
        }
    };

    // ===== Đổi mật khẩu dùng flow forgot/reset sẵn có =====
    const onRequestPwdOTP = async () => {
        try {
            setBusy(true);
            const r = await requestPasswordReset(user.email);
            alert(r?.data?.message || "Nếu email tồn tại, mã đã được gửi (hết hạn sau 10 phút).");
        } finally {
            setBusy(false);
        }
    };

    const onChangePassword = async () => {
        const { otp, newPassword, confirm } = pwdForm;
        if (!otp || !newPassword) return alert("Thiếu mã hoặc mật khẩu mới");
        if (newPassword !== confirm) return alert("Xác nhận mật khẩu không khớp");
        if (newPassword.length < 6) return alert("Mật khẩu phải có ít nhất 6 ký tự");

        try {
            setBusy(true);
            const { ok, error, data } = await resetPassword({
                email: user.email,
                token: String(otp).trim(),
                newPassword,
                password_confirm: confirm,
            });
            if (!ok) return alert(error?.message || data?.message || "Đổi mật khẩu thất bại");
            alert(data?.message || "Đổi mật khẩu thành công");
            setPwdForm({ otp: "", newPassword: "", confirm: "" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="profile__wrap">
            <h1>Hồ sơ cá nhân</h1>

            {/* Avatar */}
            <section className="card">
                <h3>Ảnh đại diện</h3>
                <div className="avatar__row">
                    <div className="avatar__box">
                        <img className="avatar" src={avatarUrl} alt="avatar" />
                        <label className="avatar__btn">
                        <input type="file" accept="image/*" onChange={onPickAvatar} disabled={busy} />
                        Đổi ảnh
                        </label>
                    </div>
                    <div className="muted">
                        JPG/PNG ≤ 3MB. Ảnh sẽ được lưu vào hồ sơ của bạn.
                    </div>
                </div>
            </section>

            {/* Thông tin cơ bản */}
            <section className="card">
                <h3>Thông tin cơ bản</h3>
                <form onSubmit={onSaveProfile} className="grid">
                    <div className="field">
                        <label>Username</label>
                        <input value={user.username} disabled />
                    </div>
                    <div className="field">
                        <label>Họ tên</label>
                        <input
                        value={profile.fullname}
                        onChange={(e) => setProfile((p) => ({ ...p, fullname: e.target.value }))}
                        placeholder="VD: Nguyễn Văn A"
                        />
                    </div>
                    <div className="field">
                        <label>Số điện thoại</label>
                        <input
                        value={profile.phone}
                        onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="VD: 0xxxxxxxxx"
                        />
                    </div>
                    <div className="field">
                        <label>Email hiện tại</label>
                        <input value={user.email} disabled />
                    </div>
                    <div className="actions">
                        <button type="submit" className="btn primary" disabled={busy}>
                        Lưu thay đổi
                        </button>
                    </div>
                </form>
            </section>

            {/* Đổi email */}
            <section className="card">
                <h3>Đổi email</h3>
                {!showEmailForm ? (
                    <button
                    className="btn primary"
                    onClick={() => setShowEmailForm(true)}
                    disabled={busy}
                    >
                    Đổi email
                    </button>
                ) : (
                    <div className="email-change">
                    <div className="field">
                        <label>Email mới</label>
                        <input
                        placeholder="vd: ten@gmail.com"
                        value={emailForm.newEmail}
                        onChange={(e) =>
                            setEmailForm((f) => ({ ...f, newEmail: e.target.value }))
                        }
                        />
                    </div>
                    <div className="row">
                        <button className="btn" onClick={onRequestEmailOTP} disabled={busy}>
                        Gửi mã
                        </button>
                        <input
                        className="otp"
                        placeholder="Mã 6 số"
                        value={emailForm.otp}
                        onChange={(e) =>
                            setEmailForm((f) => ({ ...f, otp: e.target.value }))
                        }
                        />
                        <button
                        className="btn primary"
                        onClick={onConfirmEmailChange}
                        disabled={busy}
                        >
                        Xác nhận
                        </button>
                        <button
                        className="btn"
                        onClick={() => setShowEmailForm(false)}
                        disabled={busy}
                        >
                        Hủy
                        </button>
                    </div>
                    </div>
                )}
            </section>

            {/* Đổi mật khẩu */}
            <section className="card">
                <h3>Đổi mật khẩu</h3>
                {!showPwdForm ? (
                    <button
                    className="btn primary"
                    onClick={() => setShowPwdForm(true)}
                    disabled={busy}
                    >
                    Đổi mật khẩu
                    </button>
                ) : (
                    <div className="grid">
                        <div className="field row gap">
                            <button className="btn" onClick={onRequestPwdOTP} disabled={busy}>
                            Gửi mã
                            </button>
                            <input
                            className="otp"
                            placeholder="Mã 6 số"
                            value={pwdForm.otp}
                            onChange={(e) => setPwdForm((f) => ({ ...f, otp: e.target.value }))}
                            />
                        </div>
                        <div className="field row gap wrap">
                            <input
                            type="password"
                            placeholder="Mật khẩu mới (≥ 6 ký tự)"
                            value={pwdForm.newPassword}
                            onChange={(e) =>
                                setPwdForm((f) => ({ ...f, newPassword: e.target.value }))
                            }
                            />
                            <input
                            type="password"
                            placeholder="Nhập lại mật khẩu"
                            value={pwdForm.confirm}
                            onChange={(e) =>
                                setPwdForm((f) => ({ ...f, confirm: e.target.value }))
                            }
                            />
                            <button
                            className="btn primary"
                            onClick={onChangePassword}
                            disabled={busy}
                            >
                            Đổi mật khẩu
                            </button>
                            <button
                            className="btn"
                            onClick={() => setShowPwdForm(false)}
                            disabled={busy}
                            >
                            Hủy
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

export default memo(ProfilePage);
