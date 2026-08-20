import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, getStatusClass } from '../utils/helpers';
import '../assets/styles/ongoingorders.css';
import carousel6 from '../assets/styles/images/carousel6.png';
import paymongoLogo from '../assets/styles/images/paymongo.png';

function OngoingOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ id: null, type: null });
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderIdToPay, setSelectedOrderIdToPay] = useState(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
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

  const openFinalPaymentModal = (orderId) => {
    setSelectedOrderIdToPay(orderId);
    setShowPaymentModal(true);
  };

  const handleFinalPayment = async () => {
    if (!selectedOrderIdToPay) return;
    setIsSubmittingPayment(true);
    try {
      const response = await api.post('/payments/checkout-final', { order_id: selectedOrderIdToPay });
      if (response.data.success && response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      } else {
        setResultMessage(response.data.message || 'Failed to initiate payment.');
        setShowResultModal(true);
        setShowPaymentModal(false);
      }
    } catch (err) {
      console.error(err);
      setResultMessage(err.response?.data?.message || 'Error connecting to PayMongo.');
      setShowResultModal(true);
      setShowPaymentModal(false);
    } finally {
      setIsSubmittingPayment(false);
    }
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

  const generateReceipt = async (order) => {
    const doc = new jsPDF();
    
    let y = 40; // Default starting Y
    // Add header image
    try {
      const response = await fetch('/header.png');
      const blob = await response.blob();
      const reader = new FileReader();
      const base64data = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      
      const img = new Image();
      img.src = base64data;
      await new Promise(resolve => { img.onload = resolve; });
      
      const imgWidth = 180;
      const imgHeight = (img.height * imgWidth) / img.width;
      
      doc.addImage(base64data, 'PNG', 15, 10, imgWidth, imgHeight);
      y = 10 + imgHeight + 5; // Start text just below the image
    } catch (err) {
      console.warn("Could not load header image", err);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128); // gray
    doc.text('CLEANECO WASTE MANAGEMENT SERVICES', 15, y);
    
    y += 5;
    doc.setTextColor(13, 141, 30); // green
    doc.text('Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite', 15, y);
    y += 5;
    doc.text('Tel. Nos.: (046) 477-0354 • 09173044157', 15, y);
    y += 5;
    doc.text('E-mail: cleaneco@cwms.com.ph', 15, y);
    y += 5;
    doc.text('Website: www.cwms.com.ph', 15, y);

    y += 15;
    doc.setTextColor(0, 0, 0); // black
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    
    // Date
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Date: ${dateStr}`, 15, y);
    
    y += 10;
    doc.text('Cleaneco Management', 15, y);
    y += 5;
    doc.text('Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields', 15, y);
    y += 5;
    doc.text('Bacoor City, Cavite', 15, y);

    y += 15;
    doc.setFont('times', 'bold');
    const customerName = `${order.first_name || sessionStorage.getItem('userName')} ${order.last_name || ''}`.trim();
    doc.text(`ATTENTION: ${customerName}`, 15, y);

    y += 15;
    doc.setFontSize(12);
    doc.text('Official Receipt', 105, y, { align: 'center' });
    // Underline
    const titleWidth = doc.getTextWidth('Official Receipt');
    doc.setLineWidth(0.5);
    doc.line(105 - (titleWidth/2), y + 1, 105 + (titleWidth/2), y + 1);

    y += 15;
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text(`This receipt confirms the completion and payment for Order ID: ${order.order_id}.`, 15, y);
    y += 5;
    doc.text(`Service provided: ${order.service_name || order.service_type}`, 15, y);
    y += 5;
    doc.text(`Service date: ${formatDate(order.date)} at ${order.time_slot}`, 15, y);

    const basePrice = order.price ? parseFloat(order.price) : 0;
    const tax = order.tax_amount ? parseFloat(order.tax_amount) : (basePrice * 0.10);
    const total = basePrice + tax;

    autoTable(doc, {
      startY: y + 10,
      head: [['Description', 'Amount']],
      body: [
        ['Base Service Fee', `PHP ${basePrice.toFixed(2)}`],
        ['Service Tax (10%)', `PHP ${tax.toFixed(2)}`],
      ],
      foot: [['Total Paid', `PHP ${total.toFixed(2)}`]],
      theme: 'grid',
      headStyles: { fillColor: [13, 141, 30] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      margin: { left: 15, right: 15 }
    });

    const finalY = doc.lastAutoTable.finalY || y + 40;
    
    doc.setFont('times', 'normal');
    doc.text('Thank you very much!', 15, finalY + 15);

    doc.save(`Cleaneco_Receipt_${order.order_id}.pdf`);
  };

  const steps = [
    { title: "Approved Quotation – Approved P.O.", desc: "The client approves the quotation and issues a Purchase Order (P.O.), officially authorizing the work to proceed." },
    { title: "Set Schedule Date", desc: "Coordinate with the client to confirm the service date, time, site access requirements, and other logistical details." },
    { title: "Meeting for Operation", desc: "Conduct a coordination meeting to review the scope of work, assign responsibilities, discuss safety requirements, equipment, and project timeline." },
    { title: "Team Deployment on Site", desc: "Dispatch the assigned personnel, vehicles, equipment, and necessary materials to the project site as scheduled." },
    { title: "Pre-Operation", desc: "Perform site inspection, secure work permits (if required), conduct toolbox meeting, assess hazards, inspect equipment, and prepare the work area before starting the service." },
    { title: "Service Operation Flow", desc: "Execute the core tasks: siphoning, desludging, deep cleaning, or declogging according to the agreed method statement and industry standards." },
    { title: "Demobilization", desc: "Clean up the work area, secure all tools and equipment, manage collected waste according to environmental regulations, and formally turn over the site to the client." },
    { title: "Post-Operation", desc: "Conduct a final walkthrough with the client to verify completion, document the results, and obtain sign-off on the service provided." },
    { title: "Issuance of Billing / Service Report", desc: "Prepare and submit the detailed Service Report along with the Billing Statement or Invoice to the client for the completed works." },
    { title: "Client Payment", desc: "The client processes and remits the payment based on the submitted billing document, officially closing the transaction." }
  ];

  if (loading) {
    return (
      <div>
        <img src={carousel6} alt="Banner" className="banner-img" />
        <div className="container py-5 text-center">Loading your orders...</div>
      </div>
    );
  }

  return (
    <div className="bg-light" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      <img src={carousel6} alt="Banner" className="img-fluid banner-img w-100" />

      <div className="container py-5">
        <h3 className="fw-bold mb-4 text-success">My Ongoing Orders</h3>
        
        {orders.length === 0 ? (
          <div className="alert alert-info shadow-sm">No ongoing orders found.</div>
        ) : (
          <div className="accordion mb-5 shadow-sm" id="ordersAccordion" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
            {orders.map((order, index) => (
              <div className="accordion-item border-0 border-bottom" key={order.id}>
                <h2 className="accordion-header" id={`heading${order.id}`}>
                  <button 
                    className={`accordion-button ${index !== 0 ? 'collapsed' : ''} fw-bold`} 
                    type="button" 
                    data-bs-toggle="collapse" 
                    data-bs-target={`#collapse${order.id}`} 
                    aria-expanded={index === 0 ? "true" : "false"} 
                    aria-controls={`collapse${order.id}`}
                    style={{ backgroundColor: '#fff', color: '#333', padding: '1.5rem' }}
                  >
                    <div className="d-flex justify-content-between align-items-center w-100 me-3">
                      <div>
                        <span className="text-muted small d-block mb-1">Order #{order.order_id}</span>
                        <span className="fs-5 text-success fw-bold">{order.service_name || order.service_type}</span>
                      </div>
                      <div className="text-end">
                        <span className={`badge rounded-pill ${getStatusClass(order.status)} mb-1 d-block`} style={{ fontSize: '0.85rem' }}>
                          {order.status}
                        </span>
                        <span className="text-muted small fw-medium">{formatDate(order.date)}</span>
                      </div>
                    </div>
                  </button>
                </h2>
                <div 
                  id={`collapse${order.id}`} 
                  className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`} 
                  aria-labelledby={`heading${order.id}`} 
                  data-bs-parent="#ordersAccordion"
                >
                  <div className="accordion-body p-4 bg-light">
                    
                    {/* Progress Tracker */}
                    {order.status !== 'Cancelled' ? (
                      <div className="position-relative mx-2 my-4">
                        <div className="progress" style={{ height: '4px', position: 'absolute', top: '20px', left: '10%', right: '10%', zIndex: 1, backgroundColor: '#e9ecef' }}>
                          <div className="progress-bar bg-success" role="progressbar" style={{ width: order.status === 'Completed' ? '100%' : order.has_final_price ? '66%' : (order.confirmed_date && order.truck_team) ? '33%' : '0%' }}></div>
                        </div>
                        <div className="d-flex justify-content-between position-relative text-center" style={{ zIndex: 2 }}>
                          <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                            <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 ${order.status !== 'Pending' ? 'bg-success text-white shadow-sm' : 'bg-white border text-muted'}`} style={{ width: '40px', height: '40px' }}><i className="fas fa-check"></i></div>
                            <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>Reserved</small>
                          </div>
                          <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                            <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 ${(order.confirmed_date && order.truck_team) || order.has_final_price || order.status === 'Completed' ? 'bg-success text-white shadow-sm' : 'bg-white border text-muted'}`} style={{ width: '40px', height: '40px' }}><i className="fas fa-search"></i></div>
                            <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>For Inspection</small>
                          </div>
                          <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                            <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 ${order.has_final_price || order.status === 'Completed' ? 'bg-success text-white shadow-sm' : 'bg-white border text-muted'}`} style={{ width: '40px', height: '40px' }}><i className="fas fa-file-invoice-dollar"></i></div>
                            <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>Quoted</small>
                          </div>
                          <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                            <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 ${order.status === 'Completed' ? 'bg-success text-white shadow-sm' : 'bg-white border text-muted'}`} style={{ width: '40px', height: '40px' }}><i className="fas fa-flag-checkered"></i></div>
                            <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>Completed</small>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-danger text-center fw-bold shadow-sm mb-4"><i className="fas fa-ban me-2"></i>This order has been cancelled.</div>
                    )}
                    <hr className="my-4 border-secondary opacity-25" />

                    <div className="row mb-4">
                      <div className="col-md-6 mb-3 mb-md-0">
                        <p className="mb-1 text-muted small fw-bold text-uppercase tracking-wider">Pref. Schedule</p>
                        <p className="mb-0 fw-medium">{formatDate(order.date)} <br/> {order.time_slot}</p>
                      </div>
                      <div className="col-md-6">
                        <p className="mb-1 text-muted small fw-bold text-uppercase tracking-wider">Final Price Breakdown</p>
                        <p className="mb-0 fw-bold text-success fs-5">{order.has_final_price ? `Base Final Price: ₱${order.price}` : 'Pending Assessment'}</p>
                        {order.has_final_price && order.final_payment_status !== 'Paid' && order.status !== 'Completed' && order.status !== 'Cancelled' && (
                          <div className="mt-2 bg-white p-3 rounded shadow-sm border">
                            <div className="d-flex justify-content-between mb-1 small text-muted">
                              <span>Total with 10% Tax:</span>
                              <span className="fw-medium">₱{(parseFloat(order.price) * 1.1).toFixed(2)}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2 small text-muted border-bottom pb-2">
                              <span>Less Reservation Paid:</span>
                              <span className="text-danger fw-medium">-₱1100.00</span>
                            </div>
                            <div className="d-flex justify-content-between mb-3 fw-bold">
                              <span>Remaining Balance:</span>
                              <span className="text-success fs-6">₱{((parseFloat(order.price) * 1.1) - 1100).toFixed(2)}</span>
                            </div>
                            <button className="btn btn-success btn-sm fw-bold w-100 rounded-pill shadow-sm" onClick={() => openFinalPaymentModal(order.order_id)}>
                              <i className="fas fa-wallet me-2"></i>Pay Final Amount
                            </button>
                          </div>
                        )}
                        {order.final_payment_status === 'Paid' && (
                          <div className="mt-2">
                            <span className="badge bg-success rounded-pill px-3 py-2"><i className="fas fa-check-circle me-1"></i> Fully Paid</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 mb-4 rounded bg-white shadow-sm border">
                      <h6 className="fw-bold mb-3 text-success border-bottom pb-2 border-opacity-25">
                        <i className="fas fa-clipboard-check me-2"></i>Status & Updates
                      </h6>
                      
                      <div className="d-flex flex-column gap-2">
                        {order.truck_team ? (
                          <div className="d-flex align-items-center">
                            <i className="fas fa-truck text-success me-2" style={{ width: '20px' }}></i>
                            <span className="fw-medium">Assigned Team: {order.truck_team}</span>
                          </div>
                        ) : (
                          <div className="d-flex align-items-center text-muted">
                            <i className="fas fa-truck me-2" style={{ width: '20px' }}></i>
                            <span>No team assigned yet</span>
                          </div>
                        )}

                        {order.confirmed_date && order.confirmed_time_slot && (
                          <div className="d-flex align-items-center text-primary mt-2">
                            <i className="far fa-calendar-check me-2" style={{ width: '20px' }}></i>
                            <span className="fw-bold">Confirmed Schedule: {formatDate(order.confirmed_date)} ({order.confirmed_time_slot})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <h6 className="fw-bold mb-3">Documents</h6>
                    <div className="d-flex gap-2 flex-wrap mb-4">
                      {order.quotation_pdf_url ? (
                        <a href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${order.quotation_pdf_url}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary-solid rounded-pill shadow-sm">
                          <i className="fas fa-file-pdf me-1"></i>Approved P.O. / Quotation
                        </a>
                      ) : (
                        <span className="btn btn-sm btn-secondary-solid rounded-pill disabled shadow-sm" style={{ opacity: 0.5 }}>
                           <i className="fas fa-file-pdf me-1"></i>Approved P.O. (Pending)
                        </span>
                      )}
                      
                      {order.service_report_pdf_url ? (
                        <a href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${order.service_report_pdf_url}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-cleaneco rounded-pill shadow-sm">
                          <i className="fas fa-file-invoice me-1"></i>Service Report
                        </a>
                      ) : (
                         <span className="btn btn-sm btn-secondary rounded-pill disabled shadow-sm" style={{ opacity: 0.5, border: 'none' }}>
                           <i className="fas fa-file-invoice me-1"></i>Service Report (Pending)
                        </span>
                      )}
                    </div>

                    <div className="d-flex justify-content-end gap-2 border-top pt-3">
                      {order.status === 'Completed' ? (
                        <button className="btn btn-cleaneco rounded-pill fw-bold shadow-sm" onClick={() => generateReceipt(order)}>
                          <i className="fas fa-download me-1"></i> Download Receipt
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-warning-solid rounded-pill shadow-sm fw-bold" onClick={() => triggerRequest(order.id, 'Reschedule Requested')} disabled={!!order.request_type}>
                            Reschedule
                          </button>
                          <button className="btn btn-danger rounded-pill shadow-sm fw-bold" onClick={() => triggerRequest(order.id, 'Cancel Requested')} disabled={!!order.request_type}>
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                    {order.request_type && (
                      <div className="text-end mt-2 small fw-bold text-warning">{order.request_type} received.</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card shadow-sm border-0 mt-5" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
          <div className="card-header bg-white border-bottom p-4">
            <h4 className="mb-0 fw-bold"><i className="fas fa-info-circle text-primary me-2"></i>Service Operation Flow</h4>
            <p className="text-muted small mb-0 mt-1">Here is the standard flow of operations for our services.</p>
          </div>
          <div className="card-body p-4 bg-light">
            <div className="row">
              {steps.map((step, index) => (
                <div className="col-md-6 mb-4" key={index}>
                  <div className="d-flex align-items-start bg-white p-4 h-100 rounded shadow-sm border">
                    <div className="rounded-circle bg-success text-white d-flex justify-content-center align-items-center me-3 flex-shrink-0 fw-bold shadow-sm" style={{ width: '32px', height: '32px' }}>
                      {index + 1}
                    </div>
                    <div>
                      <h6 className="fw-bold mb-1">{step.title}</h6>
                      <p className="text-muted small mb-0">{step.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                <h5 className="modal-title text-white">Confirm Request</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowConfirmModal(false)}></button>
              </div>
              <div className="modal-body text-start mt-3 mb-3 p-4">
                <h6 className="fw-normal">Are you sure you want to request a <strong>{confirmData.type === 'Cancel Requested' ? 'cancellation' : 'reschedule'}</strong>?</h6>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-light rounded-pill px-4 fw-bold" onClick={() => setShowConfirmModal(false)}>
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
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0">
              <div className="modal-header border-0" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                <h5 className="modal-title text-white">Notification</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowResultModal(false)}></button>
              </div>
              <div className="modal-body text-center p-5">
                <i className={`fas ${resultMessage.includes('success') ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-danger'} mb-3`} style={{ fontSize: '3rem' }}></i>
                <h5 className="fw-bold">{resultMessage}</h5>
              </div>
              <div className="modal-footer border-0 justify-content-center">
                <button type="button" className="btn btn-success rounded-pill px-5 fw-bold shadow-sm" style={{ backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }} onClick={() => setShowResultModal(false)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Final Payment Modal */}
      {showPaymentModal && (
        <div className="modal-backdrop-custom d-flex justify-content-center align-items-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="bg-white p-4 rounded shadow-lg text-center" style={{ maxWidth: '400px', width: '90%' }}>
            <img src={paymongoLogo} alt="PayMongo" style={{ height: '40px', marginBottom: '1rem' }} />
            <h4 className="fw-bold mb-3">Secure Payment</h4>
            <p className="text-muted small mb-4">You will be securely redirected to PayMongo to complete your final balance. We accept GCash, Maya, GrabPay, and Credit/Debit Cards.</p>
            <div className="d-flex justify-content-center gap-2">
              <button className="btn btn-secondary rounded-pill px-4" onClick={() => setShowPaymentModal(false)} disabled={isSubmittingPayment}>Cancel</button>
              <button className="btn btn-success rounded-pill px-4 fw-bold" onClick={handleFinalPayment} disabled={isSubmittingPayment}>
                {isSubmittingPayment ? <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</> : 'Proceed to Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default OngoingOrders;