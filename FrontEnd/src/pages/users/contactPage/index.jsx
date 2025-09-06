import { memo, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import "./style.scss";
// axios instance (nếu có)
import { API } from "../../../component/redux/apiRequest";

const AREAS = [
    "TP. Hồ Chí Minh",
    "Hà Nội",
    "Miền Bắc khác",
    "Miền Trung",
    "Miền Nam khác",
];

const TOPICS = [
    "Tư vấn sản phẩm",
    "Khiếu nại / Bảo hành",
    "Chính sách & Hoá đơn",
    "Hợp tác & Đại lý",
    "Góp ý khác",
];

const MAX_FILE_MB = 5;

const ContactPage = () => {
    const user = useSelector((s) => s.auth?.login?.currentUser);
    const API_BASE = useMemo(
        () => import.meta.env.VITE_API_BASE || "http://localhost:3000/api",
        []
    );

    // ====== State ======
    const [form, setForm] = useState({
        name: user?.fullname || user?.username || "",
        email: user?.email || "",
        phone: user?.phone || "",
        area: "",
        topic: "",
        content: "",
        file: null,
    });
    const [busy, setBusy] = useState(false);

    // ====== Helpers ======
    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const onPickFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return setField("file", null);
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
        alert(`File tối đa ${MAX_FILE_MB}MB`);
        e.target.value = "";
        return;
        }
        setField("file", file);
    };

    const validate = () => {
        if (!form.name.trim()) return "Vui lòng nhập họ tên";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        return "Email không hợp lệ";
        if (!form.phone.trim()) return "Vui lòng nhập số điện thoại";
        if (!form.area) return "Vui lòng chọn khu vực";
        if (!form.topic) return "Vui lòng chọn chủ đề";
        if (!form.content.trim()) return "Vui lòng nhập nội dung";
        return "";
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        const err = validate();
        if (err) return alert(err);

        try {
        setBusy(true);
        const fd = new FormData();
        fd.append("name", form.name.trim());
        fd.append("email", form.email.trim());
        fd.append("phone", form.phone.trim());
        fd.append("area", form.area);
        fd.append("topic", form.topic);
        fd.append("content", form.content.trim());
        if (form.file) fd.append("file", form.file);

        let res;
        if (API?.post) res = await API.post("/contact", fd);
        else res = await fetch(`${API_BASE}/contact`, { method: "POST", body: fd });

        if (res?.status === 200 || res?.ok) {
            alert("Đã gửi liên hệ. Chúng tôi sẽ phản hồi sớm nhất!");
            setForm((f) => ({ ...f, area: "", topic: "", content: "", file: null }));
            const fileInput = document.getElementById("contact-file");
            if (fileInput) fileInput.value = "";
        } else {
            alert("Gửi thất bại. Vui lòng thử lại sau.");
        }
        } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra. Vui lòng thử lại sau.");
        } finally {
        setBusy(false);
        }
    };

    return (
        <div className="contact__wrap">
            <h1>LIÊN HỆ VỚI FRUIT SHOP</h1>
            <p className="lead">
                Fruit Shop luôn trân trọng mọi ý kiến đóng góp của Quý khách. Vui lòng
                điền thông tin dưới đây, chúng tôi sẽ liên hệ trong thời gian sớm nhất.
            </p>

            <form className="contact__form card" onSubmit={onSubmit}>
                {/* Họ tên / SĐT */}
                <div className="row two">
                    <div className="field">
                        <label>Họ tên <span className="req">*</span></label>
                        <input
                        placeholder="VD: Nguyễn Văn A"
                        value={form.name}
                        onChange={(e) => setField("name", e.target.value)}
                        />
                    </div>

                    <div className="field">
                        <label>Số điện thoại <span className="req">*</span></label>
                        <input
                        placeholder="VD: 09xxxxxxxx"
                        value={form.phone}
                        onChange={(e) => setField("phone", e.target.value)}
                        />
                    </div>
                </div>

                {/* Email */}
                <div className="row">
                    <div className="field">
                        <label>Email <span className="req">*</span></label>
                        <input
                        placeholder="vd: ten@gmail.com"
                        value={form.email}
                        onChange={(e) => setField("email", e.target.value)}
                        />
                    </div>
                </div>

                {/* Khu vực / Chủ đề */}
                <div className="row two">
                    <div className="field select-wrap">{/* wrapper để xử lý caret */}
                        <label>Chọn khu vực <span className="req">*</span></label>
                        <select
                        value={form.area}
                        onChange={(e) => setField("area", e.target.value)}
                        >
                        <option value="">-- Chọn khu vực --</option>
                        {AREAS.map((a) => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                        </select>
                    </div>

                    <div className="field select-wrap">
                        <label>Chọn chủ đề để liên hệ <span className="req">*</span></label>
                        <select
                        value={form.topic}
                        onChange={(e) => setField("topic", e.target.value)}
                        >
                        <option value="">-- Chọn chủ đề --</option>
                        {TOPICS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                        </select>
                    </div>
                </div>

                {/* Nội dung */}
                <div className="row">
                    <div className="field">
                        <label>Nội dung <span className="req">*</span></label>
                        <textarea
                        rows={7}
                        placeholder="Nhập nội dung cần liên hệ..."
                        value={form.content}
                        onChange={(e) => setField("content", e.target.value)}
                        />
                    </div>
                </div>

                {/* Đính kèm */}
                <div className="row">
                    <div className="field file-field">
                        <label>Hình ảnh đính kèm (GIF, PNG, JPG, JPEG)</label>
                        <input
                        id="contact-file"
                        type="file"
                        accept="image/*"
                        onChange={onPickFile}
                        />
                        <div className="hint">Tối đa {MAX_FILE_MB}MB.</div>
                        <div className="note">
                            <span className="req">*</span> Nội dung bắt buộc
                        </div>
                    </div>
                </div>

                <div className="actions center">
                    <button type="submit" className="btn primary big" disabled={busy}>
                        GỬI
                    </button>
                </div>

            </form>
        </div>
    );
};

export default memo(ContactPage);
