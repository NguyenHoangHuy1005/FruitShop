import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { AiOutlineArrowRight } from "react-icons/ai";
import { BiTimeFive } from "react-icons/bi";
import { MdLocalOffer } from "react-icons/md";
import { ROUTERS } from "../../../utils/router";
import "./style.scss";

const STATIC_ARTICLES = [
    {
        id: "seasonal-fruits",
        title: "Trái cây theo mùa: Bí quyết chọn chuẩn từng loại",
        excerpt:
        "Nắm rõ mùa vụ và điểm nhận biết giúp bạn luôn chọn được trái cây tươi ngon nhất cho gia đình.",
        category: "Mẹo chọn hàng",
        readTime: "5 phút đọc",
        date: "12/05/2024",
        image:
        "https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: "juicy-recipes",
        title: "3 công thức nước ép giúp giải nhiệt tức thì",
        excerpt:
        "Kết hợp táo, thơm và bạc hà để có ly nước ép thanh mát, đầy đủ vitamin mà không cần thêm đường.",
        category: "Công thức",
        readTime: "4 phút đọc",
        date: "28/04/2024",
        image:
        "https://images.unsplash.com/photo-1524592714635-d77511a4834d?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: "healthy-snack",
        title: "Ăn vặt lành mạnh với trái cây sấy giòn",
        excerpt:
        "Thay đổi thói quen ăn vặt bằng các loại trái cây sấy giữ nguyên dưỡng chất và hương vị tự nhiên.",
        category: "Dinh dưỡng",
        readTime: "6 phút đọc",
        date: "15/04/2024",
        image:
        "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80",
    },
    {
        id: "gift-basket",
        title: "Gợi ý giỏ quà trái cây sang trọng cho dịp đặc biệt",
        excerpt:
        "Từ tông màu đến cách phối loại trái cây, tất cả đều tạo nên một giỏ quà chỉnh chu và tinh tế.",
        category: "Cảm hứng",
        readTime: "3 phút đọc",
        date: "02/04/2024",
        image:
        "https://tse2.mm.bing.net/th/id/OIP.PvT4gTDH7zO5d0um-9FmqgHaHa?cb=12&w=474&h=474&c=7&p=0",
    },
];

const ArticlesPage = () => {
    const articles = useMemo(() => STATIC_ARTICLES, []);
    const featured = articles[0];
    const spotlight = articles[1] || articles[0];
    const rest = articles.slice(spotlight && spotlight !== featured ? 2 : 1);
    const articleBasePath = ROUTERS.USER.ARTICLES;
    const getAnchor = (id, scope = "latest") => `article-${scope}-${id}`;

    return (
        <div className="articles-page">
        <div className="articles-hero">
            <div className="container">
            <div className="hero-content card">
                <span className="hero-tag">Bài viết mới</span>
                <h1>Trái cây sạch cho cuộc sống cân bằng</h1>
                <p>
                Cùng FruitShop khám phá nguồn cảm hứng nấu ăn, mẹo dinh dưỡng và câu chuyện
                mùa vụ để mỗi bữa ăn đều tròn vị và tốt cho sức khỏe.
                </p>
                {featured && (
                <Link
                    to={`${articleBasePath}#${getAnchor(featured.id)}`}
                    className="hero-link"
                >
                    Đọc ngay <AiOutlineArrowRight />
                </Link>
                )}
            </div>
            <div className="hero-highlight">
                {featured && <img src={featured.image} alt={featured.title} />}
            </div>
            </div>
        </div>

        <div className="container">
            <section className="spotlight-section">
            <header className="section-head">
                <h2>Góc nổi bật</h2>
                <Link to={articleBasePath} className="view-all">
                Xem tất cả <AiOutlineArrowRight />
                </Link>
            </header>
            <div className="spotlight-grid">
                {spotlight && (
                <article
                    className="spotlight-card"
                    id={getAnchor(spotlight.id, "spotlight")}
                >
                    <div className="card-media">
                    <img src={spotlight.image} alt={spotlight.title} />
                    <span className="card-badge">{spotlight.category}</span>
                    </div>
                    <div className="card-body">
                    <h3>{spotlight.title}</h3>
                    <p>{spotlight.excerpt}</p>
                    <div className="card-meta">
                        <span>{spotlight.readTime}</span>
                        <span>{spotlight.date}</span>
                    </div>
                    <Link
                        to={`${articleBasePath}#${getAnchor(spotlight.id)}`}
                        className="card-link"
                    >
                        Đọc tiếp <AiOutlineArrowRight />
                    </Link>
                    </div>
                </article>
                )}
                <ul className="spotlight-list">
                {rest.map((article) => (
                    <li key={article.id} id={getAnchor(article.id, "summary")}>
                    <Link to={`${articleBasePath}#${getAnchor(article.id)}`}>
                        <span className="pill">
                        <MdLocalOffer /> {article.category}
                        </span>
                        <div className="list-text">
                        <h4>{article.title}</h4>
                        <p>{article.excerpt}</p>
                        <span className="list-meta">
                            <BiTimeFive /> {article.readTime}
                        </span>
                        </div>
                    </Link>
                    </li>
                ))}
                </ul>
            </div>
            </section>

            <section className="latest-section">
            <header className="section-head">
                <h2>Bài viết gần đây</h2>
                <p>
                Cập nhật thường xuyên các bí quyết chọn lựa, bảo quản và chế biến trái cây dành cho bạn.
                </p>
            </header>
            <div className="latest-grid">
                {STATIC_ARTICLES.map((article) => (
                <article
                    key={article.id}
                    id={getAnchor(article.id)}
                    className="latest-card"
                >
                    <div className="card-media">
                    <img src={article.image} alt={article.title} />
                    <span className="card-badge">{article.category}</span>
                    </div>
                    <div className="card-body">
                    <h3>{article.title}</h3>
                    <p>{article.excerpt}</p>
                    <div className="card-meta">
                        <span>{article.readTime}</span>
                        <span>{article.date}</span>
                    </div>
                    <Link
                        to={`${articleBasePath}#${getAnchor(article.id)}`}
                        className="card-link"
                    >
                        Đọc tiếp <AiOutlineArrowRight />
                    </Link>
                    </div>
                </article>
                ))}
            </div>
            </section>
        </div>
        </div>
    );
};

export default ArticlesPage;