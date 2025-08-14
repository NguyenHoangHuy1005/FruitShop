import { memo } from 'react';
import Breadcrumb from '../theme/breadcrumb';
import "./style.scss";
const prod0Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1754924902/uploads/c86hfeg9hodvtaepi0q9.jpg";
<img src={prod0Img} alt="Ảnh sản phẩm" />
import { AiOutlineEye, AiFillFacebook, AiFillInstagram, AiFillLinkedin, AiFillMail, AiOutlineCopy, AiFillTikTok } from "react-icons/ai";
import { formatter } from "../../../utils/fomater";
import { ProductCard, Quantity } from "../../../component";
import { featProducts } from "../../../utils/common";



const productDetail = () => {
    const imgs = [prod0Img

    ];
    return (
        <>
            <Breadcrumb name="Chi tiết sản phẩm" />
            <div className="container">
                <div className="row">
                    <div className="col-lg-6 product__detail__pic">
                        <div className="main">
                            {imgs.map((item, key) =>(
                                <img src={item} alt="product-pic" key={key}/>
                            ))}
                        </div>
                    </div>
                    <div className="col-lg-6 product__detail__text">
                        <h2>Chi tiết sản phẩm</h2>
                        <div className="see-icon"> 
                            <AiOutlineEye/>
                            {`68 (lượt xem)`}
                        </div>
                        <h3>{formatter(100000)}</h3>
                        <Quantity/>
                        <ul>
                            <li>
                                <b>Tình trạng:</b> <span>Còn hàng</span>
                            </li>
                            <li>
                                <b>Số lượng:</b> <span>10</span>
                            </li>
                            <li>
                                <b>Chia sẻ:</b>{""}
                                <span>
                                <AiFillFacebook/>
                                <AiFillTikTok/>
                                <AiOutlineCopy/>
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="product__detail__tab">

                </div>
                <div className="section-title"> 
                    <ul></ul>
                    <h2>Sản phẩm tương tự</h2>
                </div>
                <div className="row">
                    {featProducts.all.products.map((item, key) =>(
                    <div key={key} className="col-lg-3 col-md-4 col-sm-6 col-xs-12"> 
                        <ProductCard img={item.img} name={item.name} price={item.price}/>
                    </div>
                    ))}
                    
                </div>
            </div>
        </>
    );
};

export default memo(productDetail);
