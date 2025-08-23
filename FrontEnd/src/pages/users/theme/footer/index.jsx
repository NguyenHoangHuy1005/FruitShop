import { memo } from 'react';
import "./style.scss";
import { Link } from 'react-router-dom';
import { AiFillFacebook, AiFillInstagram, AiFillLinkedin, AiFillMail, AiFillTikTok } from "react-icons/ai";
const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container">
        <div className="row">
          <div className="col-lg-3 col-md-3 col-sm-12 col-12">
            <div className="footer__about">
              <div className="footer__about__logo">
                <img
                  src="https://res.cloudinary.com/dnk3xed3n/image/upload/v1755947809/uploads/ddqokb7u88gdjui8cxad.png"
                  alt="Fruit_Shop_Logo"
                  className="logo"
                />
              </div>

              <ul>
                <h3>Thông tin liên hệ</h3>
                <li>Địa chỉ: 105 Nguyễn Hoàng Huy</li>
                <li>Phone: 0374-675-671</li>
                <li>Email: Hoanghuy100503@gmail.com</li>
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
                  <div> <AiFillFacebook /></div>
                  <div><AiFillInstagram /></div>
                  <div> <AiFillLinkedin /> </div>
                  <div><AiFillTikTok /> </div>

                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
      {/* === Thanh bản quyền ở đáy footer === */}
      <div className="footer__copyright">
        <div className="container">
          <p>© {year} Thế Sơn Shop. All rights reserved.</p>
        </div>
      </div>

    </footer>
  );
};
export default memo(Footer);
