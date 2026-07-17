import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../assets/styles/ongoingorders.css';
import carousel6 from '../assets/styles/images/carousel6.png';

function OngoingOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ id: null, type: null });
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const navigate = useNavigate();
  const loggedInUser = sessionStorage.getItem("loggedInUser");
  const userId = sessionStorage.getItem("userId");

  const triggerRequest = (id, type) => {
    setConfirmData({ id, type });
    setShowConfirmModal(true);
  };

  const confirmRequest = async () => {
    setShowConfirmModal(false);
    const { id, type } = confirmData;
    try {
      const response = await api.put(`/orders/${id}`, {
        request_type: type
      });
      if (response.data.success) {
        setResultMessage("Request submitted successfully.");
        setShowResultModal(true);
        const ordersRes = await api.get(`/orders/user/${userId}`);
        setOrders(ordersRes.data);
      } else {
        setResultMessage("Failed to submit request.");
        setShowResultModal(true);
      }
    } catch (err) {
      console.error(err);
      setResultMessage("Error submitting request.");
      setShowResultModal(true);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      if (!isNaN(date)) {
        return date.toLocaleDateString('en-US');
      }
    } catch (e) {
      console.error("Date formatting error:", e);
    }

    return dateString;
  };

  useEffect(() => {
    if (!loggedInUser) {
      alert("Please log in to view your orders.");
      navigate('/login');
      return;
    }

    const loadOrders = async () => {
      try {
        const response = await api.get(`/orders/user/${userId}`);
        setOrders(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading orders:", err);
        setLoading(false);
      }
    };

    loadOrders();
  }, [loggedInUser, navigate, userId]);

  const getStatusClass = (status) => {
    const statusClasses = {
      "Completed": "completed-text",
      "In Progress": "in-progress-text",
      "Cancelled": "cancelled-text"
    };
    return statusClasses[status] || "pending-text";
  };

  const generateReceipt = (order) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(13, 141, 30);
    doc.text('Cleaneco', 105, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text('Official Receipt', 105, 30, { align: 'center' });

    // Order info
    doc.setFontSize(10);
    doc.text(`Order ID: ${order.order_id}`, 20, 50);
    doc.text(`Service: ${order.service_name || order.service_type}`, 20, 56);
    doc.text(`Date: ${formatDate(order.date)}`, 20, 62);
    doc.text(`Time Slot: ${order.time_slot}`, 20, 68);

    // Customer info
    doc.text(`Customer Info:`, 120, 50);
    doc.text(`${order.first_name || sessionStorage.getItem('userName')} ${order.last_name || ''}`, 120, 56);
    doc.text(`${order.email || ''}`, 120, 62);
    doc.text(`${order.phone || ''}`, 120, 68);

    const basePrice = order.price ? parseFloat(order.price) : 0;
    const tax = order.tax_amount ? parseFloat(order.tax_amount) : (basePrice * 0.10);
    const total = basePrice + tax;

    // Table
    autoTable(doc, {
      startY: 85,
      head: [['Description', 'Amount']],
      body: [
        ['Base Service Fee', `PHP ${basePrice.toFixed(2)}`],
        ['Service Tax (10%)', `PHP ${tax.toFixed(2)}`],
      ],
      foot: [['Total Paid', `PHP ${total.toFixed(2)}`]],
      theme: 'grid',
      headStyles: { fillColor: [13, 141, 30] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });

    // Footer
    doc.setFontSize(10);
    doc.text('Thank you for choosing Cleaneco!', 105, doc.lastAutoTable.finalY + 20, { align: 'center' });

    doc.save(`Cleaneco_Receipt_${order.order_id}.pdf`);
  };

  if (loading) {
    return (
      <div>
        <img src={carousel6} alt="Banner" className="banner-img" />
        <section>
          <div className="container table-box">
            <h3 className="text-center mb-3">My Ongoing Orders</h3>
            <div className="table-container">
              <table className="table table-bordered text-center">
                <thead className="thead-light">
                  <tr>
                    <th>Order ID</th>
                    <th>Service</th>
                    <th>Date</th>
                    <th>Time Slot</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th style={{ width: '140px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="6" className="text-center">Loading your orders...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <img src={carousel6} alt="Banner" className="banner-img" />

      <section>
        <div className="container table-box">
          <h3 className="text-center mb-3">My Ongoing Orders</h3>
          <div className="table-container">
            <table className="table table-bordered text-center">
              <thead className="thead-light">
                <tr>
                  <th>Order ID</th>
                  <th>Service</th>
                  <th>Date</th>
                  <th>Time Slot</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th style={{ width: '140px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center">No orders found.</td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.order_id}</td>
                      <td>{order.service_name || order.service_type}</td>
                      <td>{formatDate(order.date)}</td>
                      <td>{order.time_slot}</td>
                      <td className={getStatusClass(order.status)}>
                        {order.status}
                        {order.request_type && (
                          <div className="small text-warning fw-bold mt-1">{order.request_type}</div>
                        )}
                        {order.approval_fee > 0 && (
                          <div className="small text-danger fw-bold mt-1">Fee: ₱{parseFloat(order.approval_fee).toFixed(2)}</div>
                        )}
                      </td>
                      <td>{order.price ? '₱' + order.price : 'Pending'}</td>
                      <td>
                        {order.status === 'Completed' ? (
                          <button
                            className="btn btn-sm btn-success shadow-sm rounded-pill fw-bold"
                            style={{ backgroundColor: '#0D8D1E' }}
                            onClick={() => generateReceipt(order)}
                          >
                            <i className="fas fa-print me-1"></i> Receipt
                          </button>
                        ) : order.status === 'Pending' || order.status === 'In Progress' ? (
                          <div className="d-flex flex-column gap-1">
                            <button
                              className="btn btn-sm btn-outline-warning rounded-pill"
                              onClick={() => triggerRequest(order.id, 'Reschedule Requested')}
                              disabled={!!order.request_type}
                            >
                              Reschedule
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger rounded-pill"
                              onClick={() => triggerRequest(order.id, 'Cancel Requested')}
                              disabled={!!order.request_type}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted"><small>N/A</small></span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                <h5 className="modal-title text-white">Confirm Request</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowConfirmModal(false)}></button>
              </div>
              <div className="modal-body text-start mt-3 mb-3">
                <h6 className="fw-normal">Are you sure you want to request a <strong>{confirmData.type === 'Cancel Requested' ? 'cancellation' : 'reschedule'}</strong>?</h6>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setShowConfirmModal(false)}>
                  Close
                </button>
                <button type="button" className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" style={{ backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }} onClick={confirmRequest}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Notification Modal */}
      {showResultModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                <h5 className="modal-title text-white">Notification</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowResultModal(false)}></button>
              </div>
              <div className="modal-body text-start mt-3 mb-3">
                <h6 className="fw-normal">{resultMessage}</h6>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" style={{ backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }} onClick={() => setShowResultModal(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OngoingOrders;