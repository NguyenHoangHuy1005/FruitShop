let gsiPromise = null;
let initializedClientId = null;
let pendingRequest = null;

const GSI_SRC = "https://accounts.google.com/gsi/client";
const clientIdFromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (clientIdFromEnv) {
    console.info("[GoogleIdentity] VITE_GOOGLE_CLIENT_ID:", clientIdFromEnv);
} else {
    console.warn("[GoogleIdentity] VITE_GOOGLE_CLIENT_ID chưa được cấu hình.");
}

const ensureWindow = () => {
    if (typeof window === "undefined") {
        throw new Error("Không thể khởi tạo Google trên server.");
    }
};

export const loadGoogleIdentity = () => {
    ensureWindow();
    if (window.google?.accounts?.id) {
        return Promise.resolve();
    }
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
        if (existing && existing.dataset.loaded === "1") {
            resolve();
            return;
        }
        const script = existing || document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        script.defer = true;
        script.dataset.loaded = "0";
        script.onload = () => {
            script.dataset.loaded = "1";
            resolve();
        };
        script.onerror = () => reject(new Error("Tải Google Identity Services thất bại."));
        if (!existing) document.head.appendChild(script);
    });
    return gsiPromise;
};

const ensureGoogleIdClient = (clientId) => {
    const google = window.google?.accounts?.id;
    if (!google) throw new Error("Không khởi tạo được Google ID.");
    if (initializedClientId === clientId) return google;

    google.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: false,
        use_fedcm_for_prompt: false,
        ux_mode: "popup",
        context: "signin",
        callback: (response) => {
            if (response?.credential) {
                pendingRequest?.resolve(response.credential);
            } else {
                const err = new Error("Không nhận được Google ID token.");
                err.code = "NO_CREDENTIAL";
                pendingRequest?.reject(err);
            }
            pendingRequest = null;
        },
    });

    initializedClientId = clientId;
    return google;
};

const explainPromptNotification = (notification) => {
    if (!notification) return "Không rõ nguyên nhân.";
    if (notification.getDismissedReason) {
        const dismissed = notification.getDismissedReason();
        if (dismissed) return dismissed;
    }
    if (notification.getNotDisplayedReason) {
        const reason = notification.getNotDisplayedReason();
        if (reason) return reason;
    }
    if (notification.getSkippedReason) {
        const skipped = notification.getSkippedReason();
        if (skipped) return skipped;
    }
    return "Không rõ nguyên nhân.";
};

export const requestGoogleIdToken = async ({ clientId }) => {
    if (!clientId) throw new Error("Thiếu GOOGLE_CLIENT_ID.");
    await loadGoogleIdentity();
    const google = ensureGoogleIdClient(clientId);

    return new Promise((resolve, reject) => {
        if (pendingRequest) {
            pendingRequest.reject(new Error("Đang xử lý Google Login khác. Vui lòng thử lại."));
        }
        pendingRequest = { resolve, reject };

        google.prompt((notification) => {
            if (!pendingRequest) return;
            if (notification?.isDismissedMoment?.()) {
                const reason = explainPromptNotification(notification);
                // Xử lý trường hợp user đóng popup
                if (reason === "suppressed_by_user" || reason.includes("suppressed")) {
                    pendingRequest.reject(new Error("Bạn đã hủy đăng nhập Google."));
                } else {
                    pendingRequest.reject(new Error(reason || "Người dùng đã đóng cửa sổ đăng nhập Google."));
                }
                pendingRequest = null;
            } else if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
                const reason = explainPromptNotification(notification);
                pendingRequest.reject(new Error(`Google không thể hiển thị cửa sổ đăng nhập (${reason}).`));
                pendingRequest = null;
            }
        });
    });
};
