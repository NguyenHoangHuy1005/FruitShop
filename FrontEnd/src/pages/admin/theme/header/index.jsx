import { memo, use } from 'react';
import "./style.scss";
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTERS } from "../../../../utils/router";
import { RiLogoutBoxFill } from "react-icons/ri";
import { FaCartShopping } from "react-icons/fa6";
import { GrUserManager } from "react-icons/gr";
import { AiFillProduct } from "react-icons/ai";
import { useDispatch, useSelector } from 'react-redux';
import { logout } from "../../../../component/redux/apiRequest";


const HeaderAd = ({ children, ...props }) => {
  const user = useSelector((state) => state.auth.login?.currentUser);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const accessToken = user?.accessToken;
  const id = user?._id;
  const handleLogout = () => {
    logout(dispatch, navigate, accessToken,id);
  };
  const navItems = [
    {
      path: ROUTERS.ADMIN.PRODUCTS,
      onClick: () => navigate(ROUTERS.ADMIN.PRODUCTS),
      label: 'Products',
      icon: <AiFillProduct />,
    },
    {
      path: ROUTERS.ADMIN.ORDERS,
      onClick: () => navigate(ROUTERS.ADMIN.ORDERS),
      label: 'Orders',
      icon: <FaCartShopping />,
    },
    {
      path: ROUTERS.ADMIN.USERMANAGER,
      onClick: () => navigate(ROUTERS.ADMIN.USERMANAGER),
      label: 'Usermanager',
      icon: <GrUserManager />,
    },
    {
      onClick: handleLogout,
      label: 'Logout',
      icon: <RiLogoutBoxFill />,
    },
  ];
  return (
    <div className="admin__header container" {...props}>
      <nav className="admin__header__nav">
        {navItems.map(({ path, onClick, label, icon }) => (
          <div className={`admin__header__nav-item 
              ${location.pathname.includes(path)
              ? "admin__header__nav-item--active"
              : ""
            }`} onClick={onClick}
          >
            <span className="admin__header__nav-icon">{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
};

export default memo(HeaderAd);
