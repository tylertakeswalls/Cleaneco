import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import carousel7 from '../assets/styles/images/carousell7.png';
import AlertModal from '../components/AlertModal';
import { useConfirm } from '../context/ConfirmContext';

function VerifyPayments() {
    const confirm = useConfirm();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Alert Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

    const showAlert = (title, message, type = 'info') => {
        setModalConfig({ isOpen: true, title, message, type });
    };

    const closeAlert = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const fetchPayments = async () => {
        try {
            const response = await api.get('/payments');
            setPayments(response.data.filter(p => p.status === 'Pending Verification'));
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, []);

    const handleVerify = async (paymentId, status) => {
        const isConfirmed = await confirm({
            title: `Confirm ${status}`,
            text: `Are you sure you want to mark this payment as ${status}?`,
            confirmLabel: status === 'Verified' ? 'Verify' : 'Reject',
            confirmVariant: status === 'Verified' ? 'success' : 'danger'
        });

        if (!isConfirmed) return;

        try {
            const res = await api.put(`/payments/${paymentId}/verify`, { status });
            if (res.data.success) {
                showAlert('Success', `Payment marked as ${status}`, 'success');
                fetchPayments(); // refresh list
            }
        } catch (error) {
            console.error('Error verifying payment:', error);
            showAlert('Error', 'Failed to update payment status.', 'error');
        }
    };

    if (loading) return (
        <div>
            <img className="img-fluid banner-img" src={carousel7} alt="Banner" />
            <div className="p-4 text-center">Loading pending payments...</div>
        </div>
    );

    return (
        <div>
            <AlertModal 
                isOpen={modalConfig.isOpen} 
                title={modalConfig.title} 
                message={modalConfig.message} 
                type={modalConfig.type} 
                onClose={closeAlert} 
            />
            <img className="img-fluid banner-img" src={carousel7} alt="Banner" />
            
            <section className="section-bg">
                <div className="table-box">
                    <h3 className="text-center mb-4 text-dark fw-bold">
                        Verify Payments
                    </h3>

                    {payments.length === 0 ? (
                    <div className="alert alert-info shadow-sm border-0">No pending payments to verify.</div>
                ) : (
                    <div className="table-responsive bg-white rounded shadow-sm">
                        <table className="table table-hover align-middle mb-0 text-center">
                            <thead className="table-light">
                                <tr>
                                    <th>Order ID</th>
                                    <th>Client Name</th>
                                    <th>Payment Type</th>
                                    <th>Amount</th>
                                    <th>Ref. Number</th>
                                    <th>Receipt</th>
                                    <th className="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(payment => (
                                    <tr key={payment._id}>
                                        <td><span className="fw-bold">{payment.order_id}</span></td>
                                        <td>{payment.client_name}</td>
                                        <td><span className="badge bg-secondary">{payment.payment_type}</span></td>
                                        <td className="fw-bold text-success">₱{payment.amount_paid?.toFixed(2)}</td>
                                        <td>{payment.reference_number || 'N/A'}</td>
                                        <td>
                                            <a href={`http://localhost:5000${payment.receipt_url}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary-solid rounded-pill fw-bold">
                                                <i className="fas fa-eye me-1"></i>View
                                            </a>
                                        </td>
                                        <td className="text-center">
                                            <button 
                                                className="btn btn-sm btn-success-solid rounded-pill fw-bold mx-2" 
                                                onClick={() => handleVerify(payment._id, 'Verified')}
                                            >
                                                <i className="fas fa-check me-1"></i>Verify
                                            </button>
                                            <button 
                                                className="btn btn-sm btn-danger rounded-pill fw-bold" 
                                                onClick={() => handleVerify(payment._id, 'Rejected')}
                                            >
                                                <i className="fas fa-times me-1"></i>Reject
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                </div>
            </section>
        </div>
    );
}

export default VerifyPayments;
