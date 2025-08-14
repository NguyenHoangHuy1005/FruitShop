import { useNavigate } from "react-router-dom";
import "./style.scss";
import { memo } from 'react';
import { ROUTERS } from "../../../utils/router";

const OrderAdminPage = () => {
    return <div className="container">
        <div className="orders">
            <h2>QUẢN LÝ ĐƠN HÀNG</h2>

            <div className="orders__content">
                <table className="orders__table">
                    <thead>
                        <tr> 
                        <th>Mã đơn hàng</th>
                        <th>Tổng đơn</th>
                        <th>Khách hàng</th>
                        <th>Ngày đặt</th>
                        <th>Trạng thái</th>
                        </tr>
                       
                        <tbody>
                            <tr>
                                <td>1</td>
                                <td>2</td>
                                <td>3</td>
                                <td>4</td>
                                <td>5</td>
                            </tr>
                        </tbody>
                    </thead>
                </table>
            </div>

            <div className="orders__footer">
                <div className="orders__patination">Phân trang</div>
            </div>
        </div>

    </div>
}
export default memo(OrderAdminPage);
