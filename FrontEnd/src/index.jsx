import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import RouterCustom from './router'
import './style/style.scss';
import { Provider } from "react-redux";
import { store, persistor } from "../src/component/redux/store";
import { PersistGate } from 'redux-persist/integration/react';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/700.css';



ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
    <BrowserRouter>
      <RouterCustom />
    </BrowserRouter>
    </PersistGate>
  </Provider>
)