import React from 'react';
import { Link } from 'react-router-dom';

function PaymentCancel() {
    return (
        <div className="container mt-5 pt-5 text-center" style={{ minHeight: '60vh' }}>
            <div className="card shadow-sm border-0 rounded-4 p-5 mx-auto" style={{ maxWidth: '500px' }}>
                <div className="mb-4 text-danger">
                    <i className="fas fa-times-circle fa-5x"></i>
                </div>
                <h2 className="fw-bold mb-3">Payment Cancelled</h2>
                <p className="text-muted mb-4">
                    Your payment was cancelled or was not successful. No charges were made.
                    You can try again whenever you're ready.
                </p>
                <Link to="/orders" className="btn btn-success rounded-pill px-4 py-2 fw-bold">
                    View My Orders
                </Link>
            </div>
        </div>
    );
}

export default PaymentCancel;
