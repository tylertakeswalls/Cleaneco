import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { formatDate, getStatusClass, formatCurrency } from '../utils/helpers';
import '../assets/styles/ongoingorders.css';
import carousel6 from '../assets/styles/images/carousel6.png';
import paymongoLogo from '../assets/styles/images/paymongo.png';
import ReceiptTemplate from '../components/ReceiptTemplate';
import ClientCalendar from '../components/ClientCalendar';
import BillingTemplate from '../components/BillingTemplate';
import { buildOrderServiceBreakdowns, groupOrdersByOrderId } from '../utils/pricing';

function OngoingOrders() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [servicesCatalog, setServicesCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedOrderId, setHighlightedOrderId] = useState(null);
  const [selectedBillingOrder, setSelectedBillingOrder] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState({ id: null, type: null });
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [resultType, setResultType] = useState('success');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReservationPaymentModal, setShowReservationPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('paymongo');
  const [chequeFile, setChequeFile] = useState(null);
  const [chequeDetails, setChequeDetails] = useState({
    bankName: '',
    chequeNumber: '',
    accountName: ''
  });
  const [clientType, setClientType] = useState('residential');

  const [selectedOrderIdToPay, setSelectedOrderIdToPay] = useState(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTimeSlot, setServiceTimeSlot] = useState('');
  const [isSubmittingDate, setIsSubmittingDate] = useState(false);
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const navigate = useNavigate();
  const loggedInUser = sessionStorage.getItem("loggedInUser");
  const userId = sessionStorage.getItem("userId");

  const triggerRequest = (id, type, target = 'inspection') => {
    const targetOrder = orders.find(o => o.id === id || o.first_id === id);
    setConfirmData({ id, type, target, order: targetOrder });
    if (type === 'Reschedule Requested') {
      setRescheduleDate('');
      setRescheduleTimeSlot('');
      setRescheduleReason('');
    }
    setShowConfirmModal(true);
  };

  const confirmRequest = async () => {
    if (confirmData.type === 'Reschedule Requested') {
      if (!rescheduleDate || !rescheduleTimeSlot || !rescheduleReason.trim()) {
        setResultMessage("Please select a date, time slot, and provide a reason for the reschedule.");
        setShowResultModal(true);
        return;
      }
    }
    setShowConfirmModal(false);
    const { id, type, target } = confirmData;
    try {
      const payload = { request_type: type, reschedule_target: target };
      if (type === 'Reschedule Requested') {
        payload.reschedule_date = rescheduleDate;
        payload.reschedule_time_slot = rescheduleTimeSlot;
        payload.reschedule_reason = rescheduleReason;
      }
      const response = await api.put(`/orders/${id}`, payload);
      if (response.data.success) {
        setResultMessage("Reschedule request submitted successfully. Our team will review and confirm your new schedule.");
        setShowResultModal(true);
        const ordersRes = await api.get(`/orders/user/${userId}`);
        setOrders(groupOrdersByOrderId(ordersRes.data).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } else {
        setResultMessage(response.data.message || "Failed to submit request.");
        setShowResultModal(true);
      }
    } catch (err) {
      console.error(err);
      setResultMessage(err.response?.data?.message || "Error submitting request.");
      setShowResultModal(true);
    }
  };

  const openFinalPaymentModal = (orderId) => {
    setPaymentMethod('paymongo');
    setChequeFile(null);
    setChequeDetails({ bankName: '', chequeNumber: '', accountName: '' });
    setSelectedOrderIdToPay(orderId);
    setShowPaymentModal(true);
  };

  const handleFinalPayment = async () => {
    if (!selectedOrderIdToPay) return;
    setIsSubmittingPayment(true);
    try {
      if (paymentMethod === 'paymongo') {
        const response = await api.post('/payments/checkout-final', { order_id: selectedOrderIdToPay });
        if (response.data.success && response.data.checkout_url) {
          window.location.href = response.data.checkout_url;
        } else {
          setResultMessage(response.data.message || 'Failed to initiate payment.');
          setShowResultModal(true);
          setShowPaymentModal(false);
        }
      } else if (paymentMethod === 'cheque') {
        if (!chequeFile || !chequeDetails.bankName || !chequeDetails.chequeNumber || !chequeDetails.accountName) {
          setResultMessage("Please fill all cheque details and upload a photo.");
          setShowResultModal(true);
          setIsSubmittingPayment(false);
          return;
        }

        const formData = new FormData();
        formData.append('cheque_image', chequeFile);
        formData.append('cheque_payer_name', chequeDetails.accountName);
        formData.append('cheque_number', chequeDetails.chequeNumber);
        formData.append('cheque_date', new Date().toISOString().split('T')[0]);
        formData.append('cheque_issuing_bank', chequeDetails.bankName);

        const response = await api.post(`/orders/${selectedOrderIdToPay}/pay-cheque-final`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.success) {
          setResultMessage(response.data.message);
          setResultType('success');
          setShowResultModal(true);
          setShowPaymentModal(false);
          const ordersRes = await api.get(`/orders/user/${userId}`);
          setOrders(groupOrdersByOrderId(ordersRes.data).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } else {
          setResultMessage(response.data.message || 'Failed to submit final cheque.');
          setResultType('error');
          setShowResultModal(true);
        }
      }
    } catch (err) {
      console.error(err);
      setResultMessage(err.response?.data?.message || 'Error processing payment.');
      setResultType('error');
      setShowResultModal(true);
      setShowPaymentModal(false);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const openReservationPaymentModal = (orderId) => {
    setSelectedOrderIdToPay(orderId);
    setPaymentMethod('paymongo');
    setChequeFile(null);
    setChequeDetails({ bankName: '', chequeNumber: '', accountName: '' });
    setShowReservationPaymentModal(true);
  };

  const handleReservationPayment = async () => {
    if (!selectedOrderIdToPay) return;
    setIsSubmittingPayment(true);

    try {
      if (paymentMethod === 'paymongo') {
        const response = await api.post('/payments/checkout-reservation', { order_id: selectedOrderIdToPay });
        if (response.data.success && response.data.checkout_url) {
          window.location.href = response.data.checkout_url;
        } else {
          setResultMessage(response.data.message || 'Failed to initiate payment.');
          setShowResultModal(true);
        }
      } else if (paymentMethod === 'cheque') {
        if (!chequeFile || !chequeDetails.bankName || !chequeDetails.chequeNumber || !chequeDetails.accountName) {
          setResultMessage("Please fill all cheque details and upload a photo.");
          setShowResultModal(true);
          setIsSubmittingPayment(false);
          return;
        }

        const formData = new FormData();
        formData.append('cheque_image', chequeFile);
        formData.append('cheque_payer_name', chequeDetails.accountName);
        formData.append('cheque_number', chequeDetails.chequeNumber);
        formData.append('cheque_date', new Date().toISOString().split('T')[0]);
        formData.append('cheque_issuing_bank', chequeDetails.bankName);

        const response = await api.post(`/orders/${selectedOrderIdToPay}/pay-cheque`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.success) {
          setResultMessage(response.data.message);
          setResultType('success');
          setShowResultModal(true);
          setShowReservationPaymentModal(false);
          const ordersRes = await api.get(`/orders/user/${userId}`);
          setOrders(groupOrdersByOrderId(ordersRes.data).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } else {
          setResultMessage(response.data.message || 'Failed to submit cheque.');
          setResultType('error');
          setShowResultModal(true);
        }
      }
    } catch (err) {
      console.error(err);
      setResultMessage(err.response?.data?.message || 'Error processing payment.');
      setResultType('error');
      setShowResultModal(true);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleQuotationResponse = async (orderId, responseType) => {
    setIsSubmittingResponse(true);
    try {
      const response = await api.post(`/orders/${orderId}/quotation/respond`, { response: responseType });
      if (response.data.success) {
        setResultMessage(response.data.message || 'Quotation response submitted successfully.');
        setResultType('success');
        setShowResultModal(true);
        const ordersRes = await api.get(`/orders/user/${userId}`);
        setOrders(groupOrdersByOrderId(ordersRes.data).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } else {
        setResultMessage(response.data.message || 'Failed to submit response.');
        setResultType('error');
        setShowResultModal(true);
      }
    } catch (err) {
      console.error(err);
      setResultMessage(err.response?.data?.message || 'Error processing response.');
      setResultType('error');
      setShowResultModal(true);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const handleSetServiceDate = async (orderId) => {
    if (!serviceDate || !serviceTimeSlot) {
      setResultMessage("Please select both a date and a time slot.");
      setShowResultModal(true);
      return;
    }
    setIsSubmittingDate(true);
    try {
      const response = await api.post(`/orders/${orderId}/service-date`, {
        service_execution_date: serviceDate,
        service_execution_time_slot: serviceTimeSlot
      });
      if (response.data.success) {
        setResultMessage(response.data.message);
        setResultType('success');
        setShowResultModal(true);
        const ordersRes = await api.get(`/orders/user/${userId}`);
        setOrders(groupOrdersByOrderId(ordersRes.data).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        setServiceDate('');
        setServiceTimeSlot('');
      } else {
        setResultMessage(response.data.message || 'Failed to set date.');
        setResultType('error');
        setShowResultModal(true);
      }
    } catch (err) {
      console.error(err);
      setResultMessage(err.response?.data?.message || 'Error setting date.');
      setResultType('error');
      setShowResultModal(true);
    } finally {
      setIsSubmittingDate(false);
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
        const [ordersRes, userRes, servicesRes] = await Promise.all([
          api.get(`/orders/user/${userId}`),
          api.get(`/users/${userId}`),
          api.get('/services').catch(() => ({ data: [] }))
        ]);

        if (Array.isArray(servicesRes.data)) {
          setServicesCatalog(servicesRes.data);
        }

        const grouped = {};
        ordersRes.data.forEach(order => {
          if (!grouped[order.order_id]) {
            grouped[order.order_id] = {
              ...order,
              services: [order],
              service_names: []
            };
          } else {
            grouped[order.order_id].services.push(order);
          }
          grouped[order.order_id].service_names.push(order.service_name || order.service_type);
        });

        void grouped;

        setOrders(groupOrdersByOrderId(ordersRes.data).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));

        if (userRes.data && userRes.data.clientType) {
          setClientType(userRes.data.clientType);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setLoading(false);
      }
    };

    loadOrders();
  }, [loggedInUser, navigate, userId]);

  // Auto-expand and scroll to target order when redirected from a notification
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetOrderId = params.get('orderId');
    if (targetOrderId && orders.length > 0) {
      setHighlightedOrderId(targetOrderId);
      setTimeout(() => {
        const el = document.getElementById(`order-card-${targetOrderId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
    }
  }, [location.search, orders]);

  useEffect(() => {
    if (showConfirmModal || showResultModal || showPaymentModal || showReservationPaymentModal) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = 'auto';
    };
  }, [showConfirmModal, showResultModal, showPaymentModal, showReservationPaymentModal]);

  const generateReceipt = (order) => {
    setReceiptOrder(order);
    setTimeout(() => {
      window.print();
      setReceiptOrder(null);
    }, 1000);
  };

  const generateBilling = (order) => {
    setSelectedBillingOrder(order);
    setTimeout(() => {
      window.print();
      setSelectedBillingOrder(null);
    }, 1000);
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
      <div className="d-print-none">
        <img src={carousel6} alt="Banner" className="img-fluid banner-img w-100" />

      <div className="container py-5">
        <h3 className="fw-bold mb-4 text-success">My Ongoing Orders</h3>

        {orders.length === 0 ? (
          <div className="alert alert-info shadow-sm">No ongoing orders found.</div>
        ) : (
          <div className="accordion mb-5 shadow-sm" id="ordersAccordion" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
            {orders.map((order, index) => {
              const isTarget = highlightedOrderId === order.order_id;
              const isDefaultExpanded = !highlightedOrderId && index === 0;
              const isExpanded = isTarget || isDefaultExpanded;

              return (
                <div 
                  className={`accordion-item border-0 border-bottom ${isTarget ? 'border border-2 border-success shadow-sm' : ''}`} 
                  id={`order-card-${order.order_id}`}
                  key={order.id}
                  style={{ transition: 'all 0.3s ease' }}
                >
                  <h2 className="accordion-header" id={`heading${order.id}`}>
                    <button
                      className={`accordion-button ${!isExpanded ? 'collapsed' : ''} fw-bold`}
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#collapse${order.id}`}
                      aria-expanded={isExpanded ? "true" : "false"}
                      aria-controls={`collapse${order.id}`}
                      style={{ backgroundColor: isTarget ? '#F0FDF4' : '#fff', color: '#333', padding: '1.5rem' }}
                    >
                      <div className="d-flex justify-content-between align-items-center w-100 me-3">
                        <div>
                          <span className="text-muted small d-block mb-1">
                            Order #{order.order_id}
                            {isTarget && <span className="badge bg-success ms-2 small">Selected Order</span>}
                          </span>
                          {(() => {
                            const servicesList = (order.service_names && order.service_names.length > 0)
                              ? order.service_names
                              : [order.service_name || order.service_type].filter(Boolean);

                            return (
                              <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
                                {servicesList.map((sName, sIdx) => (
                                  <span 
                                    key={sIdx} 
                                    className="badge px-3 py-2 rounded-pill fw-bold shadow-sm" 
                                    style={{ 
                                      backgroundColor: '#f0fdf4', 
                                      color: '#0D8D1E', 
                                      border: '1.5px solid #86efac',
                                      fontSize: '0.9rem'
                                    }}
                                  >
                                    <i className="fas fa-check-circle me-1 text-success"></i>
                                    {sName}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
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
                    className={`accordion-collapse collapse ${isExpanded ? 'show' : ''}`}
                    aria-labelledby={`heading${order.id}`}
                    data-bs-parent="#ordersAccordion"
                  >
                  <div className="accordion-body p-4 bg-light">

                    {/* Progress Tracker */}
                    {(() => {
                      if (order.status === 'Cancelled') {
                        return (
                          <div className="alert alert-danger text-center fw-bold shadow-sm mb-4">
                            <i className="fas fa-ban me-2"></i>This order has been cancelled.
                          </div>
                        );
                      }
                      if (order.status === 'Pending') {
                        return null;
                      }

                      const isCompleted = order.status === 'Completed';
                      const isServiceExecution = Boolean(order.service_execution_date || isCompleted);
                      const isQuoted = Boolean(order.has_final_price || isServiceExecution);
                      const isInspection = Boolean(order.confirmed_date || isQuoted);

                      const progressWidth = isCompleted 
                        ? '100%' 
                        : isServiceExecution 
                          ? '75%' 
                          : isQuoted 
                            ? '50%' 
                            : isInspection 
                              ? '25%' 
                              : '0%';

                      return (
                        <div className="position-relative mx-2 my-4">
                          <div className="progress" style={{ height: '4px', position: 'absolute', top: '20px', left: '10%', right: '10%', zIndex: 1, backgroundColor: '#e9ecef' }}>
                            <div className="progress-bar bg-success" role="progressbar" style={{ width: progressWidth, transition: 'width 0.4s ease' }}></div>
                          </div>
                          <div className="d-flex justify-content-between position-relative text-center" style={{ zIndex: 2 }}>
                            {/* 1. Reserved */}
                            <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                              <div className="rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 bg-success text-white shadow-sm" style={{ width: '40px', height: '40px' }}>
                                <i className="fas fa-check"></i>
                              </div>
                              <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>Reserved</small>
                            </div>

                            {/* 2. For Inspection */}
                            <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                              <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 ${isInspection ? 'bg-success text-white shadow-sm' : 'bg-white border text-muted'}`} style={{ width: '40px', height: '40px' }}>
                                <i className="fas fa-search"></i>
                              </div>
                              <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>For Inspection</small>
                            </div>

                            {/* 3. Quoted */}
                            <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                              <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 ${isQuoted ? 'bg-success text-white shadow-sm' : 'bg-white border text-muted'}`} style={{ width: '40px', height: '40px' }}>
                                <i className="fas fa-file-invoice-dollar"></i>
                              </div>
                              <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>Quoted</small>
                            </div>

                            {/* 4. For Service Execution */}
                            <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                              <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 ${isServiceExecution ? 'bg-success text-white shadow-sm' : 'bg-white border text-muted'}`} style={{ width: '40px', height: '40px' }}>
                                <i className="fas fa-truck"></i>
                              </div>
                              <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>For Service Execution</small>
                            </div>

                            {/* 5. Completed */}
                            <div className="d-flex flex-column align-items-center" style={{ flex: '1' }}>
                              <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 flex-shrink-0 ${isCompleted ? 'bg-success text-white shadow-sm' : 'bg-white border text-muted'}`} style={{ width: '40px', height: '40px' }}>
                                <i className="fas fa-flag-checkered"></i>
                              </div>
                              <small className="fw-bold px-1" style={{ fontSize: '0.75rem', lineHeight: '1.2' }}>Completed</small>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <hr className="my-4 border-secondary opacity-25" />

                    <div className="row mb-4">
                      <div className="col-md-6 mb-3 mb-md-0">
                        <p className="mb-1 text-muted small fw-bold text-uppercase tracking-wider">Pref. Schedule</p>
                        <p className="mb-0 fw-medium">{formatDate(order.date)} <br /> {order.time_slot}</p>
                      </div>
                      <div className="col-md-6">
                        <p className="mb-1 text-muted small fw-bold text-uppercase tracking-wider">Final Price Breakdown</p>
                        {order.has_final_price ? (() => {
                          const basePrice = parseFloat(order.final_price) || 0;
                          const taxAmount = basePrice * 0.10;
                          const totalWithTax = basePrice * 1.10;
                          const reservationFee = 1100;
                          const remainingBalance = Math.max(0, totalWithTax - reservationFee);

                          return (
                            <div>
                              <p className="mb-2 fw-bold text-success fs-5">
                                {formatCurrency(remainingBalance)} <span className="text-muted fs-6 fw-normal">(Balance Due)</span>
                              </p>

                              <div className="mt-2 bg-white p-3 rounded shadow-sm border">
                                <div className="d-flex justify-content-between mb-1 small text-muted">
                                  <span>Quotation Base Total:</span>
                                  <span className="fw-semibold text-dark">{formatCurrency(basePrice)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-1 small text-muted">
                                  <span>Value-Added Tax (10%):</span>
                                  <span className="fw-semibold text-dark">+{formatCurrency(taxAmount)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-1 small text-muted">
                                  <span>Total with 10% Tax:</span>
                                  <span className="fw-semibold text-dark">{formatCurrency(totalWithTax)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2 small text-muted border-bottom pb-2">
                                  <span>Less Reservation Paid:</span>
                                  <span className="text-danger fw-semibold">-{formatCurrency(reservationFee)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-0 fw-bold">
                                  <span className="text-dark">Remaining Balance:</span>
                                  <span className="text-success fs-6">{formatCurrency(remainingBalance)}</span>
                                </div>

                                {order.final_payment_status === 'Paid' ? (
                                  <div className="mt-3 badge bg-success w-100 py-2 fs-6">
                                    <i className="fas fa-check-circle me-1"></i>Final Payment Paid
                                  </div>
                                ) : order.status === 'Completed' && order.status !== 'Cancelled' ? (
                                  !(order.payment_method === 'cheque' && order.cheque_status === 'pending_verification') && (
                                    <button className="btn btn-success btn-sm fw-bold w-100 rounded-pill shadow-sm mt-3" onClick={() => openFinalPaymentModal(order.order_id)}>
                                      <i className="fas fa-wallet me-2"></i>Pay Final Amount ({formatCurrency(remainingBalance)})
                                    </button>
                                  )
                                ) : (
                                  <div className="mt-2 text-muted small fst-italic text-center" style={{ fontSize: '0.78rem' }}>
                                    Final payment of {formatCurrency(remainingBalance)} is payable upon service completion.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })() : (
                          <p className="mb-0 fw-bold text-muted fs-6">Pending Assessment</p>
                        )}
                        {(order.status === 'Pending' || order.status === 'Completed') && order.payment_method === 'cheque' && (order.cheque_status === 'pending_verification' || !order.cheque_status) ? (
                          <div className="mt-2 bg-info bg-opacity-10 p-3 rounded shadow-sm border border-info border-opacity-50">
                            <div className="d-flex align-items-center mb-2 text-info fw-bold">
                              <i className="fas fa-clock me-2"></i>
                              <span>Payment Verification</span>
                            </div>
                            <p className="small text-muted mb-0">Your cheque payment is currently being reviewed by our admin team. Please wait for verification.</p>
                          </div>
                        ) : (order.status === 'Pending' || order.status === 'Completed') && order.payment_method === 'cheque' && order.cheque_status === 'rejected' ? (
                          <div className="mt-2 bg-danger bg-opacity-10 p-3 rounded shadow-sm border border-danger border-opacity-50">
                            <div className="d-flex align-items-center mb-2 text-danger fw-bold">
                              <i className="fas fa-times-circle me-2"></i>
                              <span>Cheque Rejected</span>
                            </div>
                            <p className="small text-muted mb-3">Your cheque payment was rejected. Please review your details and submit a new payment to proceed.</p>
                            <button
                              className="btn btn-warning fw-bold w-100 rounded-pill shadow-sm text-dark"
                              onClick={() => order.status === 'Completed' ? openFinalPaymentModal(order.order_id) : openReservationPaymentModal(order.order_id)}
                              disabled={isSubmittingPayment}
                            >
                              <i className="fas fa-wallet me-2"></i>
                              {isSubmittingPayment ? 'Processing...' : 'Retry Payment'}
                            </button>
                          </div>
                        ) : order.status === 'Pending' && (
                          <div className="mt-2 bg-warning bg-opacity-10 p-3 rounded shadow-sm border border-warning border-opacity-50">
                            <div className="d-flex align-items-center mb-2 text-warning fw-bold" style={{ color: '#d97706' }}>
                              <i className="fas fa-exclamation-triangle me-2"></i>
                              <span>Awaiting Payment</span>
                            </div>
                            <p className="small text-muted mb-3">Please pay the reservation fee to confirm your booking and proceed.</p>
                            <button
                              className="btn btn-warning fw-bold w-100 rounded-pill shadow-sm text-dark"
                              onClick={() => openReservationPaymentModal(order.order_id)}
                              disabled={isSubmittingPayment}
                            >
                              <i className="fas fa-wallet me-2"></i>
                              {isSubmittingPayment ? 'Processing...' : 'Pay ₱1100.00 Reservation'}
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

                    {/* Participating Households (Residential Group Booking) */}
                    {order.households && order.households.length > 0 && (
                      <div className="p-4 mb-4 rounded bg-white shadow-sm border border-success">
                        <h6 className="fw-bold mb-3 text-success border-bottom pb-2 border-opacity-25">
                          <i className="fas fa-users me-2"></i>Participating Households ({order.num_households || order.households.length})
                        </h6>
                        <div 
                          className="table-responsive bg-white" 
                          style={{ 
                            borderRadius: '8px', 
                            border: '1px solid #dee2e6', 
                            overflow: 'hidden' 
                          }}
                        >
                          <table 
                            className="table table-sm table-hover mb-0 small" 
                            style={{ 
                              borderCollapse: 'separate', 
                              borderSpacing: 0, 
                              width: '100%',
                              marginBottom: 0
                            }}
                          >
                            <thead className="table-light">
                              <tr>
                                <th style={{ width: '40px', borderTopLeftRadius: '7px', borderBottom: '1px solid #dee2e6', borderTop: 'none', borderLeft: 'none' }} className="px-3 py-2">#</th>
                                <th style={{ borderBottom: '1px solid #dee2e6', borderTop: 'none' }} className="py-2">Household Contact / Name</th>
                                <th style={{ borderTopRightRadius: '7px', borderBottom: '1px solid #dee2e6', borderTop: 'none', borderRight: 'none' }} className="py-2">Address</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.households.map((h, i) => {
                                const isLast = i === order.households.length - 1;
                                return (
                                  <tr key={i}>
                                    <td 
                                      className="fw-bold px-3 py-2" 
                                      style={{ 
                                        borderBottom: isLast ? 'none' : '1px solid #dee2e6',
                                        borderBottomLeftRadius: isLast ? '7px' : 0,
                                        borderLeft: 'none'
                                      }}
                                    >
                                      {i + 1}
                                    </td>
                                    <td 
                                      className="py-2" 
                                      style={{ borderBottom: isLast ? 'none' : '1px solid #dee2e6' }}
                                    >
                                      <span className="fw-semibold text-dark">{h.name}</span>
                                      {i === 0 && <span className="badge bg-success ms-2">Lead Contact</span>}
                                    </td>
                                    <td 
                                      className="py-2 text-secondary" 
                                      style={{ 
                                        borderBottom: isLast ? 'none' : '1px solid #dee2e6',
                                        borderBottomRightRadius: isLast ? '7px' : 0,
                                        borderRight: 'none'
                                      }}
                                    >
                                      {h.address}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Quotation Review & Scheduling Block */}
                    {order.quotation_status !== 'Pending Inspection' && (
                      <div className="p-4 mb-4 rounded bg-white shadow-sm border border-success">
                        <h6 className="fw-bold mb-3 text-success border-bottom pb-2 border-opacity-25">
                          <i className="fas fa-file-invoice-dollar me-2"></i>Inspection Findings & Quotation
                        </h6>
                        <div className="mb-4">
                          {(() => {
                            const sections = buildOrderServiceBreakdowns(order, servicesCatalog);
                            return sections.map((section, sIdx) => (
                              <div key={section.serviceId || sIdx} className="mb-3 p-3 bg-light rounded border">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2 pb-2 border-bottom">
                                  <div>
                                    <h6 className="fw-bold text-dark mb-0">
                                      Service Configuration: {section.serviceName}
                                    </h6>
                                    {section.baseRate > 0 && (
                                      <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                                        Base Unit Rate: {formatCurrency(section.baseRate)}
                                      </small>
                                    )}
                                  </div>
                                  {sections.length > 1 && (
                                    <span className="badge bg-white text-dark border px-2 py-1">
                                      Service Subtotal: {formatCurrency(section.subtotal)}
                                    </span>
                                  )}
                                </div>
                                <ul className="list-unstyled mb-0 ms-2 mt-2">
                                  {section.items.map((item, iIdx) => {
                                    const isLastItem = iIdx === section.items.length - 1;
                                    return (
                                      <li key={item.key || iIdx} className={`small ${isLastItem ? 'mb-0' : 'mb-2 border-bottom pb-2 border-secondary border-opacity-10'}`}>
                                        <div className="d-flex justify-content-between align-items-start gap-3">
                                          <div>
                                            <div>
                                              <span className="fw-bold text-muted">{item.label}:</span>{' '}
                                              <span className="fw-semibold text-dark">{item.displayValue}</span>
                                            </div>
                                            {item.formulaNote && (
                                              <div className="text-muted" style={{ fontSize: '0.76rem' }}>
                                                {item.formulaNote.replace(/PHP /g, '₱')}
                                              </div>
                                            )}
                                            {item.justification && (
                                              <div className="text-secondary mt-1" style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>
                                                Note: {item.justification}
                                              </div>
                                            )}
                                          </div>
                                          <span className={`fw-bold text-nowrap ${item.amount === 0 ? 'text-muted' : 'text-dark'}`}>
                                            {formatCurrency(item.amount)}
                                          </span>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ));
                          })()}

                          {(() => {
                            const basePrice = parseFloat(order.final_price) || 0;
                            const originalPrice = parseFloat(order.price) || basePrice;
                            const discount = parseFloat(order.discount_amount) || 0;
                            const taxAmount = basePrice * 0.10;
                            const totalWithTax = basePrice * 1.10;
                            const reservationFee = 1100;
                            const finalPayable = Math.max(0, totalWithTax - reservationFee);

                            return (
                              <div className="p-3 rounded border" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                                {discount > 0 ? (
                                  <>
                                    <div className="d-flex justify-content-between mb-1 small">
                                      <span className="fw-semibold text-secondary">Service Assessment Subtotal:</span>
                                      <span className="fw-bold text-dark">{formatCurrency(originalPrice)}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1 small">
                                      <span className="fw-semibold text-secondary">Discount Applied:</span>
                                      <span className="fw-bold text-danger">-{formatCurrency(discount)}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1 small">
                                      <span className="fw-semibold text-secondary">Quotation Subtotal:</span>
                                      <span className="fw-bold text-dark">{formatCurrency(basePrice)}</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="d-flex justify-content-between mb-1 small">
                                    <span className="fw-semibold text-secondary">Quotation Subtotal:</span>
                                    <span className="fw-bold text-dark">{formatCurrency(basePrice)}</span>
                                  </div>
                                )}
                                <div className="d-flex justify-content-between mb-1 small">
                                  <span className="fw-semibold text-secondary">Value-Added Tax (10%):</span>
                                  <span className="fw-bold text-dark">+{formatCurrency(taxAmount)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-1 small">
                                  <span className="fw-semibold text-secondary">Total with 10% Tax:</span>
                                  <span className="fw-bold text-dark">{formatCurrency(totalWithTax)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2 small border-bottom pb-2 border-success-subtle">
                                  <span className="fw-semibold text-secondary">Less Reservation Fee Paid:</span>
                                  <span className="fw-bold text-danger">-{formatCurrency(reservationFee)}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center pt-1">
                                  <div>
                                    <span className="fw-bold text-dark fs-6 d-block">Actual Final Balance Payable:</span>
                                    <span className="text-muted small" style={{ fontSize: '0.78rem' }}>(Net amount after 10% tax and reservation credit)</span>
                                  </div>
                                  <span className="fw-bold" style={{ color: '#166534', fontSize: '1.25rem' }}>
                                    {formatCurrency(finalPayable)}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {order.quotation_status === 'Pending Client Approval' && (
                          <div className="mt-4">
                            <h6 className="fw-bold mb-3 text-dark">Action Required: Review Quotation</h6>
                            <p className="text-muted small mb-3">Please review the inspection findings and the updated quotation above. If you agree, you can proceed to schedule your service execution.</p>
                            <div className="d-flex gap-2 mb-3">
                              <button className="btn btn-success fw-bold flex-grow-1 shadow-sm" onClick={() => handleQuotationResponse(order.id, 'approve')} disabled={isSubmittingResponse}>
                                <i className="fas fa-check-circle me-1"></i> I Agree, Proceed
                              </button>
                              <button className="btn btn-warning text-dark fw-bold px-4 shadow-sm" onClick={() => handleQuotationResponse(order.id, 'clarify')} disabled={isSubmittingResponse}>
                                <i className="fas fa-question-circle me-1"></i> Clarify
                              </button>
                            </div>
                            <div className="p-2 px-3 rounded bg-light border text-muted small d-flex align-items-center">
                              <i className="fas fa-info-circle text-secondary me-2"></i>
                              <span>Need to modify the scope or cancel this order? Click <strong>Clarify</strong> or call our office directly at <a href="tel:0464470354" className="fw-bold text-success text-decoration-none">046-447-03-54</a>.</span>
                            </div>
                          </div>
                        )}

                        {order.quotation_status === 'Clarification Requested' && (
                          <div className="mt-4 alert alert-warning border-0 shadow-sm">
                            <h6 className="fw-bold text-dark mb-1"><i className="fas fa-clock me-2"></i>Clarification Requested</h6>
                            <p className="small mb-0">You have requested clarification. Our team will contact you shortly to discuss the details.</p>
                          </div>
                        )}

                        {order.quotation_status === 'Approved' && !order.service_execution_date && (
                          <div className="mt-4 p-3 bg-light rounded border border-success border-opacity-50">
                            <h6 className="fw-bold mb-3 text-success"><i className="fas fa-calendar-alt me-2"></i>Schedule Service Execution</h6>
                            <p className="small text-muted mb-3">Quotation approved! Please select your preferred date and time for the actual service execution.</p>
                            <ClientCalendar
                              selectedDate={serviceDate}
                              selectedTimeSlot={serviceTimeSlot}
                              onSelectDateTime={(date, slot) => { setServiceDate(date); setServiceTimeSlot(slot); }}
                              mode="execution"
                              totalTrips={order.total_trips || 1}
                            />
                            <button className="btn btn-primary fw-bold w-100 shadow-sm" onClick={() => handleSetServiceDate(order.id)} disabled={isSubmittingDate}>
                              Confirm Schedule
                            </button>
                          </div>
                        )}

                        {order.service_execution_date && (
                          <div className="mt-4 alert alert-success border-0 shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>
                              <h6 className="fw-bold text-dark mb-1"><i className="fas fa-calendar-check me-2 text-success"></i>Service Execution Scheduled</h6>
                              <p className="small mb-0">Your service is auto-confirmed for <strong>{new Date(order.service_execution_date).toLocaleDateString()}</strong> at <strong>{order.service_execution_time_slot}</strong>.</p>
                            </div>
                            {order.status !== 'Completed' && order.status !== 'Cancelled' && (
                              <button 
                                className="btn btn-sm btn-outline-cleaneco fw-bold shadow-sm rounded-pill px-3" 
                                onClick={() => triggerRequest(order.id, 'Reschedule Requested', 'execution')} 
                                disabled={!!order.request_type}
                              >
                                <i className="fas fa-calendar-alt me-1"></i> Reschedule Service Date
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

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
                          <div className="d-flex justify-content-between align-items-center text-primary mt-2 flex-wrap gap-2">
                            <div className="d-flex align-items-center">
                              <i className="far fa-calendar-check me-2" style={{ width: '20px' }}></i>
                              <span className="fw-bold">Confirmed Inspection Schedule: {formatDate(order.confirmed_date)} ({order.confirmed_time_slot})</span>
                            </div>
                            {!order.has_final_price && order.status !== 'Completed' && order.status !== 'Cancelled' && (
                              <button 
                                className="btn btn-sm btn-outline-warning text-dark fw-bold shadow-sm rounded-pill px-3" 
                                onClick={() => triggerRequest(order.id, 'Reschedule Requested', 'inspection')} 
                                disabled={!!order.request_type}
                              >
                                <i className="fas fa-calendar-alt me-1"></i> Reschedule Inspection
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <h6 className="fw-bold mb-3">Documents</h6>
                    <div className="d-flex gap-2 flex-wrap mb-4">
                      {order.status === 'Completed' || order.quotation_status === 'Approved' ? (
                        <button className="btn btn-sm btn-primary-solid rounded-pill shadow-sm" onClick={() => generateBilling(order)}>
                          <i className="fas fa-file-pdf me-1"></i>Final Billing Report
                        </button>
                      ) : (
                        <span className="btn btn-sm btn-secondary-solid rounded-pill disabled shadow-sm" style={{ opacity: 0.5 }}>
                          <i className="fas fa-file-pdf me-1"></i>Final Billing Report (Pending)
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

                    <div className="d-flex justify-content-end gap-2 border-top pt-3 flex-wrap">
                      <button 
                        className="btn btn-outline-cleaneco rounded-pill fw-bold shadow-sm" 
                        onClick={() => navigate(`/client/messages?orderId=${order.order_id || order.id}`)}
                      >
                        <i className="fas fa-comment-dots me-1"></i> Message Support
                      </button>
                      {order.status === 'Completed' && (
                        <button className="btn btn-cleaneco rounded-pill fw-bold shadow-sm" onClick={() => generateReceipt(order)}>
                          <i className="fas fa-download me-1"></i> Download Receipt
                        </button>
                      )}
                    </div>
                    {order.request_type && (
                      <div className="text-end mt-2 small fw-bold text-warning">
                        <i className="fas fa-clock me-1"></i>{order.request_type} received. Awaiting admin confirmation.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
        <div className="modal fade show glass-modal" style={{ display: 'block', zIndex: 1060 }} tabIndex="-1">
          <div className={`modal-dialog modal-dialog-centered ${confirmData.type === 'Reschedule Requested' ? 'modal-lg' : ''}`} style={confirmData.type === 'Reschedule Requested' ? { maxWidth: '850px' } : {}}>
            <div className="modal-content">
              <div className="modal-header" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                <h5 className="modal-title text-white">
                  {confirmData.type === 'Reschedule Requested' 
                    ? (confirmData.target === 'execution' ? 'Reschedule Service Execution' : 'Reschedule Site Inspection') 
                    : 'Confirm Request'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowConfirmModal(false)}></button>
              </div>
              <div className="modal-body text-start mt-3 mb-3 p-4">
                {confirmData.type === 'Reschedule Requested' ? (
                  <>
                    <h6 className="fw-normal mb-4">
                      Please select your new preferred schedule for <strong>{confirmData.target === 'execution' ? 'service execution' : 'site inspection'}</strong> and provide a reason. 
                      <br />
                      <small className="text-muted mt-2 d-block"><i className="fas fa-info-circle me-1"></i>You can only reschedule at least 24 hours in advance.</small>
                    </h6>
                    <div className="mb-4 mx-auto" style={{ width: '100%', maxWidth: '800px' }}>
                      <ClientCalendar
                        selectedDate={rescheduleDate}
                        selectedTimeSlot={rescheduleTimeSlot}
                        onSelectDateTime={(date, slot) => { setRescheduleDate(date); setRescheduleTimeSlot(slot); }}
                        mode={confirmData.target === 'execution' ? 'execution' : 'inspection'}
                        totalTrips={confirmData.order?.total_trips || 1}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label fw-bold small text-muted">Reason for Reschedule</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={rescheduleReason}
                        onChange={(e) => setRescheduleReason(e.target.value)}
                        placeholder="Please briefly explain why you need to reschedule..."
                      />
                    </div>
                  </>
                ) : (
                  <h6 className="fw-normal">Are you sure you want to proceed?</h6>
                )}
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
        <div className="modal fade show glass-modal" style={{ display: 'block', zIndex: 1060 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0">
              <div className="modal-header border-0" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                <h5 className="modal-title text-white">Notification</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowResultModal(false)}></button>
              </div>
              <div className="modal-body text-center p-5">
                <i 
                  className={`fas ${
                    resultType === 'success' || 
                    resultMessage.toLowerCase().includes('success') || 
                    resultMessage.toLowerCase().includes('submitted') || 
                    resultMessage.toLowerCase().includes('approved') || 
                    resultMessage.toLowerCase().includes('confirmed')
                      ? 'fa-check-circle text-success' 
                      : 'fa-exclamation-circle text-danger'
                  } mb-3`} 
                  style={{ fontSize: '3rem' }}
                ></i>
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
      {/* Reservation Payment Modal */}
      {showReservationPaymentModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'transparent', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 1060 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '1rem' }}>
              <div className="modal-header border-0" style={{ backgroundColor: '#0D8D1E', color: 'white', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}>
                <h5 className="modal-title text-white fw-bold"><i className="fas fa-wallet me-2"></i>Pay Reservation Fee</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowReservationPaymentModal(false)}></button>
              </div>
              <div className="modal-body text-center p-4">
                <p className="text-muted mb-3">To secure your booking, a reservation fee of <strong>₱1,100</strong> is required.</p>

                {(clientType === 'commercial' || clientType === 'industrial') && (
                  <div className="mb-4">
                    <div className="d-flex gap-3 justify-content-center">
                      <div
                        className="card flex-grow-1 p-3 text-center border-2 shadow-sm"
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderColor: paymentMethod === 'paymongo' ? '#0D8D1E' : '#e2e8f0',
                          backgroundColor: paymentMethod === 'paymongo' ? '#f0fdf4' : '#fff',
                          transform: paymentMethod === 'paymongo' ? 'translateY(-2px)' : 'none'
                        }}
                        onClick={() => setPaymentMethod('paymongo')}
                      >
                        <i className="fas fa-credit-card mb-2 fs-3" style={{ color: paymentMethod === 'paymongo' ? '#0D8D1E' : '#94a3b8' }}></i>
                        <div className="fw-bold" style={{ color: paymentMethod === 'paymongo' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem' }}>Online Payment</div>
                      </div>

                      <div
                        className="card flex-grow-1 p-3 text-center border-2 shadow-sm"
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderColor: paymentMethod === 'cheque' ? '#0D8D1E' : '#e2e8f0',
                          backgroundColor: paymentMethod === 'cheque' ? '#f0fdf4' : '#fff',
                          transform: paymentMethod === 'cheque' ? 'translateY(-2px)' : 'none'
                        }}
                        onClick={() => setPaymentMethod('cheque')}
                      >
                        <i className="fas fa-money-check-alt mb-2 fs-3" style={{ color: paymentMethod === 'cheque' ? '#0D8D1E' : '#94a3b8' }}></i>
                        <div className="fw-bold" style={{ color: paymentMethod === 'cheque' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem' }}>Cheque Verification</div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'paymongo' ? (
                  <>
                    <img src={paymongoLogo} alt="PayMongo Options" className="img-fluid mb-4 px-2" style={{ width: '100%', objectFit: 'contain' }} />
                    <div className="alert alert-info text-start small mb-4" role="alert">
                      <i className="fas fa-info-circle me-2"></i>
                      <strong>Instructions:</strong> Please click the button below to pay securely via PayMongo. You can use credit/debit cards, GCash, or Maya. This ₱1000 fee (plus 10% tax) will be deducted from your final bill.
                    </div>
                  </>
                ) : (
                  <div className="text-start mt-3 mb-4">
                    <div className="alert alert-warning small mb-3">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      <strong>Note:</strong> Cheque payments require manual verification by our staff. The required amount is fixed to <strong>₱1,100</strong>.
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold">Bank Name</label>
                      <input type="text" className="form-control form-control-sm" placeholder="e.g. BDO, BPI" value={chequeDetails.bankName} onChange={(e) => setChequeDetails({ ...chequeDetails, bankName: e.target.value })} required />
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold">Cheque Number</label>
                      <input type="text" className="form-control form-control-sm" value={chequeDetails.chequeNumber} onChange={(e) => setChequeDetails({ ...chequeDetails, chequeNumber: e.target.value })} required />
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold">Account Name</label>
                      <input type="text" className="form-control form-control-sm" value={chequeDetails.accountName} onChange={(e) => setChequeDetails({ ...chequeDetails, accountName: e.target.value })} required />
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold text-success"><i className="fas fa-camera me-1"></i>Upload Cheque Image</label>
                      <input type="file" className="form-control form-control-sm" accept="image/*" onChange={(e) => setChequeFile(e.target.files[0])} required />
                    </div>
                  </div>
                )}

              </div>
              <div className="modal-footer border-0 p-4 pt-0 d-flex flex-column gap-2">
                <button type="button" className="btn btn-primary w-100 rounded-pill fw-bold shadow-sm" onClick={handleReservationPayment} disabled={isSubmittingPayment}>
                  {paymentMethod === 'paymongo'
                    ? <><i className="fas fa-credit-card me-2"></i>{isSubmittingPayment ? 'Processing...' : 'Pay With PayMongo (Cards, GCash, Maya)'}</>
                    : <><i className="fas fa-money-check me-2"></i>{isSubmittingPayment ? 'Submitting...' : 'Submit Cheque for Verification'}</>
                  }
                </button>
                <div className="d-flex w-100 gap-2 mt-2">
                  <button type="button" className="btn btn-light rounded-pill flex-grow-1 fw-bold" onClick={() => setShowReservationPaymentModal(false)} disabled={isSubmittingPayment}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Payment Modal */}
      {showPaymentModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'transparent', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 1060 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '1rem' }}>
              <div className="modal-header border-0" style={{ backgroundColor: '#0D8D1E', color: 'white', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}>
                <h5 className="modal-title text-white fw-bold"><i className="fas fa-wallet me-2"></i>Secure Payment</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)}></button>
              </div>
              <div className="modal-body text-center p-4">
                {(clientType === 'commercial' || clientType === 'industrial') && (
                  <div className="mb-4">
                    <div className="d-flex gap-3 justify-content-center">
                      <div
                        className="card flex-grow-1 p-3 text-center border-2 shadow-sm"
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderColor: paymentMethod === 'paymongo' ? '#0D8D1E' : '#e2e8f0',
                          backgroundColor: paymentMethod === 'paymongo' ? '#f0fdf4' : '#fff',
                          transform: paymentMethod === 'paymongo' ? 'translateY(-2px)' : 'none'
                        }}
                        onClick={() => setPaymentMethod('paymongo')}
                      >
                        <i className="fas fa-credit-card mb-2 fs-3" style={{ color: paymentMethod === 'paymongo' ? '#0D8D1E' : '#94a3b8' }}></i>
                        <div className="fw-bold" style={{ color: paymentMethod === 'paymongo' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem' }}>Online Payment</div>
                      </div>

                      <div
                        className="card flex-grow-1 p-3 text-center border-2 shadow-sm"
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderColor: paymentMethod === 'cheque' ? '#0D8D1E' : '#e2e8f0',
                          backgroundColor: paymentMethod === 'cheque' ? '#f0fdf4' : '#fff',
                          transform: paymentMethod === 'cheque' ? 'translateY(-2px)' : 'none'
                        }}
                        onClick={() => setPaymentMethod('cheque')}
                      >
                        <i className="fas fa-money-check-alt mb-2 fs-3" style={{ color: paymentMethod === 'cheque' ? '#0D8D1E' : '#94a3b8' }}></i>
                        <div className="fw-bold" style={{ color: paymentMethod === 'cheque' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem' }}>Cheque Verification</div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'paymongo' ? (
                  <>
                    <img src={paymongoLogo} alt="PayMongo Options" className="img-fluid mb-4 px-2" style={{ width: '100%', objectFit: 'contain' }} />
                    <div className="alert alert-info text-start small mb-4" role="alert">
                      <i className="fas fa-info-circle me-2"></i>
                      <strong>Instructions:</strong> You will be securely redirected to PayMongo to complete your final balance. We accept GCash, Maya, GrabPay, and Credit/Debit Cards.
                    </div>
                  </>
                ) : (
                  <div className="text-start mt-3 mb-4">
                    <div className="alert alert-warning small mb-3">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      <strong>Note:</strong> Final cheque payments require manual verification by our staff.
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold">Bank Name</label>
                      <input type="text" className="form-control form-control-sm" placeholder="e.g. BDO, BPI" value={chequeDetails.bankName} onChange={(e) => setChequeDetails({ ...chequeDetails, bankName: e.target.value })} required />
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold">Cheque Number</label>
                      <input type="text" className="form-control form-control-sm" value={chequeDetails.chequeNumber} onChange={(e) => setChequeDetails({ ...chequeDetails, chequeNumber: e.target.value })} required />
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold">Account Name</label>
                      <input type="text" className="form-control form-control-sm" value={chequeDetails.accountName} onChange={(e) => setChequeDetails({ ...chequeDetails, accountName: e.target.value })} required />
                    </div>
                    <div className="form-group mb-2">
                      <label className="form-label small fw-bold text-success"><i className="fas fa-camera me-1"></i>Upload Cheque Image</label>
                      <input type="file" className="form-control form-control-sm" accept="image/*" onChange={(e) => setChequeFile(e.target.files[0])} required />
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer border-0 p-4 pt-0 d-flex flex-column gap-2">
                <button type="button" className="btn btn-primary w-100 rounded-pill fw-bold shadow-sm" onClick={handleFinalPayment} disabled={isSubmittingPayment}>
                  {paymentMethod === 'paymongo'
                    ? <><i className="fas fa-credit-card me-2"></i>{isSubmittingPayment ? 'Processing...' : 'Proceed to Payment (Cards, GCash, Maya)'}</>
                    : <><i className="fas fa-money-check me-2"></i>{isSubmittingPayment ? 'Submitting...' : 'Submit Cheque for Verification'}</>
                  }
                </button>
                <div className="d-flex w-100 gap-2 mt-2">
                  <button type="button" className="btn btn-light rounded-pill flex-grow-1 fw-bold" onClick={() => setShowPaymentModal(false)} disabled={isSubmittingPayment}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      <ReceiptTemplate receiptOrder={receiptOrder} services={servicesCatalog} />

      <BillingTemplate billingOrder={selectedBillingOrder} services={servicesCatalog} />

    </div>
  );
}

export default OngoingOrders;