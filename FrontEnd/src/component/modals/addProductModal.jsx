import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createProduct, getAllProduct } from "../redux/apiRequest";
import "./styleAdd.scss";

const ProductForm = ({ initialData, onSubmit }) => {
  const isFetching = useSelector((s) => s.product?.create?.isFetching);
  const dispatch = useDispatch();
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [image, setImage] = useState(initialData?.image || "");
  const [status, setStatus] = useState(initialData?.status || "Còn hàng");
  const [discountPercent, setDiscountPercent] = useState(initialData?.discountPercent ?? 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    const payload = {
      name: name.trim(),
      description,
      price: Number(price) || 0,
      category,
      image,             // BE sẽ tự wrap string -> [string]
      status,
      discountPercent: pct,
    };
    onSubmit(payload);
  };
  const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const previewNew = Math.max(0, Math.round((Number(price) || 0) * (100 - pct) / 100));
  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <h2>{initialData ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}</h2>

      <label>
        Tên sản phẩm *
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label>
        Mô tả
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={10}
        />
      </label>

      <label>
        Giá (VNĐ) *
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>

      <label>
        Danh mục *
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Chọn danh mục</option>
          <option value="Trái cây">Trái cây</option>
          <option value="Rau củ">Rau củ</option>
          <option value="Giỏ quà tặng">Giỏ quà tặng</option>
          <option value="Hoa trái cây">Hoa trái cây</option>
          <option value="Thực phẩm khô">Thực phẩm khô</option>
        </select>
      </label>

      <label>
        Ảnh sản phẩm (URL)
        <input
          type="url"
          placeholder="Nhập URL ảnh"
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />
      </label>

      <label>
        Trạng thái *
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="Còn hàng">Còn hàng</option>
          <option value="Hết hàng">Hết hàng</option>
        </select>
      </label>

      <label>
        Giảm giá (%)
        <input
          type="number"
          min="0"
          max="100"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
        />
      </label>

      {/* Xem trước giá sau giảm */}
      <div className="price-preview">
        {pct > 0 ? (
          <>
            <del style={{ opacity: 0.7 }}>
              {(Number(price) || 0).toLocaleString()} VND
            </del>{" "}
            <strong>{previewNew.toLocaleString()} VND</strong>
          </>
        ) : (
          <strong>{(Number(price) || 0).toLocaleString()} VND</strong>
        )}
      </div>

      <label>
        Trạng thái *
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="Còn hàng">Còn hàng</option>
          <option value="Hết hàng">Hết hàng</option>
        </select>
      </label>

      <button type="submit" className="button-submit" disabled={isFetching}>
        {initialData ? "Sửa" : "Thêm sản phẩm"}
      </button>
    </form>
    
  );
};

export default ProductForm;
