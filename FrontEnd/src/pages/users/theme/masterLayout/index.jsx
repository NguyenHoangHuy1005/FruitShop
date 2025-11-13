import { memo } from 'react';
import Header from "../header";
import Footer from "../footer";
import ScrollToTop from "../../../../component/ScrollToTop";

const masterLayout = ({ children, ...props }) => {
  return (
    <div {...props}>
      <Header />
      <ScrollToTop />
      {children}
      <Footer />
    </div>
  );
};

export default memo(masterLayout);
