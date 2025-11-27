import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../../component/redux/apiRequest";
import { ROUTERS } from "../../../utils/router";
import ShipperOrderRealtimeBridge from "../OrderRealtimeBridge";
import "../theme.scss";
import "./style.scss";

const ShipperLayout = ({ children }) => {
  const user = useSelector((s) => s.auth?.login?.currentUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout(dispatch, navigate, user?.accessToken, user?._id || user?.id);
  };

  return (
    <div className="shipper-shell">
      <ShipperOrderRealtimeBridge />
      <header className="shipper-shell__header">
        <div className="shipper-shell__brand">Shipper</div>
        <nav className="shipper-shell__nav">
          <NavLink to={ROUTERS.SHIPPER.DASHBOARD}>Trang chủ</NavLink>
          <NavLink to={ROUTERS.SHIPPER.INCOME}>Thu nhập</NavLink>
          <NavLink to={ROUTERS.SHIPPER.ORDERS}>Đơn hàng</NavLink>
          <NavLink to={ROUTERS.SHIPPER.DELIVERING}>Đang giao</NavLink>
          <NavLink to={ROUTERS.SHIPPER.PROFILE}>Hồ sơ</NavLink>
        </nav>
        <div className="shipper-shell__actions">
          <button type="button" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </header>
      <main className="shipper-shell__body">
        <div className="shipper-shell__content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default ShipperLayout;
