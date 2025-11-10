import { useState } from "react";
import { useSelector } from "react-redux";
import { API } from "../redux/apiRequest";
import "./styleAdd.scss";

const ProductForm = ({ initialData, onSubmit }) => {
  const isFetching = useSelector((s) => s.product?.create?.isFetching);
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [unit, setUnit] = useState(initialData?.unit || "kg");
  const [family, setFamily] = useState(initialData?.family || "");
  const [image, setImage] = useState(initialData?.image || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      description,
      price: 0, // Giá sẽ được quản lý qua lô hàng
      category,
      unit,
      family: family.trim(),
      image,             // BE sẽ tự wrap string -> [string]
      discountPercent: 0,
    };
    onSubmit(payload);
  };
  
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              style={{ flex: 1 }}
            />
            <label className="upload-btn" style={{ cursor: 'pointer' }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!/^image\//.test(file.type)) return alert("Vui lòng chọn file ảnh");
                  if (file.size > 5 * 1024 * 1024) return alert("Ảnh tối đa 5MB");
                  try {
                    setUploading(true);
                    setUploadError("");
                    const form = new FormData();
                    form.append('images', file);
                    const token = localStorage.getItem('accessToken') || '';
                    const res = await API.post('/upload', form, {
                      headers: {
                        Authorization: token ? `Bearer ${token}` : undefined,
                        'Content-Type': 'multipart/form-data',
                      },
                      validateStatus: () => true,
                    });
                    if (res.status !== 200 || !res.data?.urls?.[0]) {
                      console.error('Upload error', res.data);
                      setUploadError(res.data?.message || 'Upload thất bại');
                      return;
                    }
                    setImage(res.data.urls[0]);
                    alert('Upload ảnh thành công');
                  } catch (err) {
                    console.error(err);
                    setUploadError(err?.message || 'Upload thất bại');
                  } finally {
                    setUploading(false);
                    // reset input
                    e.target.value = '';
                  }
                }}
              />
              <span className="button-mini">Tải lên</span>
            </label>
          </div>
          {uploading && <small className="muted">Đang tải ảnh...</small>}
          {uploadError && <small style={{ color: 'red' }}>{uploadError}</small>}
        </label>

        {image && (
          <div className="image-preview full-width" style={{ marginTop: 8 }}>
            <img src={Array.isArray(image) ? image[0] : image} alt="preview" style={{ maxWidth: 160, maxHeight: 160, objectFit: 'cover', borderRadius: 6 }} />
          </div>
        )}


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
