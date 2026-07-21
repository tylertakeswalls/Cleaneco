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
        >
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header" style={{ backgroundColor: headerColor, color: 'white' }}>
                        <h5 className="modal-title text-white">
                            {title}
                        </h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body text-start mt-3 mb-3">
                        <h6 className="fw-normal">{message}</h6>
                    </div>
                    <div className="modal-footer">
                        <button 
                            type="button" 
                            className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" 
                            style={{ backgroundColor: headerColor, borderColor: headerColor }} 
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
