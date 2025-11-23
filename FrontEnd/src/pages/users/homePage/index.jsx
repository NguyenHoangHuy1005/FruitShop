import { memo, useEffect, useRef } from "react";
import Carousel from "react-multi-carousel";
import "react-multi-carousel/lib/styles.css";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import "./style.scss";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ProductCard } from "../../../component/productCard";
import { getAllProduct, fetchActiveBanners, recordBannerView, recordBannerClick } from "../../../component/redux/apiRequest";

// Banner fallback images
const botbanner1Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177061/uploads/xulbotuqjsc80wx3elfg.webp";
const botbanner2Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177065/uploads/wgfzvomoctdu0j4hpzda.webp";
const botbanner3Img = "https://res.cloudinary.com/dnk3xed3n/image/upload/v1755177060/uploads/vbtnworyqt7kxoygrpb3.webp";
const fallbackBottomBanners = [
    { image: botbanner1Img, link: "" },
    { image: botbanner2Img, link: "" },
    { image: botbanner3Img, link: "" },
];

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
                                onHand={item.onHand}
                                unit={item.unit}
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
                                <ProductCard
                                    id={item._id}
                                    name={item.name}
                                    description={item.description}
                                    price={item.price}
                                    category={item.category}
                                    image={item.image}
                                    status={item.status}
                                    discountPercent={item.discountPercent}
                                    onHand={item.onHand}
                                    unit={item.unit}
                                />
                            </div>
                        ))}
                </div>
            </TabPanel>

            <TabPanel>
                <div className="row">
                    {products
                        .slice(-8)
                        .map((item) => (
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
                                    onHand={item.onHand}
                                    unit={item.unit}
                                />
                            </div>
                        ))}
                </div>
            </TabPanel>
        </Tabs>
    );
};

const HomePage = () => {
    const dispatch = useDispatch();
    const bannerPositions = useSelector((state) => state.banner?.active?.byPosition || {});
    const sliderBanners = Array.isArray(bannerPositions.HOME_SLIDER?.items)
        ? bannerPositions.HOME_SLIDER.items
        : [];
    const bottomBanners = Array.isArray(bannerPositions.HOME_BOTTOM_BANNER?.items)
        ? bannerPositions.HOME_BOTTOM_BANNER.items
        : [];
    const viewedBannersRef = useRef(new Set());

    useEffect(() => {
        fetchActiveBanners(dispatch, "HOME_SLIDER", { limit: 10 });
        fetchActiveBanners(dispatch, "HOME_BOTTOM_BANNER", { limit: 6 });
    }, [dispatch]);

    useEffect(() => {
        const seen = viewedBannersRef.current;
        [...sliderBanners, ...bottomBanners].forEach((banner) => {
            const id = banner?._id || banner?.id;
            if (id && !seen.has(id)) {
                seen.add(id);
                recordBannerView(id);
            }
        });
    }, [sliderBanners, bottomBanners]);

    const responsive = {
        superLargeDesktop: { breakpoint: { max: 4000, min: 3000 }, items: 2 },
        desktop: { breakpoint: { max: 3000, min: 1024 }, items: 1 },
        tablet: { breakpoint: { max: 1024, min: 464 }, items: 1 },
        mobile: { breakpoint: { max: 464, min: 0 }, items: 1 },
    };

    const fallbackSlides = [
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1756812860/2_f102rl.png", },
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1756812855/3_hxkxjn.png", },
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1756812857/1_ynuj72.png", },
        { slidesImg: "https://res.cloudinary.com/dnk3xed3n/image/upload/v1756809222/slides2_qyfb0s.png", },
    ];

    const sliderItems = sliderBanners.length ? sliderBanners : fallbackSlides;
    const bottomItems = bottomBanners.length ? bottomBanners : fallbackBottomBanners;

    const getBannerImage = (banner, fallback) => {
        if (!banner) return fallback;
        return banner.imageDesktop || banner.imageMobile || banner.slidesImg || banner.image || fallback;
    };

    const wrapBannerLink = (banner, fallbackLink, content, key) => {
        const target = (banner?.redirectUrl || fallbackLink || "").trim();
        const handleClick = () => {
            if (banner?._id) {
                recordBannerClick(banner._id);
            }
        };
        if (!target) {
            return (
                <div className="banner-link" key={key}>
                    {content}
                </div>
            );
        }
        if (/^https?:\/\//i.test(target)) {
            return (
                <a key={key} href={target} target="_blank" rel="noreferrer" onClick={handleClick}>
                    {content}
                </a>
            );
        }
        return (
            <Link key={key} to={target} onClick={handleClick}>
                {content}
            </Link>
        );
    };

    return (
        <>
            {/* categories start */}
            <div className="container container__categories_slides">
                <Carousel
                    responsive={responsive}
                    className="categories_slides"
                    autoPlay={true}           // Tự động chạy
                    autoPlaySpeed={2500}      // Thời gian chuyển (ms)
                    infinite={true}           // Lặp vô hạn
                    showDots={true}           // Hiện chấm điều hướng
                    arrows={true}            // Ẩn mũi tên (tùy thích)
                >
                    {sliderItems.map((item, index) => {
                        const image = getBannerImage(item, item.slidesImg);
                        const content = (
                            <div
                                className="categories_slides_item"
                                style={{ backgroundImage: `url(${image})` }}
                                data-rotation-group={item.rotationGroup || undefined}
                                aria-label={item.title || item.name || `Banner ${index + 1}`}
                            />
                        );
                        return wrapBannerLink(item, item.link, content, item._id || index);
                    })}
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
                        {bottomItems.map((banner, index) => {
                            const image = getBannerImage(banner, banner.image);
                            const title = banner.title || `Banner ${index + 1}`;
                            const content = (
                                <img
                                    src={image}
                                    alt={title}
                                    data-rotation-group={banner.rotationGroup || undefined}
                                />
                            );
                            return wrapBannerLink(banner, banner.link, content, banner._id || banner.image || index);
                        })}
                    </div>
                </div>
            </div>
            {/* banner end */}
        </>
    );
};

export default memo(HomePage);
