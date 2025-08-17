import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createProduct, getAllProduct } from "../redux/apiRequest";
import "./styleAdd.scss";

const ProductForm = ({ initialData, onSubmit }) => {
  const dispatch = useDispatch();
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [image, setImage] = useState(initialData?.image || "");
  const [status, setStatus] = useState(initialData?.status || "Còn hàng");
  const isFetching = useSelector((state) => state.product?.create?.isFetching);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newProduct = {
      name: name,
      description: description,
      price: price,
      category: category,
      image: image,
      status: status,
    };

    if (initialData) {
      // createProduct(newProduct, dispatch);
      onSubmit(newProduct);
    } else {
      // createProduct(newProduct, dispatch);
      onSubmit(newProduct);
    }

  };

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
          <option value="Rau củ">Rau củ</option>
          <option value="Trái cây">Trái cây</option>
          <option value="Thịt tươi">Thịt tươi</option>
          <option value="Hải sản">Hải sản</option>
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

      <button type="submit" className="button-submit">
        {initialData ? "Sửa" : "Thêm sản phẩm"}
      </button>
    </form>
  );
};

export default ProductForm;
