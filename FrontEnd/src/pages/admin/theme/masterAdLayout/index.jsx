import { memo } from 'react';
import Footer from "../../../users/theme/footer"; 
import { useLocation} from 'react-router-dom';
import { ROUTERS } from "../../../../utils/router";
import HeaderAd from "../header";

const masterAdLayout = ({ children, ...props }) => {
  const location = useLocation();
  const isLoginPage = location.pathname.startsWith(ROUTERS.ADMIN.LOGIN);
  const isSignupPage = location.pathname.startsWith(ROUTERS.ADMIN.SIGNUP);
  const isDashboard = location.pathname.startsWith(ROUTERS.ADMIN.DASHBOARD);
  

  return (
    <div {...props}>
      {!isLoginPage && !isSignupPage && <HeaderAd/>}
      {children}
      {!isLoginPage && !isSignupPage && !isDashboard && <Footer/>}
    </div>
  );
};

export default memo(masterAdLayout);
