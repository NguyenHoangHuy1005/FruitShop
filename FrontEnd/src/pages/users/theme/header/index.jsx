import { memo } from 'react';
import React, { useState } from "react";
import { Link } from 'react-router-dom';
import "./style.scss";
import { AiFillFacebook, AiFillInstagram, AiFillLinkedin, AiFillMail, AiFillTikTok } from "react-icons/ai";
import { BiSolidUserCircle } from "react-icons/bi";
import { FaCartShopping } from "react-icons/fa6";
import { FaListUl, FaPhone } from "react-icons/fa";
// import { ROUTERS } from "utils/router";
import { ROUTERS } from "../../../../utils/router";

//import { formatter } from "@/utils/formater";
const Header = () => {
  const [isShowCatagories, setShowCatagories] = useState(true);
  const [menus, setMenus] = useState([
    {
      name: "Trang chủ",
      path: ROUTERS.USER.HOME,
    },
    {
      name: "Cửa hàng",
      path: ROUTERS.USER.PRODUCTS,
    },
    {
      name: "Sản phẩm",
      path: "",
      isShowSubmenu: false,
      child: [
        {
          name: "thịt",
          path: "",
        },
        {
          name: "rau củ quả",
          path: "",
        },
        {
          name: "thức ăn nhanh",
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
  ])

  return (
    <>
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
                  Miễn phí vẫn chuyển cho đơn từ 500.000VND
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

                <li>
                  <Link to={""}>
                    <BiSolidUserCircle />
                  </Link>
                  <span>Đăng nhập</span>
                </li>

              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row">
          <div className="col-xl-3">
            <div className="header__logo">
              <h1>FRUIT SHOP</h1>

            </div>
          </div>
          <div className="col-xl-6">
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
          <div className="col-xl-3">
            <div className="header__cart">
              <div className="header__cart__price">
                <span>
                  5.200,000VND
                </span>
              </div>
              <ul>
                <li>
                  <Link to="#">
                    <FaCartShopping /> <span>5</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row catagories">
          <div className="col-lg-3 l__catagories">
            <div className="catagories__all" onClick={() => setShowCatagories(!isShowCatagories)}>
              <FaListUl />
              Danh sách sản phẩm
            </div>
            {isShowCatagories && (
              <ul className={isShowCatagories ? "" : "hidden"}>
                <li>
                  <Link to="#">Rau củ</Link>
                </li>
                <li>
                  <Link to="#">Trái cây</Link>
                </li>
                <li>
                  <Link to="#">Hoa tươi</Link>
                </li>
                <li>
                  <Link to="#">Thịt tươi</Link>
                </li>
                <li>
                  <Link to="#">Trái cây sấy</Link>
                </li>
              </ul>
            )
            }

          </div>
          <div className="col-lg-9 r__catagories">
            <div className="r__search">
              <div className="r__search_form">
                <form>
                  <input type="text" name="" value="" placeholder="Bạn đang tìm gì?" />
                  <button type="submit">Tìm kiếm</button>
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
          </div>
        </div>
      </div>

    </>

  )

};

export default memo(Header);
