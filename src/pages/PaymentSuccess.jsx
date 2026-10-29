import React from 'react';
import { Link } from 'react-router-dom';

function PaymentSuccess() {
    return (
        <div className="container mt-5 pt-5 text-center" style={{ minHeight: '60vh' }}>
            <div className="card shadow-sm border-0 rounded-4 p-5 mx-auto" style={{ maxWidth: '500px' }}>
                <div className="mb-4 text-success">
                    <i className="fas fa-check-circle fa-5x"></i>
                </div>
                <h2 className="fw-bold mb-3">Payment Successful!</h2>
                <p className="text-muted mb-4">
                    Thank you for your payment. Your transaction was completed successfully. 
                    Your order is now being processed.
                </p>
                <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                    <Link to="/orders" className="btn btn-success rounded-pill px-4 py-2 fw-bold" style={{ backgroundColor: '#0D8D1E' }}>
                        View My Orders
                    </Link>
                    <Link to="/order" className="btn btn-outline-success rounded-pill px-4 py-2 fw-bold">
                        Book Another Service
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default PaymentSuccess;
