import { memo } from 'react';
import "./style.scss";
import { Link } from 'react-router-dom';
import { ROUTERS } from "../../../../utils/router";
import {
  AiFillFacebook,
  AiFillInstagram,
  AiFillLinkedin,
  AiFillMail,
  AiFillTikTok,
} from "react-icons/ai";

const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container">
        <div className="row">
          <div className="col-lg-3 col-md-3 col-sm-12 col-12">
            <div className="footer__about">
              <div className="footer__about__logo">
                <Link to={ROUTERS.USER.HOME} className="logo-link">
                  <img
                    src="https://res.cloudinary.com/dnk3xed3n/image/upload/v1755947809/uploads/ddqokb7u88gdjui8cxad.png"
                    alt="Logo"
                    className="logo"
                  />
                </Link>
              </div>
              <ul className="footer__contact">
                <h3>Thông tin liên hệ</h3>
                <li>Địa chỉ: 789 Fruit Shop</li>
                <li>Phone: 0989-456-789</li>
                <li>Email: FruitShop@gmail.com</li>
              </ul>
            </div>
          </div>
          <div className="col-lg-3 col-md-3 col-sm-6 col-12">
            <div className="footer__widget">
              <h6>Chính sách và Dịch vụ</h6>
              <ul>
                <li>
                  <Link to="">Chính sách đổi trả</Link>
                </li>
                <li>
                  <Link to="">Chính sách giao hàng</Link>
                </li>
                <li>
                  <Link to="">Chính sách khách hàng thân thiết</Link>
                </li>
                <li>
                  <Link to="">Hướng dẫn sử dụng E-voucher</Link>
                </li>
                <li>
                  <Link to="">Chính sách bảo mật thông tin khách hàng</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="col-lg-3 col-md-3 col-sm-6 col-12">
            <div className="footer__widget__bonus">
              <h6>Quà Tặng</h6>
              <ul>
                <li>
                  <Link to="">Tết Nguyên Đán</Link>
                </li>
                <li>
                  <Link to="">Quốc tế Phụ nữ</Link>
                </li>
                <li>
                  <Link to="">Lễ tình nhân</Link>
                </li>
                <li>
                  <Link to="">Trung thu</Link>
                </li>
                <li>
                  <Link to="">Nhà giáo Việt Nam</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="col-lg-3 col-md-12 col-sm-12 col-12">
            <div className="footer__widget">
              <h6>Khuyến mãi và ưu đãi</h6>
              <p>Đăng ký thông tin</p>
              <form action="#">
                <div className="input-group">
                  <input type="text" placeholder="Nhập email" />
                  <button type="submit" className="button-submit">Đăng ký</button>
                </div>
                <div className="footer__widget__social">
                  <div>
                    <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                      <AiFillFacebook />
                    </a>
                  </div>
                  <div>
                    <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                      <AiFillInstagram />
                    </a>
                  </div>
                  <div>
                    <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                      <AiFillLinkedin />
                    </a>
                  </div>
                  <div>
                    <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">
                      <AiFillTikTok />
                    </a>
                  </div>

                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
      {/* === Thanh bản quyền ở đáy footer === */}
      <div className="footer__copyright">

        <p>© {year} Thế Sơn - Hoàng Huy Fruit Shop. All rights reserved.</p>

      </div>

    </footer>
  );
};
export default memo(Footer);
