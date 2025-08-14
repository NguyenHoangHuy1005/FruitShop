import { memo } from 'react';
import Header from "../header";
import Footer from "../../../admin/common/footer";
const masterLayout = ({ children, ...props }) => {
  return (
    <div {...props}>
      <Header />
      {children}
      <Footer />
    </div>
  );
};

export default memo(masterLayout);
