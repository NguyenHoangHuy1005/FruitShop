import { memo, useEffect, useMemo, useState } from "react";
import "./style.scss";
import { listStock, stockIn, stockSet, getAllProduct } from "../../../component/redux/apiRequest";
import { useDispatch } from "react-redux";

const StockManagerPage = () => {
    const dispatch = useDispatch();
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setBusy(true);
        try {
        const data = await listStock();
        setRows(Array.isArray(data) ? data : []);
        } finally { setBusy(false); }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter(r => (r.productDoc?.name || "").toLowerCase().includes(s));
    }, [rows, q]);

    const onStockIn = async (productId) => {
        const v = prompt("Nhập số lượng cần nhập thêm (+):", "10");
        if (v === null) return; // ⛔ nếu bấm Hủy thì thoát luôn

        const qty = Math.max(1, parseInt(v, 10) || 0);
        if (!qty) return;

        setBusy(true);
        try {
            await stockIn(productId, qty);
            await load();
            await getAllProduct(dispatch);
            alert("Nhập kho thành công!");
        } catch (e) {
            alert(e?.message || "Nhập kho thất bại!");
        } finally {
            setBusy(false);
        }
    };

    const onStockSet = async (productId) => {
        const v = prompt("Đặt lại số tồn (>=0):", "0");
        if (v === null) return; // ⛔ Nếu bấm Hủy thì thoát ngay

        const qty = Math.max(0, parseInt(v, 10) || 0);

        setBusy(true);
        try {
            await stockSet(productId, qty);
            await load();
            await getAllProduct(dispatch);
            alert("Cập nhật tồn kho thành công!");
        } catch (e) {
            alert(e?.message || "Cập nhật tồn kho thất bại!");
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="container">
        <h2>QUẢN LÝ TỒN KHO</h2>

        <div className="toolbar">
            <input
            type="text"
            placeholder="Tìm theo tên sản phẩm..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            />
            {busy && <span className="busy">Đang xử lý...</span>}
        </div>

        <table className="stock-table">
            <thead>
            <tr>
                <th>Ảnh</th>
                <th>Tên sản phẩm</th>
                <th>Tồn hiện tại</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
            </tr>
            </thead>
            <tbody>
            {filtered.map((r) => {
                const p = r.productDoc || {};
                const img = Array.isArray(p.image) ? (p.image[0] || "/placeholder.png") : (p.image || "/placeholder.png");
                return (
                <tr key={String(r._id || p._id)}>
                    <td><img src={img} alt={p.name || ""} style={{ width: 56, height: 56, objectFit: "cover" }} /></td>
                    <td>{p.name || "—"}</td>
                    <td><b>{Number(r.onHand || 0)}</b></td>
                    <td>
                    <span className={Number(r.onHand || 0) > 0 ? "status in-stock" : "status out-stock"}>
                        {Number(r.onHand || 0) > 0 ? "Còn hàng" : "Hết hàng"}
                    </span>
                    </td>
                    <td className="actions">
                    <button className="btn" onClick={() => onStockIn(p._id)}>Nhập kho</button>
                    <button className="btn outline" onClick={() => onStockSet(p._id)}>Đặt tồn</button>
                    </td>
                </tr>
                );
            })}
            {!filtered.length && (
                <tr><td colSpan={5} className="no-data">Không có dữ liệu</td></tr>
            )}
            </tbody>
        </table>
        </div>
    );
};

export default memo(StockManagerPage);
