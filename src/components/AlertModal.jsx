import React from 'react';

export default function AlertModal({ isOpen, title, message, type, onClose }) {
    if (!isOpen) return null;

    let headerColor = '#0D8D1E'; // Default Cleaneco Green
    let iconClass = 'fas fa-info-circle';

    if (type === 'error') {
        headerColor = '#dc3545'; // Danger Red
        iconClass = 'fas fa-exclamation-triangle';
    } else if (type === 'warning') {
        headerColor = '#ffc107'; // Warning Yellow
        iconClass = 'fas fa-exclamation-circle';
    } else if (type === 'success') {
        headerColor = '#0D8D1E'; // Success Green
        iconClass = 'fas fa-check-circle';
    }

    return (
        <div 
            className="modal fade show d-block" 
            style={{ 
                zIndex: 1060, 
                backgroundColor: 'transparent', 
                backdropFilter: 'blur(5px)', 
                WebkitBackdropFilter: 'blur(5px)' 
            }} 
            tabIndex="-1"
            role="dialog"
        >
            <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content shadow-lg border-0" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
                    <div className="modal-header" style={{ backgroundColor: headerColor, borderBottom: 'none' }}>
                        <h5 className="modal-title fw-bold text-white">
                            <i className={`${iconClass} me-2`}></i>{title}
                        </h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close"></button>
                    </div>
                    <div className="modal-body p-4 bg-light text-dark text-center" style={{ fontSize: '1.1rem' }}>
                        {message}
                    </div>
                    <div className="modal-footer bg-light d-flex justify-content-center" style={{ borderTop: 'none' }}>
                        <button 
                            type="button" 
                            className="btn text-white fw-bold px-4" 
                            style={{ backgroundColor: headerColor, borderRadius: '0.5rem' }} 
                            onClick={onClose}
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
