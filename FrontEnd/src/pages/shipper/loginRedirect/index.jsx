import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ROUTERS } from "../../../utils/router";

const getRole = (user) => {
  if (!user) return null;
  if (user.role) return user.role;
  if (user.admin || user.isAdmin) return "admin";
  if (user.shipper || (Array.isArray(user.roles) && user.roles.includes("shipper"))) return "shipper";
  return "user";
};

const LoginRedirect = () => {
  const user = useSelector((s) => s.auth?.login?.currentUser);
  const navigate = useNavigate();

  useEffect(() => {
    const role = getRole(user);
    if (!user) {
      navigate(ROUTERS.ADMIN.LOGIN, { replace: true, state: { from: ROUTERS.SHIPPER.DASHBOARD } });
      return;
    }
    if (role === "shipper") {
      navigate(ROUTERS.SHIPPER.DASHBOARD, { replace: true });
      return;
    }
    if (role === "admin") {
      navigate(ROUTERS.ADMIN.DASHBOARD, { replace: true });
      return;
    }
    navigate("/", { replace: true });
  }, [user, navigate]);

  return null;
};

export default LoginRedirect;
