import React from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText, confirmColor }) {
    if (!isOpen) return null;

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
                    <div className="modal-header" style={{ backgroundColor: confirmColor === 'secondary' ? '#6c757d' : '#dc3545', borderBottom: 'none' }}>
                        <h5 className="modal-title fw-bold text-white">
                            <i className="fas fa-exclamation-triangle me-2"></i>{title}
                        </h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onCancel} aria-label="Close"></button>
                    </div>
                    <div className="modal-body p-4 bg-light text-dark text-center" style={{ fontSize: '1.1rem' }}>
                        {message}
                    </div>
                    <div className="modal-footer bg-light d-flex justify-content-center gap-3" style={{ borderTop: 'none' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary fw-bold px-4" 
                            style={{ borderRadius: '0.5rem' }} 
                            onClick={onCancel}
                        >
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            className={`btn btn-${confirmColor || 'danger'} fw-bold px-4`} 
                            style={{ borderRadius: '0.5rem' }} 
                            onClick={onConfirm}
                        >
                            {confirmText || 'Delete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
