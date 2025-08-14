import { memo } from 'react';
import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import "./style.scss";
import slidesImg1 from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/slides/slides1.jpg";
import slidesImg2 from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/slides/slides2.jpg";
import slidesImg3 from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/slides/slides3.jpg";
import slidesImg4 from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/slides/slides4.jpg";
import slidesImg5 from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/slides/slides5.jpg";
import botbanner1Img from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/banner/botbanner1.jpg";
import botbanner2Img from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/banner/botbanner2.jpg";
import botbanner3Img from "D:/KLTN/FruitShop/FrontEnd/src/assets/user/images/banner/botbanner3.jpg";
import { Link } from 'react-router-dom';
import { ProductCard } from "../../../component";
import { featProducts } from "../../../utils/common";

//render sản phẩm với data truyền vào
export const renderFeatProducts = (data) => {
    const tabList = [];
    const tabPanels = [];

    Object.keys(data).forEach((key, index) => {
        if (!data[key] || !Array.isArray(data[key].products)) {
            return; // bỏ qua nếu không có products
        }
        console.log(key, index);
        tabList.push(<Tab key={index}>{data[key].title}</Tab>);

        const tabPanel = [];
        data[key].products.forEach((item, j) => {
            tabPanel.push(
                <div className="col-lg-3 col-md-3 col-sm-6 col-xs-12" key={j}>
                    <ProductCard id={item.id} name={item.name} img={item.img} price={item.price} />
                </div>
            );
        });
        tabPanels.push(tabPanel);
    });
    return (
        <Tabs>
            <TabList>{tabList}</TabList>
            {tabPanels.map((item, key) => (
                <TabPanel key={key}>
                    <div className="row">
                        {item}
                    </div>
                </TabPanel>
            ))}
        </Tabs>
    );
};
const homePage = () => {
    const responsive = {
        superLargeDesktop: {
            // the naming can be any, depends on you.
            breakpoint: { max: 4000, min: 3000 },
            items: 5
        },
        desktop: {
            breakpoint: { max: 3000, min: 1024 },
            items: 2
        },
        tablet: {
            breakpoint: { max: 1024, min: 464 },
            items: 2
        },
        mobile: {
            breakpoint: { max: 464, min: 0 },
            items: 1
        }
    };


    const slides = [
        {
            slidesImg: slidesImg1,
            name: "Rau củ",
        },
        {
            slidesImg: slidesImg2,
            name: "Trái cây",
        },
        {
            slidesImg: slidesImg3,
            name: "Hải sản",
        },
        {
            slidesImg: slidesImg4,
            name: "Thịt tươi",
        },
        {
            slidesImg: slidesImg5,
            name: "Thức phẩm khô",
        },
    ];

    return (
        <>
            {/*catagories start */}
            <div className="container container__catagories_slides">
                <Carousel responsive={responsive} className="catagories_slides">
                    {
                        slides.map((item, key) => (
                            <div className="catagories_slides_item"
                                style={{ backgroundImage: `url(${item.slidesImg})` }}
                                key={key}
                            >
                                <p>{item.name}</p>
                            </div>
                        ))}
                </Carousel>
            </div>
            {/*catagories end */}
            {/*featured start*/}
            <div className="container">
                <div className="featured">
                    <div className="section-title">
                        <h2>Sản phẩm nổi bật</h2>

                    </div>
                    {renderFeatProducts(featProducts)}
                </div>
            </div>
            {/*featured end*/}
            {/*banner start*/}
            <div className="container">
                <div className="banner">
                    <div className="banner__pic">
                        <Link to="#" className="banner__Link">
                            <img src={botbanner1Img} alt="banner" />
                        </Link>
                        <Link to="#" className="banner__Link">
                            <img src={botbanner2Img} alt="banner" />
                        </Link>
                        <Link to="#" className="banner__Link">
                            <img src={botbanner3Img} alt="banner" />
                        </Link>
                    </div>

                </div>
            </div>
            {/*banner end*/}
        </>
    );

};

export default memo(homePage);
