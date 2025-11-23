import { memo } from 'react';
import "./style.scss";
import { useState } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTERS } from "../../../../utils/router";
import { RiLogoutBoxFill } from "react-icons/ri";
import { FaCartShopping, FaFileInvoice } from "react-icons/fa6";
import { MdDashboard, MdDiscount } from "react-icons/md";
import { GrUserManager } from "react-icons/gr";
import { AiFillProduct } from "react-icons/ai";
import { HiDocumentText } from "react-icons/hi";
import { useDispatch, useSelector } from 'react-redux';
import { logout, ensureAccessToken, API } from "../../../../component/redux/apiRequest";
import { Boxes } from "lucide-react";
import { useEffect } from "react";

const HeaderAd = ({ children, ...props }) => {
  const user = useSelector((state) => state.auth.login?.currentUser);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const accessToken = user?.accessToken;
  const id = user?._id;
  const [open, setOpen] = useState(false);
  const toggleMenu = () => setOpen(!open);
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const t = await ensureAccessToken(null, dispatch, navigate, true); // 👈 admin
      if (!cancelled && t) {
        API.defaults.headers.common.Authorization = `Bearer ${t}`;
      }
    };
    hydrate();

    const onFocus = () => hydrate();
    const onVisible = () => { if (!document.hidden) hydrate(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [dispatch, navigate]);



  const handleLogout = () => {
    logout(dispatch, navigate, accessToken, id);
  };

  const navItems = [
    {
      key: 'dashboard',
      path: ROUTERS.ADMIN.DASHBOARD,
      onClick: () => navigate(ROUTERS.ADMIN.DASHBOARD),
      label: 'Tổng quan',
      icon: <MdDashboard size={20} />,
    },
    {
      key: 'products',
      path: ROUTERS.ADMIN.PRODUCTS,
      onClick: () => navigate(ROUTERS.ADMIN.PRODUCTS),
      label: 'Sản phẩm',
      icon: <AiFillProduct />,
    },
    {
      key: 'coupon',
      path: ROUTERS.ADMIN.COUPON,
      onClick: () => navigate(ROUTERS.ADMIN.COUPON),
      label: 'Mã giảm',
      icon: <MdDiscount />,
    },
    // thêm stock
    {
      key: 'stock',
      path: ROUTERS.ADMIN.STOCK,
      onClick: () => navigate(ROUTERS.ADMIN.STOCK),
      label: 'Kho hàng',
      icon: <Boxes size={18} />,
    },
    {
      key: 'invoices',
      path: ROUTERS.ADMIN.INVOICES,
      onClick: () => navigate(ROUTERS.ADMIN.INVOICES),
      label: 'Phiếu nhập',
      icon: <FaFileInvoice size={20} />,
    },
    {
      key: 'orders',
      path: ROUTERS.ADMIN.ORDERS,
      onClick: () => navigate(ROUTERS.ADMIN.ORDERS),
      label: 'Đơn hàng',
      icon: <FaCartShopping />,
    },
    {
      key: 'users',
      path: ROUTERS.ADMIN.USERMANAGER,
      onClick: () => navigate(ROUTERS.ADMIN.USERMANAGER),
      label: 'Người dùng',
      icon: <GrUserManager />,
    },
    {
      key: 'content',
      path: ROUTERS.ADMIN.CONTENT,
      onClick: () => navigate(ROUTERS.ADMIN.CONTENT),
      label: 'Nội dung',
      icon: <HiDocumentText size={20} />,
    },
    // {
    //   key: 'logout',
    //   onClick: handleLogout,
    //   label: 'Logout',
    //   icon: <RiLogoutBoxFill />,
    // },
  ];

  return (
    <header className="admin-header" {...props}>
      <div className="admin-header__container">
        <div className="admin-header__logo">
          <div className="admin-header__logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="admin-header__logo-text">Bảng quản trị</span>
        </div>

        <nav className="admin-header__nav">
          {navItems.map(({ key, path, onClick, label, icon }) => {
            const isActive = path ? location.pathname === path : false;
            return (
              <button
                key={key || path || label}
                className={`admin-header__nav-item ${isActive ? "admin-header__nav-item--active" : ""}`}
                onClick={onClick}
              >
                <span className="admin-header__nav-icon">{icon}</span>
                <span className="admin-header__nav-label">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-header__user" onClick={toggleMenu}>
          <div className="admin-header__user-info">
            <div className="admin-header__user-avatar">
              {user?.username?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="admin-header__user-details">
              <div className="admin-header__user-name">{user?.username || "Admin"}</div>
              <div className="admin-header__user-role">Quản trị viên</div>
            </div>
          </div>

          {open && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={handleLogout}>
                <RiLogoutBoxFill style={{ marginRight: "10px" }} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default memo(HeaderAd);
