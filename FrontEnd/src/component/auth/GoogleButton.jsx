import { useState } from "react";
import { requestGoogleIdToken } from "../../utils/googleIdentity";
import "./googleButton.scss";

const GoogleButton = ({
    label = "Đăng nhập với Google",
    clientId = "",
    disabled = false,
    onDone,
    onSuccess,
    onError,
}) => {
    const [loading, setLoading] = useState(false);
    const actionHandler = onSuccess || onDone;

    const handleClick = async () => {
        if (!clientId || disabled || loading) return;
        try {
            setLoading(true);
            const credential = await requestGoogleIdToken({ clientId });
            await actionHandler?.(credential);
        } catch (error) {
            console.error("Google sign-in error:", error);
            onError?.(error);
            alert(error?.message || "Đăng nhập Google thất bại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            className="login__google-btn"
            data-loading={loading ? "true" : "false"}
            onClick={handleClick}
            disabled={disabled || loading || !clientId}
        >
            <span className="login__google-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 48 48" focusable="false">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6 1.54 7.38 2.83l5.36-5.36C33.64 3.64 29.3 2 24 2 14.82 2 7.25 7.58 4.18 15.09l6.6 5.11C12.3 13.28 17.63 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.5 24c0-1.67-.15-3.29-.43-4.85H24v9.19h12.65c-.55 2.89-2.21 5.34-4.7 6.99l7.6 5.9C43.85 37.35 46.5 31.19 46.5 24z"></path>
                    <path fill="#FBBC05" d="M10.78 28.4a11.99 11.99 0 0 1 0-8.8l-6.6-5.11A21.92 21.92 0 0 0 2 24c0 3.53.85 6.87 2.37 9.8l6.41-5.4z"></path>
                    <path fill="#34A853" d="M24 46c5.73 0 10.53-1.89 14.04-5.15l-7.6-5.9c-2.07 1.4-4.74 2.24-6.44 2.24-5.01 0-9.26-3.29-10.78-7.84l-6.6 5.11C7.94 41.18 15.41 46 24 46z"></path>
                </svg>
            </span>
            <span>{loading ? "Đang xử lý..." : label}</span>
        </button>
    );
};

export default GoogleButton;
