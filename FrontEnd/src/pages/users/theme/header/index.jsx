import { memo, use, useEffect } from 'react';
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import "./style.scss";
import { AiFillFacebook, AiFillInstagram, AiFillLinkedin, AiFillMail, AiFillTikTok, AiOutlineAlipayCircle, AiFillCaretUp, AiFillCaretDown } from "react-icons/ai";
import { BiSolidUserCircle } from "react-icons/bi";
import { FaCartShopping } from "react-icons/fa6";
import { FaListUl, FaPhone } from "react-icons/fa";
import { featProducts } from "../../../../utils/common";
// import { ROUTERS } from "utils/router";
import { ROUTERS } from "../../../../utils/router";
import { formatter } from "../../../../utils/fomater";
import { useSelector } from 'react-redux';

export const categories = [
  "Rau củ",
  "Trái cây",
  "Hải sản",
  "Thịt tươi",
  "Thực phẩm khô",
];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  //const [isShowCategories, setShowCategories] = useState(true);
  const [isShowHumberger, setShowHumberger] = useState(false);
  const [isHome, setisHome] = useState(location.pathname.length <= 1);
  const [isShowCategories, setShowCategories] = useState(isHome);

  const [menus, setMenus] = useState([
    {
      name: "Trang chủ",
      path: ROUTERS.USER.HOME,
    },
    // {
    //   name: "Cửa hàng",
    //   path: ROUTERS.USER.PRODUCTS,
    // },
    {
      name: "Sản phẩm",
      path: ROUTERS.USER.PRODUCTS,
      isShowSubmenu: false,
      child: [
        {
          name: "Rau củ",
          path: "",
        },
        {
          name: "Trái cây",
          path: "",
        },
        {
          name: "Hải sản",
          path: "",
        },
        {
          name: "Thịt tươi",
          path: "",
        },
        {
          name: "Thực phẩm khô",
          path: "",
        },
      ]
    },
    {
      name: "Bài viết",
      path: "",
    },
    {
      name: "Liên hệ",
      path: "",
    },
  ]);

  useEffect(() => {
    const isHome = location.pathname.length <= 1;
    setisHome(isHome);
    setShowCategories(isHome);
  }, [location]);

  const user = useSelector((state) => state.auth.login.currentUser);

  return (
    <>
      <div className={`humberger__menu__overlay ${isShowHumberger ? "active" : ""}`}
        onClick={() => setShowHumberger(false)}
      />
      <div className={`humberger__menu__wrapper ${isShowHumberger ? "show" : ""}`}>
        <div className="header__logo">
          <h1>FRUITSHOP</h1>
        </div>
        <div className="humberger__menu__cart">
          <ul>
            <li>
              <Link to={""}>
                <FaCartShopping /> <span>4</span>
              </Link>
            </li>
          </ul>
          <div className="header__cart__price">
            Giỏ hàng: <span>{formatter(123456)}</span>
          </div>
        </div>

        <div className="humberger__menu_widget">
          <div className="header__top__right__auth">
            <Link to={""}>
              <BiSolidUserCircle /> <span>Đăng nhập</span>
            </Link>

          </div>
        </div>

        <div className="humberger__menu__nav">
          <ul>
            {menus.map((menu, menuKey) => (
              <li key={menuKey} to={menu.path}>
                <Link to={menu.path}
                  onClick={() => {
                    const newMenus = [...menus];
                    newMenus[menuKey].isShowSubmenu = !menu.isShowSubmenu;
                    setMenus(newMenus)
                  }}>
                  {menu.name}
                  {menu.child && (
                    menu.isShowSubmenu ? (
                      <AiFillCaretDown />
                    )
                      : <AiFillCaretUp />
                  )}
                </Link>
                {menu.child && (
                  <ul className={`header__menu__dropdown ${menu.isShowSubmenu ? "show__submenu" : ""}`}>
                    {menu.child.map((childItem, childKey) => (
                      <li key={childKey}>
                        <Link to={childItem.name}>{childItem.name}</Link>
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
              <AiFillMail /> Hoanghuy100503@gmail.com
            </li>
            <li>Miễn phí giao hàng cho đơn từ {formatter(199000)}</li>
          </ul>
        </div>
      </div >

      <div className="header__top">
        <div className="container">
          <div className="row">
            <div className="col-6 header__top__left">
              <ul>
                <li>
                  <AiFillMail />
                  Hoanghuy100503@gmail.com
                </li>
                <li className="top_header_freeship">
                  Miễn phí vẫn chuyển cho đơn từ {formatter(199000)}
                </li>
              </ul>
            </div>
            <div className="col-6 header__top__right">
              <ul>
                <li>
                  <Link to={""}>
                    <AiFillFacebook />
                  </Link>
                </li>
                <li>
                  <Link to={""}>
                    <AiFillInstagram />
                  </Link>
                </li>
                <li>
                  <Link to={""}>
                    <AiFillLinkedin />
                  </Link>
                </li>
                <li>
                  <Link to={""}>
                    <AiFillTikTok />
                  </Link>
                </li>

                <li onClick={() => navigate(ROUTERS.ADMIN.LOGIN)}>
                  <Link to={""}>
                    <BiSolidUserCircle />
                  </Link>
                  {user ? (
                    <span>{user.username}</span>
                  ) : (
                    <span>Đăng nhập</span>
                  )}
                </li>

              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row">
          <div className="col-lg-3">
            <div className="header__logo">
              <h1>FRUIT SHOP</h1>

            </div>
          </div>
          <div className="col-lg-6">
            <nav className="header__menu">
              <ul>
                {
                  menus?.map((menu, menuKey) => (
                    <li key={menuKey} className={menuKey === 0 ? "active" : ""}>
                      <Link to={menu?.path}>{menu?.name}</Link>
                      {
                        menu.child && (
                          <ul className="header__menu__dropdown">
                            {
                              menu.child.map((childItem, childKey) => (
                                <li key={`${menuKey}-${childKey}`}>
                                  <Link to={childItem.path}>{childItem.name}</Link>
                                </li>
                              ))
                            }
                            <li>
                              <Link></Link>
                            </li>
                          </ul>
                        )
                      }
                    </li>
                  ))
                }
              </ul>
            </nav>
          </div>
          <div className="col-lg-3">
            <div className="header__cart">
              <div className="header__cart__price">
                <span>
                  5.200,000VND
                </span>
              </div>
              <ul>
                <li>
                  <Link to={ROUTERS.USER.SHOPPINGCART}>
                    <FaCartShopping /> <span>5</span>
                  </Link>
                </li>
              </ul>
            </div>

            <div className="humberger__open">
              <FaListUl
                onClick={() => setShowHumberger(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row categories">
          <div className="col-lg-3 col-md-12 col-sm-12 col-xs-12 l__categories">
            <div className="categories__all" onClick={() => setShowCategories(!isShowCategories)}>
              <FaListUl />
              Danh mục sản phẩm
            </div>

            <ul className={isShowCategories ? "" : "hidden"}>
              {categories.map((category, key) => (
                <li key={key}>
                  <Link to={ROUTERS.USER.PRODUCTS}>{category}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-lg-9 col-md-12 col-sm-12 col-xs-12 r__categories">
            <div className="r__search">
              <div className="r__search_form">
                <form>
                  <input type="text" placeholder="Bạn đang tìm gì?" />
                  <button type="button" className="button-submit">Tìm kiếm</button>
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
                    Rau củ quả<br />
                    100% sạch
                  </h2>
                  <p>Giao hàng miễn phí tận nơi</p>
                  <Link to="#" className="primary-btn">Mua ngay</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </>

  )

};

export default memo(Header);
