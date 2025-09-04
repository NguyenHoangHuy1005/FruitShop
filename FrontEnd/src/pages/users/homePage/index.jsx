import { memo, useEffect } from "react";
import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import "./style.scss";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ProductCard } from "../../../component/productCard";
import { getAllProduct } from "../../../component/redux/apiRequest";

// Banner ảnh
const botbanner1Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177061/uploads/xulbotuqjsc80wx3elfg.webp";
const botbanner2Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177065/uploads/wgfzvomoctdu0j4hpzda.webp";
const botbanner3Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177060/uploads/vbtnworyqt7kxoygrpb3.webp";

// Component render sản phẩm nổi bật (dữ liệu động từ API)
const RenderFeatProducts = () => {
    const dispatch = useDispatch();
    const products = useSelector((state) => state.product.products?.allProducts || []);
    useEffect(() => {
        getAllProduct(dispatch);
    }, [dispatch]);
    
    if (!products.length) return <p>Đang tải sản phẩm...</p>;
    return (
        <Tabs>
            <TabList>
                <Tab>Tất cả</Tab>
                <Tab>Đang giảm giá</Tab>
                <Tab>Sản phẩm mới</Tab>
            </TabList>
    
            {/* Tất cả */}
            <TabPanel>
                <div className="row">
                {products.map((item) => (
                    <div
                    className="col-lg-3 col-md-3 col-sm-6 col-xs-12"
                    key={item._id}
                    >
                    <ProductCard
                        id={item._id}
                        name={item.name}
                        description={item.description}
                        price={item.price}
                        category={item.category}
                        image={item.image}
                        status={item.status}
                        discountPercent={item.discountPercent}
                    />
                    </div>
                ))}
                </div>
            </TabPanel>

            {/* Đang giảm giá */}
            <TabPanel>
                <div className="row">
                {products
                    .filter((p) => Number(p.discountPercent) > 0)
                    .map((item) => (
                    <div
                        className="col-lg-3 col-md-3 col-sm-6 col-xs-12"
                        key={item._id}
                    >
                        <ProductCard {...item} />
                    </div>
                    ))}
                </div>
            </TabPanel>

            {/* Sản phẩm mới */}
            <TabPanel>
                <div className="row">
                {products
                    .slice(-8)
                    .map((item) => (
                    <div
                        className="col-lg-3 col-md-3 col-sm-6 col-xs-12"
                        key={item._id}
                    >
                        <ProductCard {...item} />
                    </div>
                    ))}
                </div>
            </TabPanel>
        </Tabs>
    );
};

const HomePage = () => {
    const responsive = {
        superLargeDesktop: { breakpoint: { max: 4000, min: 3000 }, items: 5 },
        desktop: { breakpoint: { max: 3000, min: 1024 }, items: 2 },
        tablet: { breakpoint: { max: 1024, min: 464 }, items: 2 },
        mobile: { breakpoint: { max: 464, min: 0 }, items: 1 },
    };
    
    const slides = [
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177109/uploads/hsphxledn4qzugjdnqf0.jpg", name: "Rau củ" },
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177109/uploads/xsafgtsnwuhhxshrcgow.jpg", name: "Trái cây" },
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177109/uploads/cq6drmb2orcmgswcdlim.jpg", name: "Hải sản" },
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177110/uploads/wcobv5n1u9ysc7ymw10c.jpg", name: "Thịt tươi" },
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177111/uploads/fr9pcwgs4jrxusa6iumy.jpg", name: "Thức phẩm khô" },
    ];
    
    return (
        <>
            {/* categories start */}
            <div className="container container__catagories_slides">
                <Carousel responsive={responsive} className="catagories_slides">
                    {slides.map((item, key) => (
                        <div
                            className="catagories_slides_item"
                            style={{ backgroundImage: `url(${item.slidesImg})` }}
                            key={key}
                        >
                            <p>{item.name}</p>
                        </div>
                    ))}
                </Carousel>
            </div>
            {/* categories end */}
    
            {/* featured start */}
            <div className="container">
                <div className="featured">
                    <div className="section-title">
                        <h2>Sản phẩm nổi bật</h2>
                    </div>
                    <RenderFeatProducts />
                </div>
            </div>
            {/* featured end */}
    
            {/* banner start */}
            <div className="container">
                <div className="banner">
                    <div className="banner__pic">
                        <Link to="#"><img src={botbanner1Img} alt="banner" /></Link>
                        <Link to="#"><img src={botbanner2Img} alt="banner" /></Link>
                        <Link to="#"><img src={botbanner3Img} alt="banner" /></Link>
                    </div>
                </div>
            </div>
            {/* banner end */}
        </>
    );
};

export default memo(HomePage);
