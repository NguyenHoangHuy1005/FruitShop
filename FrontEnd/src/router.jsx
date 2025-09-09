import { Routes, Route, useLocation } from "react-router-dom";
import HomePage from "./pages/users/homePage";
import { ROUTERS } from "./utils/router";
import MasterLayout from "./pages/users/theme/masterLayout";

import OrderUserPage from "./pages/users/ordersPage";
import ProfilePage from "./pages/users/profilePage";
import ProductsPage from "./pages/users/productsPage";
import ProductDetail from "./pages/users/productDetail";
import ShoppingCart from "./pages/users/shoppingCart";
import CheckoutPage from "./pages/users/checkoutPage";
import ContactPage from "./pages/users/contactPage";

import LoginPage from "./pages/admin/loginPage";
import SignupPage from "./pages/admin/signupPage";
import Auth from "./pages/admin/auth";
//mới đây nè
import ForgotPasswordPage from "./pages/admin/forgotPassword";

import Dashboard from "./pages/admin/dashboard";
import ProductManagerPage from "./pages/admin/productmanagerPage";
import OrderAdminPage from "./pages/admin/orderPage";
import UserManagerPage from "./pages/admin/usermanagerPage";
import MasterAdLayout from "./pages/admin/theme/masterAdLayout";
import StockManagerPage from "./pages/admin/stockPage";

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
    { path: ROUTERS.USER.CONTACT,      element: <ContactPage /> },
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
    { path: ROUTERS.ADMIN.USERMANAGER, element: <UserManagerPage /> },
    { path: ROUTERS.ADMIN.ORDERS,      element: <OrderAdminPage /> },
    { path: ROUTERS.ADMIN.STOCK,       element: <StockManagerPage /> },
  ];
  return (
    <MasterAdLayout>
      <Routes>
        {appRouters.map((r, i) => (
          <Route key={i} path={r.path} element={r.element} />
        ))}
      </Routes>
    </MasterAdLayout>
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
    pathname.startsWith(ROUTERS.ADMIN.DASHBOARD)   ||
    pathname.startsWith(ROUTERS.ADMIN.PRODUCTS)   ||
    pathname.startsWith(ROUTERS.ADMIN.USERMANAGER)||
    pathname.startsWith(ROUTERS.ADMIN.ORDERS) ||
    pathname.startsWith(ROUTERS.ADMIN.STOCK);

  if (isAdminAuth) return renderAdminAuthRouter();
  if (isAdminApp)  return renderAdminAppRouter();
  return renderUserRouter();
};

export default RouterCustom;
