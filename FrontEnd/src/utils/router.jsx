export const ADMIN_PATH = "/admin";

export const ROUTERS = {
  USER: {
    HOME: "",
    PROFILE: "/profile",
    PRODUCTS: "/product",
    PRODUCT: "/product/detail/:id",
    SHOPPINGCART: "/cart",
    CHECKOUT: "/checkout",
  },
  ADMIN: {
    LOGIN: `${ADMIN_PATH}/login`,
    ORDERS: `${ADMIN_PATH}/orders`,
    LOGOUT: `${ADMIN_PATH}/logout`,
    SIGNUP: `${ADMIN_PATH}/signup`,
    PRODUCTS: `${ADMIN_PATH}/products`,
    USERMANAGER: `${ADMIN_PATH}/usermanager`,
    AUTH: `${ADMIN_PATH}/auth`,
  },
};
