import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { getSocketBaseUrl } from "../../utils/socket";
import { ROUTERS } from "../../utils/router";
import { dispatchOrderUpdateEvent } from "../../utils/orderRealtime";

const isShipperUser = (user) => {
  if (!user) return false;
  if (user.role === "shipper") return true;
  if (user.shipper) return true;
  if (Array.isArray(user.roles) && user.roles.includes("shipper")) return true;
  return false;
};

const ShipperOrderRealtimeBridge = () => {
  const user = useSelector((state) => state.auth?.login?.currentUser);
  const token = user?.accessToken;
  const canShip = isShipperUser(user);
  const socketRef = useRef(null);
  const seenProcessingRef = useRef(new Set());
  const navigate = useNavigate();

  const maybeShowProcessingToast = useCallback((order) => {
    if (!order) return;
    const status = String(order.status || "").toLowerCase();
    if (status !== "processing") return;
    if (order.shipperId) {
      seenProcessingRef.current.delete(order.id);
      return;
    }
    const orderId = order.id || order._id;
    if (!orderId) return;
    if (seenProcessingRef.current.has(orderId)) return;
    seenProcessingRef.current.add(orderId);
    const shortId = String(orderId).slice(-8).toUpperCase();
    const content = (
      <div className="shipper-toast">
        <p>Đơn #{shortId} đang chờ nhận</p>
        <button
          type="button"
          onClick={() => navigate(`${ROUTERS.SHIPPER.ORDERS}/${orderId}`)}
        >
          Xem ngay
        </button>
      </div>
    );
    toast.info(content, {
      position: "top-right",
      autoClose: 5000,
      closeOnClick: true,
    });
  }, [navigate]);

  useEffect(() => {
    if (!token || !canShip) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = socket;

    const handleOrderUpdate = (payload) => {
      console.log("[shipper order realtime]", payload);
      dispatchOrderUpdateEvent(payload);
      if (payload?.order) {
        maybeShowProcessingToast(payload.order);
      }
    };

    socket.on("order:update", handleOrderUpdate);

    return () => {
      socket.off("order:update", handleOrderUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, canShip, maybeShowProcessingToast]);

  return null;
};

export default ShipperOrderRealtimeBridge;
