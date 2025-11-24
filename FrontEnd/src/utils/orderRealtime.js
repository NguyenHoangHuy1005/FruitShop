const listeners = new Set();

export const subscribeOrderUpdates = (callback) => {
  if (typeof callback !== "function") return () => {};
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const dispatchOrderUpdateEvent = (payload) => {
  listeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (err) {
      console.error("orderRealtime listener error:", err);
    }
  });
};
