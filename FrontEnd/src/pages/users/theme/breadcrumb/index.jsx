import { memo } from "react";
import "./style.scss";
import { Link } from "react-router-dom";
import { ROUTERS } from "../../../../utils/router";

const Breadcrumb = ({ paths = [] }) => {
  return (
    <div className="breadcrumb">
      <div className="breadcrumb__text">
        <h2>FRUITSHOP</h2>
        <div className="breadcrumb__option">
          <ul>
            {/* Trang chủ luôn luôn có */}
            <li>
              <Link to={ROUTERS.USER.HOME}>Trang chủ</Link>
            </li>

            {/* Render các đường dẫn được truyền vào */}
            {paths.map((item, index) => (
              <li key={index}>
                {item.to ? (
                  <Link to={item.to}>{item.label}</Link>
                ) : (
                  <span>{item.label}</span> // cái cuối không phải link
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default memo(Breadcrumb);
