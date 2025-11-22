
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import HomePage from "./pages/users/homePage";
import { ROUTERS } from "./utils/router";
import MasterLayout from "./pages/users/theme/masterLayout";

// User routes
import OrderUserPage from "./pages/users/ordersPage";
import ProfilePage from "./pages/users/profilePage";
import ProductsPage from "./pages/users/productsPage";
import ProductDetail from "./pages/users/productDetail";
import ShoppingCart from "./pages/users/shoppingCart";
import CheckoutPage from "./pages/users/checkoutPage";
import ContactPage from "./pages/users/contactPage";
import PaymentPage from "./pages/users/paymentPage";
import ArticlesPage from "./pages/users/articlesPage";
import ArticleDetailPage from "./pages/users/articleDetailPage";
import NotificationsPage from "./pages/users/notificationsPage";

// Admin auth routes
import LoginPage from "./pages/admin/loginPage";
import SignupPage from "./pages/admin/signupPage";
import Auth from "./pages/admin/auth";
import ForgotPasswordPage from "./pages/admin/forgotPassword";

// Admin routes
import Dashboard from "./pages/admin/dashboard";
import ProductManagerPage from "./pages/admin/productmanagerPage";
import CouponManagerPage from "./pages/admin/couponmanagerPage";
import OrderAdminPage from "./pages/admin/orderPage";
import UserManagerPage from "./pages/admin/usermanagerPage";
import MasterAdLayout from "./pages/admin/theme/masterAdLayout";
import StockManagerPage from "./pages/admin/stockPage";
import InvoicePage from "./pages/admin/invoicePage";
import ContentManagementPage from "./pages/admin/contentPage";

// Shipper routes
import ShipperLoginRedirect from "./pages/shipper/loginRedirect";
import ShipperDashboard from "./pages/shipper/dashboard";
import ShipperOrders from "./pages/shipper/orders";
import ShipperOrderDetail from "./pages/shipper/orderDetail";
import ShipperDelivering from "./pages/shipper/delivering";
import ShipperProfile from "./pages/shipper/profile";
import ShipperLayout from "./pages/shipper/layout";

const getRole = (user) => {
  if (!user) return null;
  if (user.role) return user.role;
  if (user.admin || user.isAdmin) return "admin";
  if (user.shipper || (Array.isArray(user.roles) && user.roles.includes("shipper"))) return "shipper";
  return "user";
};

//  Trang b?o l?i 403
const ForbiddenPage = () => (
  <div style={{ textAlign: "center", padding: "50px" }}>
    <h1>403 - Forbidden</h1>
    <p>Bạn không có quyền truy cập vào trang này.</p>
  </div>
);

//  Middleware check Admin
const RequireAdmin = ({ children }) => {
  const user = useSelector((state) => state.auth.login?.currentUser);
  const role = getRole(user);

  // chưa có user => coi như chưa login
  if (!user) return <Navigate to={ROUTERS.ADMIN.LOGIN} replace />;

  // nếu không phải admin
  if (role !== "admin") return <ForbiddenPage />;

  return children;
};

// Middleware check Shipper
const RequireShipper = ({ children }) => {
  const user = useSelector((state) => state.auth.login?.currentUser);
  const role = getRole(user);
  const location = useLocation();
  if (!user || role !== "shipper") {
    return (
      <Navigate
        to={ROUTERS.ADMIN.LOGIN}
        replace
        state={{ from: location.pathname }}
      />
    );
  }
  return children;
};

// ---------- USER ROUTES ----------
const renderUserRouter = () => {
  const userRouters = [
    { path: ROUTERS.USER.HOME,         element: <HomePage /> },
    { path: ROUTERS.USER.ORDERS,       element: <OrderUserPage /> },
    { path: ROUTERS.USER.PROFILE,      element: <ProfilePage /> },
    { path: ROUTERS.USER.PRODUCTS,     element: <ProductsPage /> },
    { path: ROUTERS.USER.PRODUCT,      element: <ProductDetail /> },
    { path: ROUTERS.USER.SHOPPINGCART, element: <ShoppingCart /> },
    { path: ROUTERS.USER.CHECKOUT,     element: <CheckoutPage /> },
    { path: ROUTERS.USER.ARTICLES,     element: <ArticlesPage /> },
    { path: ROUTERS.USER.ARTICLE_DETAIL, element: <ArticleDetailPage /> },
    { path: ROUTERS.USER.CONTACT,      element: <ContactPage /> },
    { path: ROUTERS.USER.PAYMENT,      element: <PaymentPage /> },
    { path: ROUTERS.USER.PAYMENT_SUCCESS, element: <PaymentPage /> },
    { path: ROUTERS.USER.NOTIFICATIONS, element: <NotificationsPage /> },
  ];
  return (
    <MasterLayout>
      <Routes>
        {userRouters.map((r, i) => (
          <Route key={i} path={r.path} element={r.element} />
        ))}
      </Routes>
    </MasterLayout>
  );
};

