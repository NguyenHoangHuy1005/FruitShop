import { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import RouterCustom from "./router";
import "./style/style.scss";
import { Provider } from "react-redux";
import { store, persistor } from "../src/component/redux/store";
import { PersistGate } from "redux-persist/integration/react";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/700.css";
import ChatWidget from "./component/chat/ChatWidget";

import SplashScreen from "../src/component/modals/SplashScreen";

// import toastify
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// dY"? Import API instance ?`??? set token
import { API } from "./component/redux/apiRequest";

function MainApp() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // dY"? KhA'i ph???c token vA?o axios header khi app kh??Yi ?`??Tng
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      API.defaults.headers.common.Authorization = `Bearer ${token}`;
      console.log("?o. Token restored to axios:", token.substring(0, 20) + "...");
    }
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          {loading ? <SplashScreen /> : <RouterCustom />}

          {/* ?o. ThA?m ToastContainer toA?n c???c */}
          <ToastContainer
            position="top-center"
            autoClose={1000}
            hideProgressBar={false}
            newestOnTop={true}
            closeOnClick
            pauseOnHover
            draggable
            theme="colored"   //  n???n cA3 mA?u theo type (warning = vA?ng, error = ?`???)
          />
          <ChatWidget />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  );
}


ReactDOM.createRoot(document.getElementById("root")).render(<MainApp />);
