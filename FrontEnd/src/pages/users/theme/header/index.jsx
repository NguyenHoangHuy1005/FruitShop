import React, { memo, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout, ensureCart, API, ensureAccessToken} from "../../../../component/redux/apiRequest";
import "./style.scss";
import "./header.scss";
import {
  AiFillFacebook,
  AiFillInstagram,
  AiFillLinkedin,
  AiFillMail,
  AiFillTikTok,
  AiFillCaretUp,
  AiFillCaretDown,
} from "react-icons/ai";
import { BiSolidUserCircle } from "react-icons/bi";
import { FaCartShopping } from "react-icons/fa6";
import { FaListUl, FaPhone } from "react-icons/fa";
import { ROUTERS } from "../../../../utils/router";
import { formatter } from "../../../../utils/fomater";
import { useDispatch, useSelector } from "react-redux";

export const categories = ["Trái cây", "Rau củ", "Giỏ quà tặng", "Hoa trái cây", "Thực phẩm khô"];

// ===== Helper avatar =====
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";
const baseUrl = API_BASE.replace("/api", "");

const getAvatarUrl = (user) => {
  if (!user || !user.avatar || user.avatar.trim() === "") {
    // Fallback Dicebear avatar
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      user?.fullname || user?.username || "User"
    )}&background=%23e2e8f0`;
  }

  const avatar = user.avatar.trim();

  // Nếu đã là URL tuyệt đối (http/https) thì trả trực tiếp
  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }

  // Nếu là URL protocol-relative (ví dụ: //cdn.domain.com/abc.png)
  if (avatar.startsWith("//")) {
    return window.location.protocol + avatar;
  }

  // Còn lại coi như path tương đối → nối với baseUrl
  return `${baseUrl}${avatar.startsWith("/") ? "" : "/"}${avatar}`;
};


/* ===================== User dropdown ===================== */
const UserMenu = ({ onLoginClick }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.login?.currentUser);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("touchstart", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("touchstart", onClickOutside);
    };
  }, []);

  // Đóng menu khi đổi route
  const location = useLocation();
  useEffect(() => setOpen(false), [location]);

  if (!user) {
    // ===== Chưa đăng nhập =====
    return (
      <li>
        <button type="button" className="login-inline" onClick={onLoginClick}>
          <BiSolidUserCircle />
          <span>Đăng nhập</span>
        </button>
      </li>
    );
  }

  const displayName = user.fullname || user.username || "Tài khoản";
  const avatar = getAvatarUrl(user);

  const handleLogout = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const accessToken = user?.accessToken;
    const id = user?._id;
    await logout(dispatch, navigate, accessToken, id);
  };

  return (
    <li className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <img className="user-avatar" src={avatar} alt={displayName} />
        <span className="user-name">{displayName}</span>
      </button>

      <ul className={`user-dropdown ${open ? "open" : ""}`} role="menu">
        <li>
          <Link to={ROUTERS.USER.PROFILE} role="menuitem">
            Tài khoản của tôi
          </Link>
        </li>
        <li>
          <Link to={ROUTERS.USER.ORDERS} role="menuitem">
            Đơn mua
          </Link>
        </li>
        <li>
          <button
            type="button"
            className="logout-btn"
            role="menuitem"
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </li>
      </ul>
    </li>
  );
};

/* =================== End User dropdown =================== */

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const cart = useSelector((state) => state.cart?.data);
  const user = useSelector((state) => state.auth?.login?.currentUser);
  useEffect(() => {
    ensureCart(dispatch);
  }, [dispatch]);
  
   // Bootstrap: refresh accessToken xong mới sync giỏ
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (cancelled) return;
      const t = await ensureAccessToken(null, dispatch, navigate, false);
      if (cancelled) return;
      if (t) API.defaults.headers.common.Authorization = `Bearer ${t}`;
      await ensureCart(dispatch);
    };

    hydrate();

    // Khi user quay lại tab hoặc visibility change → refresh token + sync giỏ
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



  const count = cart?.items?.length || 0;
  const subtotal = cart?.summary?.subtotal || 0;

  const [isShowHumberger, setShowHumberger] = useState(false);
  const [isHome, setIsHome] = useState(location.pathname.length <= 1);
  const [isShowCategories, setShowCategories] = useState(isHome);

  const [menus, setMenus] = useState([
    { name: "Trang chủ", path: ROUTERS.USER.HOME },
    {
      name: "Sản phẩm",
      path: ROUTERS.USER.PRODUCTS,
      isShowSubmenu: false,
      child: [
        { name: "Trái Cây", slug: "Trái cây" },
        { name: "Rau củ", slug: "Rau củ" },
        { name: "Giỏ quà tặng", slug: "Giỏ quà tặng" },
        { name: "Hoa trái cây", slug: "Hoa trái cây" },
        { name: "Thực phẩm khô", slug: "Thực phẩm khô" },
      ],
    },
    { name: "Bài viết", path: "" },
    { name: "Liên hệ", path: ROUTERS.USER.CONTACT },
  ]);

  useEffect(() => {
    const _isHome = location.pathname.length <= 1;
    setIsHome(_isHome);
    setShowCategories(_isHome);
  }, [location]);


  // thanh tìm kiếm
  // Lấy sản phẩm từ Redux
  const products = useSelector(
    (state) => state.product.products?.allProducts || []
  );
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = (e) => {
    const value = e.target.value;
    setKeyword(value);

    if (value.length > 0) {
      const filtered = products.filter((item) =>
        item.name
          .toLowerCase()
          .split(" ") // tách tên sản phẩm thành các từ
          .some((word) => word.startsWith(value.toLowerCase())) // kiểm tra từ bắt đầu
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  };


  return (
    <>
      {/* ===== Overlay & mobile drawer ===== */}
      <div
        className={`humberger__menu__overlay ${isShowHumberger ? "active" : ""}`}
        onClick={() => setShowHumberger(false)}
      />
      <div
        className={`humberger__menu__wrapper ${isShowHumberger ? "show" : ""}`}
      >
        <div className="header__logo">
          <Link to={ROUTERS.USER.HOME} className="logo-link">
            <img
              src="https://res.cloudinary.com/dnk3xed3n/image/upload/v1755947809/uploads/ddqokb7u88gdjui8cxad.png"
              alt="Logo"
              className="logo"
            />
          </Link>
        </div>

        <div className="humberger__menu__cart">
          <ul>
            <li>
              <Link to={ROUTERS.USER.SHOPPINGCART}>
                <FaCartShopping /> <span>{count}</span>
              </Link>
            </li>
          </ul>
          <div className="header__cart__price">
            Giỏ hàng: <span>{formatter(subtotal)}</span>
          </div>
        </div>

        {/* Mobile user area */}
        <div className="humberger__menu_widget">
          <div className="header__top__right__auth">
            {!user ? (
              <button
                className="login-inline"
                onClick={() => navigate(ROUTERS.ADMIN.LOGIN)}
              >
                <BiSolidUserCircle /> <span>Đăng nhập</span>
              </button>
            ) : (
              <div className="mobile-user-block">
                <img
                  className="user-avatar"
                  src={getAvatarUrl(user)}
                  alt={user.fullname || user.username}
                />
                <div className="mobile-user-links">
                  <Link to={ROUTERS.USER.ACCOUNT}>Tài khoản của tôi</Link>
                  <Link to={ROUTERS.USER.ORDERS}>Đơn mua</Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="humberger__menu__nav">
          <ul>
            {menus.map((menu, menuKey) => (
              <li key={menuKey} to={menu.path}>
                <Link
                  to={menu.path}
                  onClick={() => {
                    const newMenus = [...menus];
                    newMenus[menuKey].isShowSubmenu = !menu.isShowSubmenu;
                    setMenus(newMenus);
                  }}
                >
                  {menu.name}
                  {menu.child &&
                    (menu.isShowSubmenu ? <AiFillCaretDown /> : <AiFillCaretUp />)}
                </Link>

                {menu.child && (
                  <ul
                    className={`header__menu__dropdown ${menu.isShowSubmenu ? "show__submenu" : ""
                      }`}
                  >
                    {menu.child.map((childItem, childKey) => (
                      <li key={childKey}>
                        <Link to={`${ROUTERS.USER.PRODUCTS}?category=${childItem.slug}`}>
                          {childItem.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="header__top__right__social">
          <ul>
            <Link to={""}>
              <AiFillFacebook />
            </Link>
            <Link to={""}>
              <AiFillInstagram />
            </Link>
            <Link to={""}>
              <AiFillLinkedin />
            </Link>
            <Link to={""}>
              <AiFillTikTok />
            </Link>
          </ul>
        </div>

        <div className="humberger__menu__contact">
          <ul>
            <li>
              <AiFillMail /> FruitShop@gmail.com
            </li>
            <li>Miễn phí giao hàng cho đơn từ {formatter(199000)}</li>
          </ul>
        </div>
      </div>

      {/* ===== Top bar ===== */}
      <div className="header__top">
        <div className="container">
          <div className="row">
            <div className="col-6 header__top__left">
              <ul>
                <li>
                  <AiFillMail /> FruitShop@gmail.com
                </li>

                <li className="top_header_freeship">
                  Miễn phí vẫn chuyển cho đơn từ  {formatter(199000)}
                </li>
              </ul>
            </div>
            <div className="col-6 header__top__right">
              <ul>
                <li>
                  <a
                    href="https://www.facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AiFillFacebook />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AiFillInstagram />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AiFillLinkedin />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.tiktok.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AiFillTikTok />
                  </a>
                </li>
                {/* === Đây là phần user === */}
                <UserMenu onLoginClick={() => navigate(ROUTERS.ADMIN.LOGIN)} />
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Main bar ===== */}
      <div className="container" >
        <div className="row">
          <div className="col-lg-3">
            <div className="header__logo">
              <Link to={ROUTERS.USER.HOME}>
                <img
                  src="https://res.cloudinary.com/dnk3xed3n/image/upload/v1755947809/uploads/ddqokb7u88gdjui8cxad.png"
                  className="logo"
                  alt="Logo"
                />
              </Link>
            </div>
          </div>

          <div className="col-lg-6">
            <nav className="header__menu">
              <ul>
                {menus.map((menu, menuKey) => (
                  <li key={menuKey} className={menuKey === 0 ? "active" : ""}>
                    <Link to={menu.path}>{menu.name}</Link>
                    {menu.child && (
                      <ul className="header__menu__dropdown">
                        {menu.child.map((childItem, childKey) => (
                          <li key={`${menuKey}-${childKey}`}>
                            <Link to={`${ROUTERS.USER.PRODUCTS}?category=${childItem.slug}`}>
                              {childItem.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>

          </div>

          <div className="col-lg-3">
            <div className="header__cart">
              <div className="header__cart__price">
                Giỏ hàng: <span>{formatter(subtotal)}</span>
              </div>
              <ul>
                <li>
                  <Link to={ROUTERS.USER.SHOPPINGCART}>
                    <FaCartShopping /> <span>{count}</span>
                  </Link>
                </li>
              </ul>
            </div>

            <div className="humberger__open">
              <FaListUl onClick={() => setShowHumberger(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Categories + Search + Hero ===== */}
      <div className="container" >
        <div className="row categories">
          <div className="col-lg-3 col-md-12 col-sm-12 col-xs-12 l__categories">
            <div
              className="categories__all"
              onClick={() => setShowCategories(!isShowCategories)}
            >
              <FaListUl />
              Danh mục sản phẩm
            </div>

            <ul className={isShowCategories ? "" : "hidden"}>
              {categories.map((cat, idx) => (
                <li key={idx}>
                  <Link to={`${ROUTERS.USER.PRODUCTS}?category=${cat}`}>
                    {cat}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-lg-9 col-md-12 col-sm-12 col-xs-12 r__categories">
            <div className="r__search">
              <div className="r__search_form">
                <form>
                  <input
                    type="text"
                    placeholder="Bạn đang tìm gì?"
                    value={keyword}
                    onChange={handleSearch}
                  />
                  <button type="button" className="button-submit">
                    Tìm kiếm
                  </button>

                  {results.length > 0 && (
                    <ul className="search-results">
                      {results.map((item) => {
                        const discountPercent = item.discountPercent || 0;
                        const finalPrice =
                          discountPercent > 0
                            ? Math.round(item.price - (item.price * discountPercent) / 100)
                            : item.price;

                        return (
                          <li key={item._id}>
                            <Link
                              to={`/product/detail/${item._id}`}
                              onClick={() => {
                                setResults([]);   // ẩn thanh gợi ý
                                setKeyword("");   // xóa luôn từ khóa (nếu muốn)
                              }}
                            >
                              <img src={item.image} alt={item.name} />
                              <div className="info">
                                <span className="name">{item.name}</span>
                                {discountPercent > 0 ? (
                                  <div className="price-wrap">
                                    <del className="price-old">{formatter(item.price)}</del>
                                    <div className="price-new">{formatter(finalPrice)}</div>
                                  </div>
                                ) : (
                                  <h5>{formatter(item.price)}</h5>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>

                  )}
                </form>

              </div>


              <div className="r__search_phone">
                <div className="r__search_phone_icon">
                  <FaPhone />
                </div>
                <div className="r__search_phone_text">
                  <p>0374.675.671</p>
                  <span>Hỗ trợ 24/7</span>
                </div>
              </div>
            </div>

            {isHome && (
              <div className="r__item">
                <div className="r__text">
                  <span>Trái cây tươi</span>
                  <h2>
                    Rau củ quả
                    <br />
                    100% sạch
                  </h2>
                  <p>Giao hàng miễn phí tận nơi</p>
                  <Link to="#" className="primary-btn">
                    Mua ngay
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(Header);
