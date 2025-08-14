import { memo } from 'react';
import Breadcrumb from '../theme/breadcrumb';
import "./style.scss";
import { categories } from '../theme/header';
import { Link } from 'react-router-dom';
import { ROUTERS } from "../../../utils/router";
import prod0Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod0.jpg";
import prod1Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod1.jpg";
import prod2Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod2.jpg";
import prod3Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod3.jpg";
import prod4Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod4.jpg";
import prod5Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod5.jpg";
import prod6Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod6.jpg";
import prod7Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod7.jpg";
import prod8Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod8.jpg";
import prod9Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod9.jpg";
import prod10Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod10.jpg";
import prod11Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod11.jpg";
import prod12Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod12.jpg";
import prod13Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod13.jpg";
import prod14Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod14.jpg";
import prod15Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod15.jpg";
import prod16Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod16.jpg";
import prod17Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod17.jpg";
import prod18Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod18.jpg";
import prod19Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod19.jpg";
import prod20Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod20.jpg";
import prod21Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod21.jpg";
import prod22Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod22.jpg";
import prod23Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod23.jpg";
import prod24Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod24.jpg";
import prod25Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod25.jpg";
import prod26Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod26.jpg";
import prod27Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod27.jpg";
import prod28Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod28.jpg";
import prod29Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod29.jpg";
import prod30Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod30.jpg";
import prod31Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod31.jpg";
import prod32Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod32.jpg";
import prod33Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod33.jpg";
import prod34Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod34.jpg";
import prod35Img from "E:/FruitShop/FrontEnd/src/assets/user/images/product/prod35.jpg";
import { ProductCard } from "../../../component";

const ProductsPage = () => {
    const sorts = [
        "Giá thấp đến cao",
        "Giá cao đến thấp",
        "Bán chạy nhất",
        "Đang giảm giá"
    ];
    const products = [
        {
            img: prod0Img,
            name: "Dâu tây",
            price: 199000,
        },
        {
            img: prod1Img,
            name: "Đậu Hà Lan",
            price: 79000,
        },
        {
            img: prod2Img,
            name: "Thịt bò Mỹ",
            price: 799000,
        },
        {
            img: prod3Img,
            name: "Việt quất",
            price: 259000,
        },
        {
            img: prod4Img,
            name: "Cam sành",
            price: 149000,
        },
        {
            img: prod5Img,
            name: "Hạt Macca",
            price: 129000,
        },
        {
            img: prod6Img,
            name: "Thịt bò nạc",
            price: 289000,
        },
        {
            img: prod7Img,
            name: "Bơ sáp",
            price: 59000,
        },
        {
            img: prod8Img,
            name: "Cherry đỏ Mỹ",
            price: 199000,
        },
        {
            img: prod9Img,
            name: "Súp lơ",
            price: 199000,
        },
        {
            img: prod10Img,
            name: "Lê Hàn Quốc",
            price: 199000,
        },
        {
            img: prod11Img,
            name: "Cua biển Cà Mau",
            price: 459000,
        },
        {
            img: prod12Img,
            name: "Cà rốt",
            price: 39000,
        },
        {
            img: prod13Img,
            name: "Ớt chuông Đà Lạt",
            price: 139000,
        },
        {
            img: prod14Img,
            name: "Sườn heo",
            price: 189500,
        },
        {
            img: prod15Img,
            name: "Măng tây",
            price: 54900,
        },
        {
            img: prod16Img,
            name: "Tôm hùm",
            price: 1090000,
        },
        {
            img: prod17Img,
            name: "Cà tím",
            price: 15500,
        },
        {
            img: prod18Img,
            name: "Đùi gà",
            price: 79900,
        },
        {
            img: prod19Img,
            name: "Rau xà lách",
            price: 7500,
        },
        {
            img: prod20Img,
            name: "Hành tây",
            price: 29500,
        },
        {
            img: prod21Img,
            name: "Khoai lang mật",
            price: 35900,
        },
        {
            img: prod22Img,
            name: "Tôm sú",
            price: 459500,
        },
        {
            img: prod23Img,
            name: "Yến mạch",
            price: 129500,
        },
        {
            img: prod24Img,
            name: "Thịt heo nạc",
            price: 209500,
        },
        {
            img: prod25Img,
            name: "Cá hồi phi lê",
            price: 755900,
        },
        {
            img: prod26Img,
            name: "Hàu sữa tươi",
            price: 99500,
        },
        {
            img: prod27Img,
            name: "Cà chua",
            price: 29500,
        },
        {
            img: prod28Img,
            name: "Ức gà",
            price: 55900,
        },
        {
            img: prod29Img,
            name: "Hạt óc chó",
            price: 159400,
        },
        {
            img: prod30Img,
            name: "Nho mẫu đơn",
            price: 1105000,
        },
        {
            img: prod31Img,
            name: "Hạt điều",
            price: 69500,
        },
        {
            img: prod32Img,
            name: "Dâu tằm",
            price: 195000,
        },
        {
            img: prod33Img,
            name: "Bánh quy socola",
            price: 129500,
        },
        {
            img: prod34Img,
            name: "Nho sấy khô",
            price: 245900,
        },
        {
            img: prod35Img,
            name: "Kiwi xanh",
            price: 209500,
        },
    ];
    return (
        <>
            <Breadcrumb name="Danh sách sản phẩm" />
            <div className="container">
                <div className="row">
                    <div className="col-lg-3">
                        <div className="sidebar">
                            <div className="sidebar_item">
                                <h2>Tìm kiếm</h2>
                                <input type="text" placeholder="Bạn đang tìm gì?" />
                            </div>
                            <div className="sidebar_item">
                                <h2>Mức giá</h2>
                                <div className="price-range-wrap">
                                    <div>
                                        <p>Từ:</p>
                                        <input type="number" min={0} />
                                    </div>
                                    <div>
                                        <p>Đến:</p>
                                        <input type="number" min={0} />
                                    </div>
                                </div>
                            </div>
                            <div className="sidebar_item">
                                <h2>Sắp xếp</h2>
                                <div className="tags">
                                    {sorts.map((item, key) => (
                                        <div className={`tag ${key == 0 ? "active" : ""}`} key={key}>
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="sidebar_item">
                                <h2>Thể loại</h2>
                                <ul>
                                    {categories.map((name, key) => (
                                        <li key={key}>
                                            <Link to={ROUTERS.USER.PRODUCTS}>{name}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-9">
                        <div className="row">
                            {
                                products.map((item, key) => (
                                    <div className="col-lg-4 col-md-3 col-sm-6 col-xs-12" key={key}>
                                        <ProductCard name={item.name} img={item.img} price={item.price} />
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        </>

    );
};

export default memo(ProductsPage);

