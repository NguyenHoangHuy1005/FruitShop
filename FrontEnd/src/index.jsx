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

import SplashScreen from "../src/component/modals/SplashScreen"; 

function MainApp() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000); // hiển thị 3s
    return () => clearTimeout(timer);
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          {loading ? <SplashScreen /> : <RouterCustom />}
        </BrowserRouter>
      </PersistGate>
    </Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MainApp />);
