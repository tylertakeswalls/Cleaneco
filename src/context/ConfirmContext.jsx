import React, { createContext, useContext, useState, useCallback } from 'react';

const ConfirmContext = createContext();

export const useConfirm = () => {
    return useContext(ConfirmContext);
};

export const ConfirmProvider = ({ children }) => {
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: '',
        text: '',
        onConfirm: null,
        onCancel: null,
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        confirmVariant: 'danger' // primary, success, danger, etc.
    });

    const confirm = useCallback((options) => {
        return new Promise((resolve, reject) => {
            setConfirmState({
                isOpen: true,
                title: options.title || 'Are you sure?',
                text: options.text || '',
                confirmLabel: options.confirmLabel || 'Confirm',
                cancelLabel: options.cancelLabel || 'Cancel',
                confirmVariant: options.confirmVariant || 'danger',
                onConfirm: () => {
                    resolve(true);
                    setConfirmState(s => ({ ...s, isOpen: false }));
                },
                onCancel: () => {
                    resolve(false);
                    setConfirmState(s => ({ ...s, isOpen: false }));
                }
            });
        });
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}

            {/* Global Confirm Modal */}
            {confirmState.isOpen && (
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
                            <div className="modal-header" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                                <h5 className="modal-title text-white">{confirmState.title}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={confirmState.onCancel}></button>
                            </div>
                            <div className="modal-body text-start mt-3 mb-3">
                                <h6 className="fw-normal">{confirmState.text}</h6>
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary rounded-pill px-4" 
                                    onClick={confirmState.onCancel}
                                >
                                    {confirmState.cancelLabel}
                                </button>
                                <button 
                                    type="button" 
                                    className={`btn btn-${confirmState.confirmVariant} rounded-pill px-4 fw-bold shadow-sm`} 
                                    style={confirmState.confirmVariant === 'success' || confirmState.confirmVariant === 'danger' ? {} : { backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }}
                                    onClick={confirmState.onConfirm}
                                >
                                    {confirmState.confirmLabel}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
