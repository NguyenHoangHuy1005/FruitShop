export const getSocketBaseUrl = () => {
  const apiBase = import.meta?.env?.VITE_API_BASE || "http://localhost:3000/api";
  return apiBase.replace(/\/api\/?$/, "");
};
