export const ADMIN_PATH = "/admin";

export const ROUTERS = {
  USER: {
    HOME: "",
    ORDERS: "/orders",
    PROFILE: "/profile",
    PRODUCTS: "/product",
    PRODUCT: "/product/detail/:id",
    SHOPPINGCART: "/cart",
    CHECKOUT: "/checkout",
    CONTACT: "/contact",
  },
  ADMIN: {
    DASHBOARD: `${ADMIN_PATH}/dashboard`,
    LOGIN: `${ADMIN_PATH}/login`,
    ORDERS: `${ADMIN_PATH}/orders`,
    LOGOUT: `${ADMIN_PATH}/logout`,
    SIGNUP: `${ADMIN_PATH}/signup`,
    PRODUCTS: `${ADMIN_PATH}/products`,
    USERMANAGER: `${ADMIN_PATH}/usermanager`,
    AUTH: `${ADMIN_PATH}/auth`,
    FORGOT: `${ADMIN_PATH}/forgot`,
    STOCK: `${ADMIN_PATH}/stock`,
  },
};
