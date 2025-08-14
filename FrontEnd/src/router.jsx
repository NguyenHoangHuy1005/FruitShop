import { Routes, Route, useLocation } from "react-router-dom";
import HomePage from "./pages/users/homePage";
import { ROUTERS } from "./utils/router";
import MasterLayout from "./pages/users/theme/masterLayout";
import ProfilePage from "./pages/users/profilePage";
import ProductsPage from "./pages/users/productsPage";
import ProductDetail from "./pages/users/productDetail";
import ShoppingCart from "./pages/users/shoppingCart";
import CheckoutPage from "./pages/users/checkoutPage";

import LoginPage from "./pages/admin/loginPage";
import SignupPage from "./pages/admin/signupPage";
import ProductManagerPage from "./pages/admin/productmanagerPage";
import OrderAdminPage from "./pages/admin/orderPage";
import UserManagerPage from "./pages/admin/usermanagerPage";
import MasterAdLayout from "./pages/admin/theme/masterAdLayout";
const renderUserRouter = () => {
  const userRouters = [
    {
      path: ROUTERS.USER.HOME,
      element: <HomePage />,
    },
    {
      path: ROUTERS.USER.PROFILE,
      element: <ProfilePage />,
    },
    {
      path: ROUTERS.USER.PRODUCTS,
      element: <ProductsPage />,
    },
    {
      path: ROUTERS.USER.PRODUCT,
      element: <ProductDetail />,
    },
    {
      path: ROUTERS.USER.SHOPPINGCART,
      element: <ShoppingCart />,
    },
    {
      path: ROUTERS.USER.CHECKOUT,
      element: <CheckoutPage />,
    },
  ];
  return (
    <MasterLayout>
      <Routes>
        {userRouters.map((item, key) => (
          <Route key={key} path={item.path} element={item.element} />
        ))}
      </Routes>
    </MasterLayout>

  );
};

const renderAdminRouter = () => {
  const adminRouters = [
    {
      path: ROUTERS.ADMIN.LOGIN,
      element: <LoginPage />,
    },
     {
      path: ROUTERS.ADMIN.SIGNUP,
      element: <SignupPage/>,
    },
     {
      path: ROUTERS.ADMIN.PRODUCTS,
      element: <ProductManagerPage />,
    },
    {
      path: ROUTERS.ADMIN.USERMANAGER,
      element: <UserManagerPage />,
    },
    {
      path: ROUTERS.ADMIN.ORDERS,
      element: <OrderAdminPage />,
    },

  ];
  return (
    <MasterAdLayout>
      <Routes>
        {adminRouters.map((item, key) => (
          <Route key={key} path={item.path} element={item.element} />
        ))}
      </Routes>
    </MasterAdLayout>

  );
};

const RouterCustom = () => {
  const location = useLocation();
  const isAdminrouters = 
    location.pathname.startsWith(ROUTERS.ADMIN.LOGIN) ||
    location.pathname.startsWith(ROUTERS.ADMIN.PRODUCTS)||
    location.pathname.startsWith(ROUTERS.ADMIN.USERMANAGER)||
    location.pathname.startsWith(ROUTERS.ADMIN.ORDERS)||
    location.pathname.startsWith(ROUTERS.ADMIN.SIGNUP);
  return isAdminrouters ? renderAdminRouter() : renderUserRouter();
};

export default RouterCustom;
