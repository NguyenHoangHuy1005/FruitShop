import { useState } from "react";
import { useSelector } from "react-redux";
import "./styleAdd.scss";

const ProductForm = ({ initialData, onSubmit }) => {
  const isFetching = useSelector((s) => s.product?.create?.isFetching);
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [unit, setUnit] = useState(initialData?.unit || "kg");
  const [family, setFamily] = useState(initialData?.family || "");
  const [image, setImage] = useState(initialData?.image || "");
  const [discountPercent, setDiscountPercent] = useState(initialData?.discountPercent ?? 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    const payload = {
      name: name.trim(),
      description,
      price: Number(price) || 0,
      category,
      unit,
      family: family.trim(),
      image,             // BE sẽ tự wrap string -> [string]
      discountPercent: pct,
    };
    onSubmit(payload);
  };
  const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const originalPrice = Number(price) || 0;
  const discountedPrice = Math.max(0, Math.round(originalPrice * (100 - pct) / 100));
  
  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <h2>{initialData ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới"}</h2>

      <div className="form-grid">
        <label className="full-width">
          <span className="label-text">Tên sản phẩm <span className="required">*</span></span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Táo Fuji nhập khẩu"
            required
          />
        </label>

        <label className="full-width">
          <span className="label-text">Mô tả</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Mô tả chi tiết về sản phẩm..."
          />
        </label>

        <label>
          <span className="label-text">Giá gốc (VNĐ) <span className="required">*</span></span>
          <input
            type="number"
            min="0"
            step="1000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            required
          />
        </label>

        <label>
          <span className="label-text">Giảm giá (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            placeholder="0"
          />
        </label>

        <label>
          <span className="label-text">Danh mục <span className="required">*</span></span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">-- Chọn danh mục --</option>
            <option value="Trái cây">🍎 Trái cây</option>
            <option value="Rau củ">🥬 Rau củ</option>
            <option value="Giỏ quà tặng">🎁 Giỏ quà tặng</option>
            <option value="Hoa trái cây">🌺 Hoa trái cây</option>
            <option value="Thực phẩm khô">🥜 Thực phẩm khô</option>
          </select>
        </label>

        <label>
          <span className="label-text">Đơn vị tính <span className="required">*</span></span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} required>
            <option value="kg">Kilogram (kg)</option>
            <option value="cái">Cái</option>
            <option value="giỏ">Giỏ</option>
            <option value="bó">Bó</option>
            <option value="hộp">Hộp</option>
            <option value="túi">Túi</option>
          </select>
        </label>

        <label className="full-width">
          <span className="label-text">Họ sản phẩm</span>
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">-- Không chọn --</option>
            <option value="Bơ">🥑 Bơ</option>
            <option value="Bưởi">🍊 Bưởi</option>
            <option value="Cam">🍊 Cam</option>
            <option value="Cherry">🍒 Cherry</option>
            <option value="Chuối">🍌 Chuối</option>
            <option value="Dâu">🍓 Dâu</option>
            <option value="Dưa">🍉 Dưa</option>
            <option value="Nho">🍇 Nho</option>
            <option value="Lê">🍐 Lê</option>
            <option value="Táo">🍎 Táo</option>
            <option value="Xoài">🥭 Xoài</option>
          </select>
        </label>

        <label className="full-width">
          <span className="label-text">Ảnh sản phẩm (URL)</span>
          <input
            type="url"
            placeholder="https://example.com/image.jpg"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
        </label>

        {/* Xem trước giá */}
        <div className="price-preview full-width">
          <div className="preview-label">💰 Giá bán:</div>
          <div className="preview-content">
            {pct > 0 ? (
              <>
                <span className="original-price">{originalPrice.toLocaleString()} ₫</span>
                <span className="discount-badge">-{pct}%</span>
                <span className="final-price">{discountedPrice.toLocaleString()} ₫</span>
              </>
            ) : (
              <span className="final-price">{originalPrice.toLocaleString()} ₫</span>
            )}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="button-submit" disabled={isFetching}>
          {isFetching ? (
            <><span className="spinner"></span> Đang xử lý...</>
          ) : (
            <>{initialData ? "💾 Cập nhật" : "➕ Thêm sản phẩm"}</>
          )}
        </button>
      </div>
    </form>
    
  );
};

export default ProductForm;