// ---------- SHIPPER ROUTES ----------
const renderShipperRouter = () => {
  return (
    <Routes>
      <Route path={ROUTERS.SHIPPER.ROOT} element={<ShipperLoginRedirect />} />
      <Route path={ROUTERS.SHIPPER.LOGIN} element={<Navigate to={ROUTERS.ADMIN.LOGIN} replace />} />
      <Route
        path={ROUTERS.SHIPPER.DASHBOARD}
        element={
          <RequireShipper>
            <ShipperLayout><ShipperDashboard /></ShipperLayout>
          </RequireShipper>
        }
      />
      <Route
        path={ROUTERS.SHIPPER.ORDERS}
        element={
          <RequireShipper>
            <ShipperLayout><ShipperOrders /></ShipperLayout>
          </RequireShipper>
        }
      />
      <Route
        path={ROUTERS.SHIPPER.ORDER_DETAIL}
        element={
          <RequireShipper>
            <ShipperLayout><ShipperOrderDetail /></ShipperLayout>
          </RequireShipper>
        }
      />
      <Route
        path={ROUTERS.SHIPPER.DELIVERING}
        element={
          <RequireShipper>
            <ShipperLayout><ShipperDelivering /></ShipperLayout>
          </RequireShipper>
        }
      />
      <Route
        path={ROUTERS.SHIPPER.PROFILE}
        element={
          <RequireShipper>
            <ShipperLayout><ShipperProfile /></ShipperLayout>
          </RequireShipper>
        }
      />
    </Routes>
  );
};

// ---------- ADMIN AUTH (no layout) ---------
const renderAdminAuthRouter = () => {
  const authRouters = [
    { path: ROUTERS.ADMIN.LOGIN,  element: <LoginPage /> },
    { path: ROUTERS.ADMIN.SIGNUP, element: <SignupPage /> },
    { path: ROUTERS.ADMIN.AUTH,   element: <Auth /> },
    { path: ROUTERS.ADMIN.FORGOT, element: <ForgotPasswordPage /> },
  ];
  return (
    <Routes>
      {authRouters.map((r, i) => (
        <Route key={i} path={r.path} element={r.element} />
      ))}
    </Routes>
  );
};

// ---------- ADMIN APP (with layout) ----------
const renderAdminAppRouter = () => {
  const appRouters = [
    { path: ROUTERS.ADMIN.DASHBOARD,    element: <Dashboard /> },
    { path: ROUTERS.ADMIN.PRODUCTS,    element: <ProductManagerPage /> },
    { path: ROUTERS.ADMIN.COUPON,    element: <CouponManagerPage /> },
    { path: ROUTERS.ADMIN.USERMANAGER, element: <UserManagerPage /> },
    { path: ROUTERS.ADMIN.ORDERS,      element: <OrderAdminPage /> },
    { path: ROUTERS.ADMIN.STOCK,       element: <StockManagerPage /> },
    { path: ROUTERS.ADMIN.INVOICES, element: <InvoicePage /> },
    { path: ROUTERS.ADMIN.CONTENT, element: <ContentManagementPage /> },
  ];
  return (
    <Routes>
        <Route path="/admin" element={<Navigate to={ROUTERS.ADMIN.DASHBOARD} replace />} />

        {appRouters.map((r, i) => (
          <Route
            key={i}
            path={r.path}
            element={
              <RequireAdmin>
                {/*    ch? admin m?i c? layout admin */}
                <MasterAdLayout>{r.element}</MasterAdLayout>
              </RequireAdmin>
            }
          />
        ))}
      </Routes>
  );
};

const RouterCustom = () => {
  const { pathname } = useLocation();

  const isAdminAuth =
    pathname.startsWith(ROUTERS.ADMIN.LOGIN)  ||
    pathname.startsWith(ROUTERS.ADMIN.SIGNUP) ||
    pathname.startsWith(ROUTERS.ADMIN.AUTH)   ||
    pathname.startsWith(ROUTERS.ADMIN.FORGOT);

  const isAdminApp =
    pathname === "/admin" ||
    pathname.startsWith(ROUTERS.ADMIN.DASHBOARD)   ||
    pathname.startsWith(ROUTERS.ADMIN.PRODUCTS)   ||
    pathname.startsWith(ROUTERS.ADMIN.COUPON)   ||
    pathname.startsWith(ROUTERS.ADMIN.USERMANAGER)||
    pathname.startsWith(ROUTERS.ADMIN.ORDERS) ||
    pathname.startsWith(ROUTERS.ADMIN.STOCK) ||
    pathname.startsWith(ROUTERS.ADMIN.INVOICES) ||
    pathname.startsWith(ROUTERS.ADMIN.CONTENT);

  const isShipper = pathname.startsWith(ROUTERS.SHIPPER.ROOT);

  if (isAdminAuth) return renderAdminAuthRouter();
  if (isAdminApp)  return renderAdminAppRouter();
  if (isShipper) return renderShipperRouter();
  return renderUserRouter();
};

export default RouterCustom;
