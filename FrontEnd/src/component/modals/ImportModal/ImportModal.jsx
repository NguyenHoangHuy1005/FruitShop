import { memo, useEffect } from "react";
import ImportForm from "./ImportForm";
import "./ImportModal.scss";

const ImportModal = memo(({
    isOpen,
    onClose,
    suppliers = [],
    productName = "",
    onSubmit,
    busy = false
}) => {
    // Quản lý việc ẩn thanh cuộn của body
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }

        // Cleanup khi component unmount
        return () => {
            document.body.classList.remove('modal-open');
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && !busy) {
            onClose();
        }
    };

    const handleSubmit = (formData) => {
        onSubmit(formData);
    };

    return (
        <div className="import-modal-overlay" onClick={handleBackdropClick}>
            <div className="import-modal-container">
                <div className="import-modal-content">
                    <button 
                        className="modal-close-btn" 
                        onClick={onClose}
                        disabled={busy}
                        type="button"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path 
                                d="M18 6L6 18M6 6L18 18" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                    
                    <ImportForm
                        suppliers={suppliers}
                        productName={productName}
                        onSubmit={handleSubmit}
                        onCancel={onClose}
                        busy={busy}
                    />
                </div>
            </div>
        </div>
    );
});

ImportModal.displayName = 'ImportModal';

export default ImportModal;
