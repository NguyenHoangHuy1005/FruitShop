import { memo } from 'react';
import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import "./style.scss";
const slidesImg1 = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177109/uploads/hsphxledn4qzugjdnqf0.jpg";
<img src={slidesImg1} alt="Ảnh sản phẩm" />
const slidesImg2 = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177109/uploads/xsafgtsnwuhhxshrcgow.jpg";
<img src={slidesImg2} alt="Ảnh sản phẩm" />
const slidesImg3 = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177109/uploads/cq6drmb2orcmgswcdlim.jpg";
<img src={slidesImg3} alt="Ảnh sản phẩm" />
const slidesImg4 = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177110/uploads/wcobv5n1u9ysc7ymw10c.jpg";
<img src={slidesImg4} alt="Ảnh sản phẩm" />
const slidesImg5 = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177111/uploads/fr9pcwgs4jrxusa6iumy.jpg";
<img src={slidesImg5} alt="Ảnh sản phẩm" />
const botbanner1Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177061/uploads/xulbotuqjsc80wx3elfg.webp";
<img src={botbanner1Img} alt="Ảnh sản phẩm" />
const botbanner2Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177065/uploads/wgfzvomoctdu0j4hpzda.webp";
<img src={botbanner2Img} alt="Ảnh sản phẩm" />
const botbanner3Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177060/uploads/vbtnworyqt7kxoygrpb3.webp";
<img src={botbanner3Img} alt="Ảnh sản phẩm" />
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
