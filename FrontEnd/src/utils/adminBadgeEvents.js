const EVENT_KEY = "admin_badge_refresh";

export const ADMIN_BADGE_REFRESH_EVENT = EVENT_KEY;

export const emitAdminBadgeRefresh = () => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_KEY));
  } catch {
    // ignore
  }
};
