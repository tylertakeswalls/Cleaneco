import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/orderdatabase.css';
import carousel7 from '../assets/styles/images/carousell7.webp';
import AlertModal from '../components/AlertModal';
import { formatDate, getStatusClass, toISODateKey, resolveOrderSchedule, parseAssignedTrucks, getBookedTruckMapForOrder, formatOrderReference, previewPdfBlob } from '../utils/helpers';
import { useConfirm } from '../context/ConfirmContext';
import { useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import reportHeaderImg from '../assets/styles/images/report_header.png';
import { formatName } from '../utils/formatName';
import ServicePricingFields from '../components/ServicePricingFields';
import { calculateOrderTotals, groupOrdersByOrderId, calculateOrderCollectedRevenue, calculateOrderOutstandingBalance, calculateDaysOverdue, parseNumericAmount } from '../utils/pricing';

const processGroupedOrders = (rawOrders) => groupOrdersByOrderId(rawOrders);

function OrderDatabase() {
  const confirm = useConfirm();
  const container = useRef();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [editModal, setEditModal] = useState({ show: false, order: null });
  const [isEditDrawerClosing, setIsEditDrawerClosing] = useState(false);
  const [editForm, setEditForm] = useState({ 
    status: '', price: '', request_type: '', approval_fee: '',
    confirmed_date: '', confirmed_time_slot: '', truck_team: '',
    misc_fee: '', internal_notes: ''
  });
  const [activeTab, setActiveTab] = useState('details');
  const [quotationForm, setQuotationForm] = useState({
    estimate_inputs: {},
    discount_amount: 0,
    justifications: {}
  });
  const [serviceReportFile, setServiceReportFile] = useState(null);
  
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState([]);
  const [truckTeams, setTruckTeams] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [isGeneratingInspectionSheet, setIsGeneratingInspectionSheet] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const filterBarRef = useRef(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const showAlert = (title, message, type = 'info') => {
      setModalConfig({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
      setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handlePrintOrderInspectionSheet = async (order) => {
    if (!order || !order.order_id || isGeneratingInspectionSheet) return;
    setIsGeneratingInspectionSheet(true);
    try {
      const response = await api.get('/reports/inspection-list', {
        params: { orderId: order.order_id },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const refCode = formatOrderReference(order.order_id) || order.order_id;
      previewPdfBlob(blob, `Cleaneco_Inspection_Sheet_${refCode}.pdf`);
    } catch (error) {
      console.error('Error generating order inspection sheet:', error);
      showAlert('Error', 'Failed to generate the inspection sheet PDF for this order.', 'error');
    } finally {
      setIsGeneratingInspectionSheet(false);
    }
  };

  const calculateRevenue = (ordersData) => {
    const total = ordersData.reduce((sum, order) => sum + calculateOrderCollectedRevenue(order), 0);
    setTotalRevenue(total);
  };
  
  const requestDeleteOrder = async (id) => {
    const targetOrder = orders.find(o => o.id === id);
    const orderRef = targetOrder ? `order #${targetOrder.order_id}` : 'this order';

    const isConfirmed = await confirm({
      title: "Confirm Deletion",
      text: `Are you sure you want to delete ${orderRef}?`,
      description: "This action cannot be undone. All associated records and details will be permanently removed.",
      confirmLabel: "Delete",
      confirmVariant: "danger"
    });

    if (isConfirmed) {
      try {
        const response = await api.delete('/orders/' + id);

        if (response.data.success) {
          const updatedOrders = orders.filter(order => order.id !== id);
          setOrders(updatedOrders);
          calculateRevenue(updatedOrders);
          showAlert("Success", "Order deleted successfully!", "success");
        } else {
          showAlert("Warning", response.data.message, "warning");
        }
      } catch (error) {
        console.error("Error deleting order:", error);
        showAlert("Error", "Failed to delete order.", "error");
      }
    }
  };

  useEffect(() => {
    const loggedInUser = sessionStorage.getItem("loggedInUser");
    const userRole = sessionStorage.getItem("userRole");
    
    if (!loggedInUser || userRole !== "admin") {
      navigate('/login');
      return;
    }
    
    const loadData = async () => {
      try {
        const [ordersRes, settingsRes, servicesRes] = await Promise.all([
          api.get('/orders'),
          api.get('/settings/truck-teams').catch(() => ({ data: { truck_teams: [] } })),
          api.get('/services').catch(() => ({ data: [] }))
        ]);
        
        if (servicesRes.data) {
          setServices(servicesRes.data);
        }
        
        if (settingsRes.data && settingsRes.data.truck_teams) {
          setTruckTeams(settingsRes.data.truck_teams);
        }

        const groupedOrders = processGroupedOrders(ordersRes.data);

        setOrders(groupedOrders);
        calculateRevenue(groupedOrders);
        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  // Auto-open Manage modal when redirected from a notification with orderId
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetOrderId = params.get('orderId');
    if (targetOrderId && orders.length > 0) {
      const match = orders.find(o => String(o.order_id).toLowerCase() === targetOrderId.toLowerCase() || formatOrderReference(o.order_id).toLowerCase() === targetOrderId.toLowerCase());
      if (match) {
        openEditModal(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, orders]);

  const openEditModal = (order) => {
    const trips = Number(order.total_trips) || 1;
    let initialTruckTeam = order.service_execution_date ? (order.truck_team || '') : '';

    // If order has >= 5 trips and no truck assigned yet, auto-pair operational trucks if at least 2 exist
    if (trips >= 5 && !initialTruckTeam && order.service_execution_date) {
      const bookedForOrder = getBookedTruckMapForOrder(order, orders, trips);
      const operational = truckTeams.filter(t => {
        const name = typeof t === 'string' ? t : t.name;
        const avail = typeof t === 'string' ? true : t.status !== 'unavailable';
        return avail && !bookedForOrder[name.toLowerCase()];
      });
      if (operational.length >= 2) {
        const nameA = typeof operational[0] === 'string' ? operational[0] : operational[0].name;
        const nameB = typeof operational[1] === 'string' ? operational[1] : operational[1].name;
        initialTruckTeam = `${nameA} & ${nameB}`;
      }
    }

    const rawIds = (order.service_ids && order.service_ids.length > 0)
      ? order.service_ids
      : (order.service_id ? [order.service_id] : []);
    const normalizedServiceIds = rawIds
      .map(s => (s && typeof s === 'object') ? (s._id || s.id) : s)
      .filter(Boolean);

    setEditModal({ show: true, order: { ...order, service_ids: normalizedServiceIds } });
    setIsEditDrawerClosing(false); // cancels an in-progress slide-out if reopened mid-close
    setEditForm({
      status: order.status || '',
      price: order.price || '',
      request_type: order.request_type || '',
      approval_fee: order.approval_fee || '',
      confirmed_date: toISODateKey(order.confirmed_date || order.date),
      confirmed_time_slot: order.confirmed_time_slot || order.time_slot || '',
      truck_team: initialTruckTeam,
      misc_fee: order.misc_fee || '',
      internal_notes: order.internal_notes || ''
    });
    setServiceReportFile(null);
    const initialInputs = order.estimate_inputs ? JSON.parse(JSON.stringify(order.estimate_inputs)) : {};
    const snapshot = order.pricing_snapshot || {};
    const serviceIds = order.service_ids && order.service_ids.length > 0
      ? order.service_ids
      : (order.service_id ? [(typeof order.service_id === 'object' ? (order.service_id._id || order.service_id.id) : order.service_id)] : []);

    serviceIds.forEach(sId => {
      const srv = snapshot[sId] || services.find(s => s.id === sId || s._id === sId);
      if (srv && srv.fields) {
        initialInputs[sId] = initialInputs[sId] || {};
        srv.fields.forEach(f => {
          if (initialInputs[sId][f.key] === undefined) {
            if (f.default !== undefined) initialInputs[sId][f.key] = f.default;
            else if (f.options?.[0]) initialInputs[sId][f.key] = f.options[0].value;
            else if (f.type === 'number') initialInputs[sId][f.key] = f.min || 1;
          }
        });
      }
    });

    setQuotationForm({
      estimate_inputs: initialInputs,
      discount_amount: order.discount_amount || 0,
      justifications: order.justifications || {}
    });
    setActiveTab('details');
  };

  // Start the slide-out; the drawer is unmounted once the animation finishes (see handleEditDrawerAnimationEnd)
  const closeEditModal = () => {
    setIsEditDrawerClosing(true);
  };

  const handleEditDrawerAnimationEnd = (e) => {
    if (e.target !== e.currentTarget) return; // ignore animations bubbling up from children
    if (isEditDrawerClosing) {
      setEditModal({ show: false, order: null });
      setIsEditDrawerClosing(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    let val = value;
    if (name === 'internal_notes') val = val.slice(0, 1000);
    setEditForm(prev => ({
      ...prev,
      [name]: val
    }));
  };

  const handleQuotationInputChange = (serviceId, field, value) => {
    setQuotationForm(prev => ({
      ...prev,
      estimate_inputs: {
        ...prev.estimate_inputs,
        [serviceId]: {
          ...(prev.estimate_inputs[serviceId] || {}),
          [field]: value
        }
      }
    }));
  };

  const handleJustificationChange = (serviceId, field, value) => {
    setQuotationForm(prev => ({
      ...prev,
      justifications: {
        ...prev.justifications,
        [serviceId]: {
          ...(prev.justifications[serviceId] || {}),
          [field]: value
        }
      }
    }));
  };

  const getOrderServices = () => {
    if (!editModal.order) return [];
    const serviceIds = editModal.order.service_ids && editModal.order.service_ids.length > 0
      ? editModal.order.service_ids
      : (editModal.order.service_id ? [(typeof editModal.order.service_id === 'object' ? (editModal.order.service_id._id || editModal.order.service_id.id) : editModal.order.service_id)] : []);

    const snapshot = editModal.order.pricing_snapshot || {};

    return serviceIds.map(sId => {
      if (snapshot[sId]) return snapshot[sId];
      const live = services.find(s => s.id === sId || s._id === sId);
      return live || null;
    }).filter(Boolean);
  };

  const orderServices = getOrderServices();
  const { totalEstimate: quotationSubtotal, totalTrips: calculatedTrips } = calculateOrderTotals(orderServices, quotationForm.estimate_inputs);
  const quotationTotal = Math.max(0, quotationSubtotal - (parseFloat(quotationForm.discount_amount) || 0));
  const estimatedTrips = quotationForm.total_trips ? parseInt(quotationForm.total_trips, 10) : calculatedTrips;

  const isHighCapacityOrder = ((Number(editModal.order?.total_trips) || 0) >= 5) || (estimatedTrips >= 5);
  const isInspectionComplete = Boolean(
    editModal.order && (
      editModal.order.has_final_price ||
      ['Pending Client Approval', 'Clarification Requested', 'Approved'].includes(editModal.order.quotation_status) ||
      editModal.order.service_execution_date ||
      editModal.order.status === 'Completed'
    )
  );
  const showExecutionScheduleCard = Boolean(
    editModal.order && (
      /* Unlock truck assignment only once execution date is scheduled */
      editModal.order.service_execution_date
    )
  );
  const operationalTrucks = truckTeams.filter(t => (typeof t === 'string' ? true : t.status !== 'unavailable'));
  const unavailableTruckSet = new Set(
    truckTeams
      .filter(t => typeof t === 'object' && t && t.status === 'unavailable' && t.name)
      .map(t => t.name.toLowerCase())
  );
  const bookedTruckMap = editModal.order
    ? getBookedTruckMapForOrder(editModal.order, orders, isHighCapacityOrder ? 5 : 1)
    : {};
  const freeOperationalTrucks = operationalTrucks.filter(t => {
    const name = typeof t === 'string' ? t : t.name;
    return !bookedTruckMap[name.toLowerCase()];
  });
  const modalAssignedTrucks = parseAssignedTrucks(editForm.truck_team);
  const modalTruckConflicts = modalAssignedTrucks
    .map(name => bookedTruckMap[name.toLowerCase()])
    .filter(Boolean);
  const modalTruckMaintenance = modalAssignedTrucks
    .filter(name => unavailableTruckSet.has(name.toLowerCase()));

  const getOrderTruckIssue = (order) => {
    if (!order || order.status !== 'In Progress' || !order.truck_team) return null;
    const assigned = parseAssignedTrucks(order.truck_team);
    if (!assigned.length) return null;
    const bookedForRow = getBookedTruckMapForOrder(order, orders);
    const conflict = assigned.map(n => bookedForRow[n.toLowerCase()]).find(Boolean);
    const inMaintenance = assigned.find(n => unavailableTruckSet.has(n.toLowerCase()));
    if (conflict) return { type: 'conflict', conflict };
    if (inMaintenance) return { type: 'maintenance', truckName: inMaintenance };
    return null;
  };
  const selectedHighCapTrucks = editForm.truck_team
    ? editForm.truck_team.split(/[,&]/).map(s => s.trim()).filter(Boolean)
    : [];

  const handleToggleHighCapacityTruck = (teamName) => {
    let updated;
    if (selectedHighCapTrucks.includes(teamName)) {
      updated = selectedHighCapTrucks.filter(t => t !== teamName);
    } else {
      updated = [...selectedHighCapTrucks, teamName];
    }
    setEditForm(prev => ({
      ...prev,
      truck_team: updated.join(' & ')
    }));
  };

  const handleAutoAssignTwoTrucks = () => {
    if (freeOperationalTrucks.length >= 2) {
      const nameA = typeof freeOperationalTrucks[0] === 'string' ? freeOperationalTrucks[0] : freeOperationalTrucks[0].name;
      const nameB = typeof freeOperationalTrucks[1] === 'string' ? freeOperationalTrucks[1] : freeOperationalTrucks[1].name;
      setEditForm(prev => ({
        ...prev,
        truck_team: `${nameA} & ${nameB}`
      }));
    }
  };

  const handleSubmitQuotation = async () => {
    if (!editModal.order) return;
    setIsSaving(true);
    try {
      const payload = {
        estimate_inputs: quotationForm.estimate_inputs,
        justifications: quotationForm.justifications,
        discount_amount: quotationForm.discount_amount,
        price: quotationSubtotal,
        final_price: quotationTotal,
        total_trips: estimatedTrips
      };
      const response = await api.post(`/orders/${editModal.order.id}/quotation`, payload);
      if (response.data.success) {
        showAlert("Success", "Quotation submitted and sent to client!", "success");
        
        const ordersRes = await api.get('/orders');
        const groupedOrders = processGroupedOrders(ordersRes.data);

        setOrders(groupedOrders);
        calculateRevenue(groupedOrders);
        closeEditModal();
      } else {
        showAlert("Error", response.data.message || "Failed to submit quotation", "error");
      }
    } catch (err) {
      console.error(err);
      showAlert("Error", err.response?.data?.message || "Error submitting quotation.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChangesClick = async () => {
    if (editForm.status === 'Cancelled' && editModal.order.status !== 'Cancelled') {
      const isConfirmed = await confirm({
        title: "Confirm Cancellation",
        text: "⚠️ Are you sure you want to mark this order as cancelled? This action cannot be undone.",
        confirmLabel: "Confirm",
        confirmVariant: "danger"
      });
      if (isConfirmed) {
        proceedSaveOrderChanges();
      }
    } else {
      proceedSaveOrderChanges();
    }
  };

  const proceedSaveOrderChanges = async () => {
    if (!editModal.order) return;

    const trips = (Number(editModal.order.total_trips) || 0) || estimatedTrips || 1;
    if (editForm.status !== 'Cancelled' && editForm.truck_team) {
      if (!editModal.order.service_execution_date) {
        showAlert("Execution Not Yet Scheduled", "A truck team can only be assigned after the client selects a service execution date.", "warning");
        return;
      }
      const requestedList = parseAssignedTrucks(editForm.truck_team);
      const conflictMatch = requestedList.map(n => bookedTruckMap[n.toLowerCase()]).find(Boolean);
      if (conflictMatch) {
        showAlert(
          "Truck Schedule Conflict",
          `${conflictMatch.truckName} is already assigned to Order #${conflictMatch.orderId} (${conflictMatch.slot}) on this execution date. Please select an available truck team.`,
          "warning"
        );
        return;
      }
      const prevAssignedLower = new Set(parseAssignedTrucks(editModal.order.truck_team).map(n => n.toLowerCase()));
      const newlySelectedMaintenance = requestedList.find(
        n => !prevAssignedLower.has(n.toLowerCase()) && unavailableTruckSet.has(n.toLowerCase())
      );
      if (newlySelectedMaintenance) {
        showAlert(
          "Truck Unavailable",
          `${newlySelectedMaintenance} is currently marked Unavailable (Maintenance) in Site Settings.`,
          "warning"
        );
        return;
      }
    }
    if (trips >= 5 && editModal.order.quotation_status === 'Approved' && editForm.truck_team) {
      const selected = editForm.truck_team.split(/[,&]/).map(s => s.trim()).filter(Boolean);
      if (selected.length !== 2) {
        showAlert("Invalid Truck Assignment", `High-capacity orders (5+ trips) require exactly 2 operational trucks to be assigned (${selected.length} currently selected).`, "warning");
        return;
      }
    }

    setIsSaving(true);

    try {
      // 1. Update basic fields
      await api.put('/orders/' + editModal.order.id, {
        status: editForm.status,
        request_type: editForm.request_type,
        approval_fee: editForm.approval_fee,
        confirmed_date: editForm.confirmed_date,
        confirmed_time_slot: editForm.confirmed_time_slot,
        truck_team: editForm.truck_team,
        internal_notes: editForm.internal_notes
      });

      // 2. Upload documents if any
      if (serviceReportFile) {
        const formData = new FormData();
        formData.append('service_report', serviceReportFile);

        await api.post(`/orders/${editModal.order.id}/upload-documents`, formData);
      }

      // 3. Reload orders to get updated URLs
      const response = await api.get('/orders');
      const groupedOrders = processGroupedOrders(response.data);

      setOrders(groupedOrders);
      calculateRevenue(groupedOrders);
      closeEditModal();
      showAlert("Success", "Order updated successfully!", "success");
    } catch (error) {
      console.error("Error updating order:", error);
      showAlert("Error", error.response?.data?.message || "Error updating order.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const submitRescheduleAction = async (action, explicitRejectReason = '') => {
    let rejectReason = '';
    if (action === 'reject_reschedule') {
        if (!explicitRejectReason.trim()) {
           showAlert("Warning", "Please provide a reason for rejection.", "warning");
           return;
        }
        rejectReason = explicitRejectReason;
    }
    
    setIsSaving(true);
    try {
      const payload = { action };
      if (rejectReason) payload.reject_reason = rejectReason;
      
      const response = await api.put(`/orders/${editModal.order.id}`, payload);
      if (response.data.success) {
        const ordersRes = await api.get('/orders');
        const groupedOrders = processGroupedOrders(ordersRes.data);
        setOrders(groupedOrders);
        calculateRevenue(groupedOrders);
        closeEditModal();
        showAlert("Success", `Reschedule ${action === 'approve_reschedule' ? 'approved' : 'rejected'} successfully.`, "success");
      } else {
        showAlert("Warning", response.data.message || "Failed to process request", "warning");
      }
    } catch (error) {
      console.error(error);
      showAlert("Error", "Error processing reschedule request.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyCheque = async (action) => {
    setIsSaving(true);
    try {
      const response = await api.post(`/orders/${editModal.order.id}/verify-cheque`, { action });
      if (response.data.success) {
        // Reload orders
        const ordersRes = await api.get('/orders');
        const groupedOrders = processGroupedOrders(ordersRes.data);
        setOrders(groupedOrders);
        calculateRevenue(groupedOrders);
        closeEditModal();
        showAlert("Success", `Cheque ${action}d successfully.`, "success");
      } else {
        showAlert("Warning", response.data.message || "Failed to process request", "warning");
      }
    } catch (error) {
      console.error(error);
      showAlert("Error", "Error processing cheque verification.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendPaymentReminder = async () => {
    const targetOrder = editModal.order;
    const orderIdToUse = targetOrder?.id || targetOrder?._id;
    if (!orderIdToUse) return;

    const formattedRef = formatOrderReference(targetOrder.order_id);
    const clientName = `${targetOrder.first_name || ''} ${targetOrder.last_name || ''}`.trim() || 'the client';
    const balance = calculateOrderOutstandingBalance(targetOrder);

    const isConfirmed = await confirm({
      title: "Send Payment Reminder",
      text: `Send a payment reminder notification and email to ${clientName} for ${formattedRef}?`,
      description: `Outstanding balance: ₱${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. The client will receive an urgent in-app alert and Cleaneco invoice email to settle their account.`,
      confirmLabel: "Send Reminder",
      confirmVariant: "primary"
    });

    if (!isConfirmed) return;

    setIsSendingReminder(true);
    try {
      const response = await api.post(`/orders/${orderIdToUse}/send-payment-reminder`);
      if (response.data.success) {
        showAlert("Success", response.data.message || "Payment reminder sent successfully.", "success");
        const updatedSentAt = response.data.last_payment_reminder_sent_at;
        const updatedCount = response.data.payment_reminder_count;

        setEditModal(prev => ({
          ...prev,
          order: prev.order ? {
            ...prev.order,
            last_payment_reminder_sent_at: updatedSentAt,
            payment_reminder_count: updatedCount
          } : null
        }));

        setOrders(prevOrders => prevOrders.map(o => 
          (o.id === orderIdToUse || o.order_id === targetOrder.order_id)
            ? { ...o, last_payment_reminder_sent_at: updatedSentAt, payment_reminder_count: updatedCount }
            : o
        ));
      } else {
        showAlert("Warning", response.data.message || "Could not send payment reminder.", "warning");
      }
    } catch (error) {
      console.error("Error sending payment reminder:", error);
      const errMsg = error.response?.data?.message || "Failed to send payment reminder.";
      showAlert("Error", errMsg, "error");
    } finally {
      setIsSendingReminder(false);
    }
  };

  if (loading) {
    return (
    <div ref={container}>
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
            <h3 className="text-center fw-bold text-dark mb-4">Order Database</h3>
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const uniqueServices = [...new Set(orders.flatMap(o => (Array.isArray(o.service_names) && o.service_names.length > 0) ? o.service_names : [o.service_name || o.service_type]).filter(Boolean))].sort();

  const filteredOrders = orders.filter(order => {
    const query = searchQuery.toLowerCase().trim();
    const queryWithoutHash = query.startsWith('#') ? query.slice(1) : query;
    const matchesSearch = query === '' || (() => {
      const formattedRef = formatOrderReference(order.order_id).toLowerCase();
      const rawId = String(order.order_id || '').toLowerCase();
      const customerName = `${order.first_name || ''} ${order.last_name || ''}`.toLowerCase();
      const email = String(order.email || '').toLowerCase();
      const phone = String(order.phone || '');
      const address = String(order.address || '').toLowerCase();
      const service = String(order.service_name || order.service_type || '').toLowerCase();
      const team = String(order.truck_team || '').toLowerCase();

      return formattedRef.includes(query) ||
             formattedRef.includes(queryWithoutHash) ||
             rawId.includes(query) ||
             rawId.includes(queryWithoutHash) ||
             customerName.includes(query) ||
             email.includes(query) ||
             phone.includes(query) ||
             address.includes(query) ||
             service.includes(query) ||
             team.includes(query);
    })();

    const matchType = filterType === '' || (Array.isArray(order.service_names) && order.service_names.includes(filterType)) || order.service_name === filterType;
    const matchStatus = filterStatus === '' || (() => {
      if (filterStatus === 'unpaid_balance') {
        return order.status === 'Completed' && order.final_payment_status !== 'Paid';
      }
      if (filterStatus === 'due_soon') {
        if (order.status !== 'Completed' || !order.next_service_due_date) return false;
        const dueDate = new Date(order.next_service_due_date);
        const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }
      return order.status === filterStatus;
    })();
    const matchDate = filterDate === '' || resolveOrderSchedule(order).filterDateKey === filterDate;
    return matchesSearch && matchType && matchStatus && matchDate;
  });

  const isFiltered = Boolean(searchQuery.trim() || filterType || filterStatus || filterDate);
  const currentGrossSales = isFiltered
    ? filteredOrders.reduce((sum, order) => sum + calculateOrderCollectedRevenue(order), 0)
    : totalRevenue;
  const currentOutstandingBalance = isFiltered
    ? filteredOrders.reduce((sum, order) => sum + calculateOrderOutstandingBalance(order), 0)
    : orders.reduce((sum, order) => sum + calculateOrderOutstandingBalance(order), 0);
  const totalBookingsCount = orders.length;
  const completedOrdersCount = orders.filter(o => o.status === 'Completed').length;
  const unpaidCompletedOrdersCount = orders.filter(o => o.status === 'Completed' && o.final_payment_status !== 'Paid').length;
  const pendingOrdersCount = orders.filter(o => o.status === 'Pending').length;
  const inProgressOrdersCount = orders.filter(o => o.status === 'In Progress').length;
  const activeOrdersCount = pendingOrdersCount + inProgressOrdersCount;
  const isSubAdmin = (sessionStorage.getItem("adminScope") || localStorage.getItem("adminScope")) === "sub_admin";

  const handleDownloadReport = async () => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    
    const img = new Image();
    img.src = reportHeaderImg;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    
    doc.addImage(img, 'PNG', 0, 0, 210, 65);

    const reportRevenue = filteredOrders.reduce((sum, order) => sum + calculateOrderCollectedRevenue(order), 0);

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Order Database Report", 14, 75);
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 81);
    doc.setFont("times", "bold");
    doc.text(`Gross Sales (incl. 10% Tax): PHP ${reportRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 87);

    const tableColumn = ["Order ID", "Customer", "Service", "Schedule", "Status", "Team", "Collected (PHP)"];
    const tableRows = [];

    filteredOrders.forEach(order => {
      const collected = calculateOrderCollectedRevenue(order);
      const orderData = [
        order.order_id || '-',
        formatName(order),
        order.service_name || order.service_type || '-',
        resolveOrderSchedule(order).pdfText,
        order.status || '-',
        order.truck_team || 'Unassigned',
        collected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ];
      tableRows.push(orderData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 93,
      styles: { fontSize: 8 },
      headStyles: { fillColor: '#0D8D1E' }
    });

    previewPdfBlob(doc.output('blob'), `Order_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div ref={container}>
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
          <div className="text-center mb-4">
            <h3 className="fw-bold text-dark mb-1">Order Database</h3>
            <p className="text-muted small mb-0">
              {isSubAdmin
                ? 'Overview of all client bookings, scheduled site inspections, and field dispatch details'
                : 'Overview of all client bookings, operational execution, and financial performance'}
            </p>
          </div>

          {/* Executive KPI Metric Cards */}
          <div className="row g-3 mb-4">
            {isSubAdmin ? (
              <div className="col-12 col-sm-6 col-xl-3">
                <div className="db-kpi-card">
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="db-kpi-label">In Progress</span>
                    <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
                      <i className="fas fa-truck"></i>
                    </div>
                  </div>
                  <div className="db-kpi-value text-dark">
                    {inProgressOrdersCount}
                  </div>
                  <p className="db-kpi-subtext">
                    Active Dispatch & Execution
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="col-12 col-sm-6 col-md-4 col-xl">
                  <div className="db-kpi-card">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="db-kpi-label">Gross Sales</span>
                      <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(13, 141, 30, 0.12)', color: '#0D8D1E' }}>
                        <i className="fas fa-coins"></i>
                      </div>
                    </div>
                    <div className="db-kpi-value text-success">
                      ₱{currentGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="db-kpi-subtext">
                      {isFiltered ? 'Filtered Total Collected' : 'All-Time Total Collected'}
                    </p>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-md-4 col-xl">
                  <div 
                    className={`db-kpi-card ${filterStatus === 'unpaid_balance' ? 'border border-danger' : ''}`}
                    style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                    onClick={() => setFilterStatus(filterStatus === 'unpaid_balance' ? '' : 'unpaid_balance')}
                    title="Click to toggle filter for completed orders with unpaid balance"
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="db-kpi-label">Outstanding Balance</span>
                      <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' }}>
                        <i className="fas fa-file-invoice-dollar"></i>
                      </div>
                    </div>
                    <div className="db-kpi-value text-danger">
                      ₱{currentOutstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="db-kpi-subtext">
                      {unpaidCompletedOrdersCount} Completed Pending Settlement
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className={isSubAdmin ? "col-12 col-sm-6 col-xl-3" : "col-12 col-sm-6 col-md-4 col-xl"}>
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Total Bookings</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
                    <i className="fas fa-clipboard-list"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-dark">
                  {isFiltered ? `${filteredOrders.length} / ${totalBookingsCount}` : totalBookingsCount}
                </div>
                <p className="db-kpi-subtext">
                  {isFiltered ? 'Matching Active Filters' : 'All Registered Bookings'}
                </p>
              </div>
            </div>

            <div className={isSubAdmin ? "col-12 col-sm-6 col-xl-3" : "col-12 col-sm-6 col-md-4 col-xl"}>
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Completed Services</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}>
                    <i className="fas fa-check-circle"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-dark">
                  {completedOrdersCount}
                </div>
                <p className="db-kpi-subtext">
                  Successfully Executed
                </p>
              </div>
            </div>

            <div className={isSubAdmin ? "col-12 col-sm-6 col-xl-3" : "col-12 col-sm-6 col-md-4 col-xl"}>
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Active & Pending</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#d97706' }}>
                    <i className="fas fa-clock"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-dark">
                  {activeOrdersCount}
                </div>
                <p className="db-kpi-subtext">
                  {pendingOrdersCount} Pending • {inProgressOrdersCount} In Progress
                </p>
              </div>
            </div>
          </div>
          
          <div className="admin-filter-toolbar">
            <div className="client-filter-bar" ref={filterBarRef} role="search" aria-label="Filter order database">
              {/* Search Segment */}
              <div className="client-filter-segment client-filter-segment--search">
                <i className="fas fa-search client-filter-icon" aria-hidden="true"></i>
                <input
                  type="text"
                  className="form-control client-filter-input"
                  maxLength={100}
                  placeholder="Search order #CLN-..., customer, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.slice(0, 100))}
                  onFocus={() => setOpenDropdown(null)}
                  aria-label="Search orders"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="btn btn-link p-0 text-muted"
                    style={{ fontSize: '0.85rem', lineHeight: 1 }}
                    title="Clear search text"
                    aria-label="Clear search text"
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
              </div>

              {/* Service Dropdown Segment */}
              <div className="client-filter-segment client-filter-segment--select">
                <button
                  type="button"
                  className="client-filter-dropdown-trigger"
                  onClick={() => setOpenDropdown(openDropdown === 'service' ? null : 'service')}
                  aria-expanded={openDropdown === 'service'}
                  aria-haspopup="listbox"
                >
                  <span className="d-flex align-items-center gap-2 text-truncate">
                    <i className="fas fa-concierge-bell client-filter-icon" aria-hidden="true"></i>
                    <span className="text-truncate">{filterType || 'All Services'}</span>
                  </span>
                  <i className={`fas fa-chevron-down client-filter-dropdown-chevron ${openDropdown === 'service' ? 'open' : ''}`} aria-hidden="true"></i>
                </button>
                {openDropdown === 'service' && (
                  <ul className="client-filter-dropdown-menu" role="listbox" aria-label="Filter by service">
                    <li>
                      <button
                        type="button"
                        className={`client-filter-dropdown-item ${filterType === '' ? 'active' : ''}`}
                        onClick={() => { setFilterType(''); setOpenDropdown(null); }}
                      >
                        <span>All Services</span>
                        {filterType === '' && <i className="fas fa-check small"></i>}
                      </button>
                    </li>
                    {uniqueServices.map((service) => (
                      <li key={service}>
                        <button
                          type="button"
                          className={`client-filter-dropdown-item ${filterType === service ? 'active' : ''}`}
                          onClick={() => { setFilterType(service); setOpenDropdown(null); }}
                        >
                          <span>{service}</span>
                          {filterType === service && <i className="fas fa-check small"></i>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Status Dropdown Segment */}
              <div className="client-filter-segment client-filter-segment--select">
                <button
                  type="button"
                  className="client-filter-dropdown-trigger"
                  onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                  aria-expanded={openDropdown === 'status'}
                  aria-haspopup="listbox"
                >
                  <span className="d-flex align-items-center gap-2 text-truncate">
                    <i className="fas fa-filter client-filter-icon" aria-hidden="true"></i>
                    <span className="text-truncate">
                      {filterStatus === 'unpaid_balance' ? 'Unpaid Balance' : filterStatus === 'due_soon' ? 'Service Due Soon' : (filterStatus || 'All Statuses')}
                    </span>
                  </span>
                  <i className={`fas fa-chevron-down client-filter-dropdown-chevron ${openDropdown === 'status' ? 'open' : ''}`} aria-hidden="true"></i>
                </button>
                {openDropdown === 'status' && (
                  <ul className="client-filter-dropdown-menu" role="listbox" aria-label="Filter by status">
                    {[
                      { value: '', label: 'All Statuses' },
                      { value: 'Pending', label: 'Pending' },
                      { value: 'In Progress', label: 'In Progress' },
                      { value: 'Completed', label: 'Completed' },
                      { value: 'unpaid_balance', label: 'Unpaid Balance' },
                      { value: 'due_soon', label: 'Service Due Soon' },
                      { value: 'Cancelled', label: 'Cancelled' }
                    ].map((opt) => (
                      <li key={opt.value || 'all'}>
                        <button
                          type="button"
                          className={`client-filter-dropdown-item ${filterStatus === opt.value ? 'active' : ''}`}
                          onClick={() => { setFilterStatus(opt.value); setOpenDropdown(null); }}
                        >
                          <span>{opt.label}</span>
                          {filterStatus === opt.value && <i className="fas fa-check small"></i>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Date Segment */}
              <div className="client-filter-segment client-filter-segment--date" title="Filter by active schedule date (Inspection or Service Execution)">
                <i className="far fa-calendar-alt client-filter-icon" aria-hidden="true"></i>
                <input
                  type="date"
                  className="form-control client-filter-date-input"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  onFocus={() => setOpenDropdown(null)}
                  aria-label="Filter by schedule date"
                />
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate('')}
                    className="btn btn-link p-0 text-muted"
                    style={{ fontSize: '0.85rem', lineHeight: 1 }}
                    title="Clear date filter"
                    aria-label="Clear date filter"
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
              </div>

              {/* Contextual Reset Segment */}
              {(searchQuery || filterType || filterStatus || filterDate) && (
                <button
                  type="button"
                  className="client-filter-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('');
                    setFilterStatus('');
                    setFilterDate('');
                    setOpenDropdown(null);
                  }}
                >
                  <i className="fas fa-undo-alt"></i>
                  <span>Reset</span>
                </button>
              )}
            </div>

            {!isSubAdmin && (
              <div className="admin-toolbar-actions">
                <button type="button" className="btn admin-toolbar-btn" onClick={handleDownloadReport}>
                  <i className="fas fa-file-pdf me-2"></i> Download Report
                </button>
              </div>
            )}
          </div>
          
          <div className="table-container">
            <table className="table table-bordered text-center mb-0">
              <thead className="thead-light">
                <tr>
                  <th style={{ minWidth: '160px', whiteSpace: 'nowrap' }}>Order ID</th>
                  <th style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>Customer</th>
                  <th style={{ minWidth: '220px', maxWidth: '300px', whiteSpace: 'nowrap' }}>Service</th>
                  <th style={{ minWidth: '170px', whiteSpace: 'nowrap' }}>Schedule</th>
                  <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>Truck Team</th>
                  <th style={{ minWidth: '145px', whiteSpace: 'nowrap' }}>Final Price (₱)</th>
                  <th style={{ minWidth: '100px', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="d-flex flex-column align-items-center justify-content-center py-4">
                        <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{width: '70px', height:'70px'}}>
                          <i className="fas fa-box-open fs-2 text-secondary"></i>
                        </div>
                        <h5 className="fw-bold text-dark mb-1">No orders found</h5>
                        <p className="text-muted mb-0">Try adjusting your filters or wait for new bookings.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="text-nowrap" style={{ minWidth: '160px', whiteSpace: 'nowrap' }}>
                        <div className="fw-bold text-dark text-nowrap" style={{ whiteSpace: 'nowrap' }}>#{formatOrderReference(order.order_id)}</div>
                        <div className="text-muted text-nowrap" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{order.order_id}</div>
                      </td>
                      <td style={{ minWidth: '140px' }}>{formatName(order)}</td>
                      <td style={{ minWidth: '220px', maxWidth: '300px' }}>
                        <div className="fw-semibold text-dark" style={{ lineHeight: '1.4', fontSize: '0.9rem' }}>
                          {(order.service_name || order.service_type || '').split(', ').map((s, idx, arr) => (
                            <span key={idx} style={{ display: 'block' }}>
                              {s}{idx < arr.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>
                        {order.estimate_inputs && (order.estimate_inputs.accessibility === 'difficult' || Object.values(order.estimate_inputs).some(v => v && typeof v === 'object' && v.accessibility === 'difficult')) && (
                          <div className="mt-1">
                            <span 
                              className="fw-semibold d-inline-flex align-items-center text-nowrap"
                              style={{ 
                                backgroundColor: '#fee2e2', 
                                color: '#991b1b', 
                                border: '1px solid #fecaca', 
                                borderRadius: '999px', 
                                padding: '2px 8px', 
                                fontSize: '0.72rem', 
                                letterSpacing: '0.2px' 
                              }}
                            >
                              <i className="fas fa-exclamation-triangle me-1" style={{ fontSize: '0.68rem' }}></i>
                              Requires Extension Hoses
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ minWidth: '170px' }}>
                        {(() => {
                          const sched = resolveOrderSchedule(order);
                          return (
                            <div className="d-flex flex-column align-items-center justify-content-center gap-1">
                              <div className="fw-semibold" style={{ fontSize: '0.9rem', color: sched.phase === 'awaiting_execution' ? '#475569' : '#1e293b' }}>
                                {sched.formattedDate}
                                {sched.activeSlot && (
                                  <span className="text-muted fw-normal ms-1" style={{ fontSize: '0.8rem' }}>
                                    ({sched.activeSlot})
                                  </span>
                                )}
                              </div>
                              <span
                                style={{
                                  backgroundColor: sched.badgeBg,
                                  color: sched.badgeColor,
                                  border: `1px solid ${sched.badgeBorder}`,
                                  borderRadius: '999px',
                                  padding: '2px 9px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  lineHeight: 1.35,
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {sched.label}
                              </span>
                              {sched.phase === 'awaiting_execution' && sched.inspectedDateFormatted !== 'N/A' && (
                                <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                  Inspected: {sched.inspectedDateFormatted}
                                </small>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className={`status-cell text-nowrap ${getStatusClass(order.status)}`} style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>
                        {order.status}
                        {order.status === 'Completed' && order.final_payment_status !== 'Paid' && (() => {
                          const overdue = calculateDaysOverdue(order);
                          return (
                            <div className="mt-1">
                              <span 
                                className="fw-semibold d-inline-flex align-items-center" 
                                style={{ 
                                  backgroundColor: '#fee2e2', 
                                  color: '#991b1b', 
                                  border: '1px solid #fecaca', 
                                  borderRadius: '999px', 
                                  padding: '2px 8px', 
                                  fontSize: '0.72rem', 
                                  letterSpacing: '0.2px' 
                                }}
                                title={`${overdue} day${overdue === 1 ? '' : 's'} since service completion without final payment`}
                              >
                                <i className="fas fa-exclamation-circle me-1" style={{ fontSize: '0.68rem' }}></i>
                                Unpaid • {overdue}d
                              </span>
                            </div>
                          );
                        })()}
                        {order.request_type && (
                          <div className="small text-warning fw-bold mt-1">{order.request_type}</div>
                        )}
                      </td>
                      <td style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>
                        <div>{order.truck_team || 'Unassigned'}</div>
                        {(() => {
                          const issue = getOrderTruckIssue(order);
                          if (!issue) return null;
                          if (issue.type === 'conflict') {
                            return (
                              <span
                                className="badge bg-danger mt-1"
                                style={{ fontSize: '0.68rem' }}
                                title={`Conflicts with Order #${issue.conflict.orderId} (${issue.conflict.slot})`}
                              >
                                <i className="fas fa-exclamation-triangle me-1"></i>Double-Booked
                              </span>
                            );
                          }
                          return (
                            <span
                              className="badge bg-warning text-dark mt-1"
                              style={{ fontSize: '0.68rem' }}
                              title={`${issue.truckName} is marked Unavailable (Maintenance) in Site Settings`}
                            >
                              <i className="fas fa-tools me-1"></i>In Maintenance
                            </span>
                          );
                        })()}
                      </td>
                      <td className="text-nowrap" style={{ whiteSpace: 'nowrap' }}>
                        {order.has_final_price
                          ? `₱${parseNumericAmount(order.final_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : (order.status === 'Completed' && parseNumericAmount(order.price) > 0
                              ? `₱${parseNumericAmount(order.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "-")}
                      </td>
                      <td>
                      <button 
                        className="btn-edit" 
                        onClick={() => openEditModal(order)}
                        disabled={!isSubAdmin && order.status === 'Cancelled'}
                        style={!isSubAdmin && order.status === 'Cancelled' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        aria-label={`${isSubAdmin ? 'View' : 'Manage'} order #${order.order_id}`}
                      >
                        {isSubAdmin ? 'View' : 'Manage'}
                      </button>
                    </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>


        
        {editModal.show && createPortal(
        <div className={`side-drawer-overlay ${isEditDrawerClosing ? 'closing' : ''}`} onClick={closeEditModal}>
          <div className={`side-drawer ${isEditDrawerClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()} onAnimationEnd={handleEditDrawerAnimationEnd}>
            <div className="side-drawer-header">
              <h5 className="mb-0 text-dark fw-bold"><i className={`fas ${isSubAdmin ? 'fa-eye' : 'fa-edit'} me-2`} style={{color: '#0D8D1E'}}></i>{isSubAdmin ? 'Order Details' : 'Manage Order'}</h5>
              <button type="button" className="btn-close" onClick={closeEditModal}></button>
            </div>
            
            <div className="side-drawer-body p-0">
              <ul className="nav nav-tabs px-4 pt-3 bg-light border-bottom" style={{ gap: '5px' }}>
                <li className="nav-item">
                  <button className={`nav-link fw-bold ${activeTab === 'details' ? 'active border-bottom-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('details')} style={activeTab === 'details' ? { color: '#0D8D1E' } : {}}>Details</button>
                </li>
                {!isSubAdmin && (
                  <>
                    <li className="nav-item">
                      <button className={`nav-link fw-bold ${activeTab === 'quotation' ? 'active border-bottom-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('quotation')} style={activeTab === 'quotation' ? { color: '#0D8D1E' } : {}}>Quotation</button>
                    </li>
                    <li className="nav-item">
                      <button className={`nav-link fw-bold ${activeTab === 'scheduling' ? 'active border-bottom-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('scheduling')} style={activeTab === 'scheduling' ? { color: '#0D8D1E' } : {}}>Scheduling</button>
                    </li>
                    <li className="nav-item">
                      <button className={`nav-link fw-bold ${activeTab === 'documents' ? 'active border-bottom-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('documents')} style={activeTab === 'documents' ? { color: '#0D8D1E' } : {}}>Documents</button>
                    </li>
                  </>
                )}
              </ul>

              <div className="tab-content p-4">
                {activeTab === 'details' && (
                  <div className="row">
                    <div className="col-md-12 d-flex flex-column">
                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Order Status</label>
                        <select 
                          name="status"
                          className="form-select bg-light border-0 shadow-sm"
                          value={editForm.status}
                          onChange={handleEditChange}
                          disabled={isSubAdmin}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>


                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Client Additional Notes</label>
                        <textarea 
                          className="form-control bg-light border-0 shadow-sm" 
                          value={editModal.order?.notes || 'No additional notes provided.'}
                          readOnly
                          rows="2"
                        />
                      </div>

                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Internal Notes</label>
                        <textarea 
                          name="internal_notes"
                          maxLength={1000}
                          className="form-control bg-light border-0 shadow-sm" 
                          placeholder={isSubAdmin ? "No internal notes provided." : "Private notes (client will not see this)"}
                          value={editForm.internal_notes}
                          onChange={handleEditChange}
                          readOnly={isSubAdmin}
                          rows="2"
                        />
                      </div>
                      
                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Client Request Type</label>
                        <select 
                          name="request_type"
                          className="form-select bg-light border-0 shadow-sm"
                          value={editForm.request_type}
                          onChange={handleEditChange}
                          disabled={isSubAdmin}
                        >
                          <option value="">None</option>
                          <option value="Cancel Requested">Cancel Requested</option>
                          <option value="Reschedule Requested">Reschedule Requested</option>
                        </select>
                      </div>
                      
                      {editModal.order.request_type === 'Reschedule Requested' && editModal.order.reschedule_date && (
                        <div className="form-group mb-3">
                          <label className="form-label fw-bold small text-muted">
                            Reschedule Request Details ({editModal.order.reschedule_target === 'execution' ? 'Service Execution' : 'Site Inspection'})
                          </label>
                          <div className="card border-0 shadow-sm p-3 bg-light">
                            <div className="small mb-1"><span className="text-muted fw-semibold">New Date:</span> {formatDate(editModal.order.reschedule_date)}</div>
                            <div className="small mb-1"><span className="text-muted fw-semibold">New Time:</span> {editModal.order.reschedule_time_slot}</div>
                            <div className="small mb-3"><span className="text-muted fw-semibold">Reason:</span> {editModal.order.reschedule_reason}</div>
                            
                            {!isSubAdmin && (
                              <div className="d-flex gap-2">
                                <button className="btn btn-success btn-sm fw-bold w-100" onClick={() => submitRescheduleAction('approve_reschedule')} disabled={isSaving}>
                                  Approve
                                </button>
                                <button className="btn btn-danger btn-sm fw-bold w-100" onClick={() => setRejectModalOpen(true)} disabled={isSaving}>
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {editModal.order.site_photo_url && (() => {
                        const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
                        const sitePhotoHref = `${apiBase}${editModal.order.site_photo_url.startsWith('/') ? '' : '/'}${editModal.order.site_photo_url}`;
                        const photoConditions = [];
                        const inputsMap = editModal.order.estimate_inputs || {};
                        orderServices.forEach(srv => {
                          const sId = String(srv.id || srv._id || '');
                          const srvInputs = inputsMap[sId] || {};
                          (srv.fields || []).forEach(field => {
                            const selectedVal = srvInputs[field.key] !== undefined ? String(srvInputs[field.key]) : String(field.default ?? '');
                            const matchedOpt = (field.options || []).find(o => String(o.value) === selectedVal);
                            if (matchedOpt && matchedOpt.requires_photo) {
                              photoConditions.push(`${field.label}: ${matchedOpt.label}`);
                            }
                          });
                        });
                        const conditionLabel = photoConditions.length > 0
                          ? [...new Set(photoConditions)].join(' • ')
                          : 'Difficult Site Accessibility';

                        return (
                          <div className="form-group mb-3">
                            <label className="form-label fw-bold small text-muted">Site Accessibility Details</label>
                            <div className="card border-0 shadow-sm p-3 bg-light">
                              <div className="small mb-2">
                                <span className="text-muted fw-semibold d-block mb-1">Condition</span>
                                <span
                                  className="badge bg-warning text-dark text-wrap text-start lh-base"
                                  style={{ maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', padding: '6px 10px' }}
                                >
                                  {conditionLabel}
                                </span>
                              </div>
                              <div className="small text-muted mb-3">
                                Client uploaded a site photo during booking to help the inspection and truck team prepare necessary equipment.
                              </div>
                              <div className="mb-3">
                                <a href={sitePhotoHref} target="_blank" rel="noopener noreferrer" className="d-inline-block">
                                  <img
                                    src={sitePhotoHref}
                                    alt="Client Uploaded Site Accessibility"
                                    className="img-fluid rounded border bg-white shadow-sm"
                                    style={{ maxHeight: '160px', objectFit: 'cover' }}
                                  />
                                </a>
                              </div>
                              <div>
                                <a href={sitePhotoHref} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-solid-primary fw-bold">
                                  View Site Photo
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {!isSubAdmin && editModal.order.payment_method === 'cheque' && (
                        <div className="form-group mb-3">
                          <label className="form-label fw-bold small text-muted">Cheque Payment Details</label>
                          <div className="card border-0 shadow-sm p-3 bg-light">
                            <div className="small mb-1"><span className="text-muted fw-semibold">Status:</span> <span className={`badge ${editModal.order.cheque_status === 'approved' ? 'bg-success' : editModal.order.cheque_status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>{editModal.order.cheque_status?.replace('_', ' ').toUpperCase()}</span></div>
                            <div className="small mb-1"><span className="text-muted fw-semibold">Bank:</span> {editModal.order.cheque_issuing_bank || editModal.order.cheque_bank_name || 'N/A'}</div>
                            <div className="small mb-1"><span className="text-muted fw-semibold">Cheque No:</span> {editModal.order.cheque_number || 'N/A'}</div>
                            <div className="small mb-1"><span className="text-muted fw-semibold">Account Name:</span> {editModal.order.cheque_payer_name || editModal.order.cheque_account_name || 'N/A'}</div>
                            <div className="small mb-3"><span className="text-muted fw-semibold">Amount:</span> ₱{editModal.order.cheque_amount || '1100'}</div>
                            
                            {editModal.order.cheque_image_url && (
                              <div className="mb-3">
                                <a href={`${(process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '')}${editModal.order.cheque_image_url}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-solid-primary fw-bold">
                                  View Cheque Image
                                </a>
                              </div>
                            )}

                            {editModal.order.cheque_status === 'pending_verification' && (
                              <div className="d-flex gap-2 pt-2 border-top">
                                <button className="btn btn-success btn-sm fw-bold w-100" onClick={() => handleVerifyCheque('approve')} disabled={isSaving}>
                                  Approve
                                </button>
                                <button className="btn btn-danger btn-sm fw-bold w-100" onClick={() => handleVerifyCheque('reject')} disabled={isSaving}>
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!isSubAdmin && editModal.order.status === 'Completed' && (() => {
                        const isPaid = editModal.order.final_payment_status === 'Paid';
                        const outstandingBal = calculateOrderOutstandingBalance(editModal.order);
                        const overdueDays = calculateDaysOverdue(editModal.order);
                        const lastReminder = editModal.order.last_payment_reminder_sent_at;
                        const reminderCount = editModal.order.payment_reminder_count || 0;

                        let isThrottled = false;
                        let hoursRemaining = 0;
                        if (lastReminder) {
                          const hoursSince = (Date.now() - new Date(lastReminder).getTime()) / (1000 * 60 * 60);
                          if (hoursSince < 24) {
                            isThrottled = true;
                            hoursRemaining = Math.ceil(24 - hoursSince);
                          }
                        }

                        return (
                          <div className="form-group mb-3">
                            <label className="form-label fw-bold text-dark" style={{ fontSize: '0.9rem' }}>Final Balance & Settlement</label>
                            <div className={`card border shadow-sm p-3 rounded-3 ${isPaid ? 'bg-light' : 'bg-light border-danger-subtle'}`}>
                              <div className="d-flex justify-content-between align-items-center mb-2 pb-1">
                                <span className="fw-medium text-secondary" style={{ fontSize: '0.9rem' }}>Settlement Status:</span>
                                {isPaid ? (
                                  <span className="badge bg-success" style={{ fontSize: '0.85rem', padding: '5px 12px', borderRadius: '999px' }}>
                                    <i className="fas fa-check-circle me-1"></i>Fully Paid
                                  </span>
                                ) : (
                                  <span 
                                    className="fw-semibold d-inline-flex align-items-center"
                                    style={{
                                      backgroundColor: '#fee2e2',
                                      color: '#991b1b',
                                      border: '1px solid #fecaca',
                                      borderRadius: '999px',
                                      padding: '4px 12px',
                                      fontSize: '0.85rem'
                                    }}
                                  >
                                    <i className="fas fa-exclamation-circle me-1" style={{ fontSize: '0.78rem' }}></i>
                                    Unpaid (₱{outstandingBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                  </span>
                                )}
                              </div>

                              {!isPaid && (
                                <>
                                  <div className="d-flex justify-content-between align-items-center mb-2 pb-1">
                                    <span className="fw-medium text-secondary" style={{ fontSize: '0.9rem' }}>Overdue Period:</span>
                                    <span className="text-dark fw-semibold" style={{ fontSize: '0.9rem' }}>
                                      {overdueDays} day{overdueDays === 1 ? '' : 's'} <span className="text-muted fw-normal" style={{ fontSize: '0.82rem' }}>(since completion)</span>
                                    </span>
                                  </div>
                                  <div className="d-flex justify-content-between align-items-center mb-2 pb-1">
                                    <span className="fw-medium text-secondary" style={{ fontSize: '0.9rem' }}>Reminder History:</span>
                                    <span className="text-dark fw-semibold" style={{ fontSize: '0.9rem' }}>
                                      {lastReminder 
                                        ? `${reminderCount} sent (${formatDate(lastReminder)})` 
                                        : 'No reminder sent yet'}
                                    </span>
                                  </div>

                                  <div className="pt-2 mt-1 border-top">
                                    <button
                                      type="button"
                                      className={`btn w-100 fw-bold d-flex align-items-center justify-content-center gap-2 ${isThrottled ? 'btn-secondary text-white' : 'btn-danger text-white'}`}
                                      style={{
                                        padding: '9px 16px',
                                        fontSize: '0.9rem',
                                        borderRadius: '8px',
                                        opacity: isThrottled ? 0.8 : 1
                                      }}
                                      onClick={handleSendPaymentReminder}
                                      disabled={isSendingReminder || isThrottled}
                                      title={isThrottled ? `A reminder was sent recently. You can send another in ${hoursRemaining}h.` : 'Send in-app and email reminder to client'}
                                    >
                                      {isSendingReminder ? (
                                        <>
                                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                          <span>Sending Reminder...</span>
                                        </>
                                      ) : isThrottled ? (
                                        <>
                                          <i className="fas fa-clock"></i>
                                          <span>Reminder Sent (Available In {hoursRemaining}h)</span>
                                        </>
                                      ) : (
                                        <>
                                          <i className="fas fa-paper-plane"></i>
                                          <span>Send Payment Reminder</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {editModal.order.status === 'Completed' && (() => {
                        const nextDue = editModal.order.next_service_due_date ? new Date(editModal.order.next_service_due_date) : null;
                        const intervalMonths = editModal.order.next_service_interval_months || 0;
                        const reminderSent = editModal.order.next_service_reminder_sent_at ? new Date(editModal.order.next_service_reminder_sent_at) : null;

                        return (
                          <div className="form-group mb-3">
                            <label className="form-label fw-bold text-dark" style={{ fontSize: '0.9rem' }}>Recurring Maintenance Cycle</label>
                            <div className="card border shadow-sm p-3 rounded-3 bg-light">
                              <div className="d-flex justify-content-between align-items-center mb-2 pb-1">
                                <span className="fw-medium text-secondary" style={{ fontSize: '0.9rem' }}>Recommended Frequency:</span>
                                <span className="badge bg-white text-dark border fw-semibold" style={{ fontSize: '0.85rem', padding: '5px 12px', borderRadius: '8px' }}>
                                  {intervalMonths > 0 ? (intervalMonths >= 12 && intervalMonths % 12 === 0 ? `Every ${intervalMonths / 12} Year${intervalMonths > 12 ? 's' : ''}` : `Every ${intervalMonths} Months`) : 'One-Off / Standard'}
                                </span>
                              </div>
                              <div className="d-flex justify-content-between align-items-center mb-2 pb-1">
                                <span className="fw-medium text-secondary" style={{ fontSize: '0.9rem' }}>Next Service Due:</span>
                                <span className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>
                                  {nextDue ? nextDue.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not Scheduled'}
                                </span>
                              </div>
                              <div className="d-flex justify-content-between align-items-center pt-2 mt-1 border-top">
                                <span className="fw-medium text-secondary" style={{ fontSize: '0.88rem' }}>Automated Alert Status:</span>
                                <span className="text-dark fw-semibold" style={{ fontSize: '0.88rem' }}>
                                  {reminderSent ? `Reminder sent on ${formatDate(reminderSent)}` : (nextDue ? 'Scheduled 30 days prior to due date' : 'None')}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const isBizOrder = ['commercial', 'industrial'].includes(String(editModal.order.user_clientType || '').toLowerCase());
                        const fallbackName = formatName(editModal.order);
                        const displayLocations = (Array.isArray(editModal.order.households) && editModal.order.households.length > 0)
                          ? editModal.order.households
                          : (editModal.order.address ? [{ name: fallbackName, address: editModal.order.address }] : []);

                        if (displayLocations.length === 0) return null;

                        return (
                          <div className="form-group mb-2">
                            <label className="form-label fw-bold small text-muted">
                              {isBizOrder
                                ? `Service Locations / Buildings (${displayLocations.length})`
                                : `Participating Households (${editModal.order.num_households || displayLocations.length})`}
                            </label>
                            <div className="card border-0 shadow-sm p-3 bg-light">
                            <div 
                              className="bg-white" 
                              style={{ 
                                borderRadius: '8px', 
                                border: '1px solid #dee2e6', 
                                overflow: 'hidden' 
                              }}
                            >
                              <table 
                                className="table table-sm bg-white mb-0 small" 
                                style={{ 
                                  borderCollapse: 'separate', 
                                  borderSpacing: 0, 
                                  width: '100%',
                                  minWidth: 0,
                                  tableLayout: 'fixed',
                                  marginBottom: 0
                                }}
                              >
                                <thead className="table-light">
                                  <tr>
                                    <th 
                                      style={{ 
                                        width: '36px', 
                                        borderTopLeftRadius: '7px', 
                                        borderBottom: '1px solid #dee2e6', 
                                        borderRight: '1px solid #dee2e6',
                                        borderTop: 'none', 
                                        borderLeft: 'none' 
                                      }}
                                      className="px-2 py-1 text-center"
                                    >
                                      #
                                    </th>
                                    <th 
                                      style={{ 
                                        width: '40%',
                                        borderBottom: '1px solid #dee2e6', 
                                        borderRight: '1px solid #dee2e6',
                                        borderTop: 'none',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word'
                                      }}
                                      className="px-2 py-1"
                                    >
                                      {isBizOrder ? 'Building / Contact' : 'Name'}
                                    </th>
                                    <th 
                                      style={{ 
                                        width: 'calc(60% - 36px)',
                                        borderTopRightRadius: '7px', 
                                        borderBottom: '1px solid #dee2e6', 
                                        borderTop: 'none', 
                                        borderRight: 'none',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word'
                                      }}
                                      className="px-2 py-1"
                                    >
                                      Address
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayLocations.map((h, i) => {
                                    const isLast = i === displayLocations.length - 1;
                                    const resolvedCompany = editModal.order.company_name || '';
                                    const locationDisplayName = (i === 0 && isBizOrder && resolvedCompany && !String(h.name || '').toLowerCase().includes(resolvedCompany.toLowerCase()))
                                      ? `${h.name} (${resolvedCompany})`
                                      : h.name;
                                    return (
                                      <tr key={i}>
                                        <td 
                                          className="fw-bold px-2 py-1 text-center" 
                                          style={{ 
                                            borderBottom: isLast ? 'none' : '1px solid #dee2e6',
                                            borderRight: '1px solid #dee2e6',
                                            borderBottomLeftRadius: isLast ? '7px' : 0,
                                            borderLeft: 'none'
                                          }}
                                        >
                                          {i + 1}
                                        </td>
                                        <td 
                                          className="px-2 py-1" 
                                          style={{ 
                                            borderBottom: isLast ? 'none' : '1px solid #dee2e6',
                                            borderRight: '1px solid #dee2e6',
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-word'
                                          }}
                                        >
                                          <span>{locationDisplayName}</span>{' '}
                                          {i === 0 && <span className="badge bg-success d-inline-block mt-1">{isBizOrder ? 'Primary' : 'Lead'}</span>}
                                        </td>
                                        <td 
                                          className="px-2 py-1" 
                                          style={{ 
                                            borderBottom: isLast ? 'none' : '1px solid #dee2e6',
                                            borderBottomRightRadius: isLast ? '7px' : 0,
                                            borderRight: 'none',
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-word'
                                          }}
                                        >
                                          <div>{h.address}</div>
                                          {h.address && (
                                            <div className="mt-1">
                                              <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.address)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="d-inline-flex align-items-center gap-1 text-decoration-none fw-semibold"
                                                style={{
                                                  fontSize: '0.73rem',
                                                  color: '#0D8D1E',
                                                  backgroundColor: 'rgba(13, 141, 30, 0.08)',
                                                  border: '1px solid rgba(13, 141, 30, 0.22)',
                                                  borderRadius: '999px',
                                                  padding: '2px 9px'
                                                }}
                                                title={`Open "${h.address}" in Google Maps`}
                                              >
                                                <span>Open in Maps</span>
                                                <i className="fas fa-external-link-alt" style={{ fontSize: '0.58rem', opacity: 0.75 }}></i>
                                              </a>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {editModal.order.landmark && (
                              <div className="small text-muted mt-2">
                                <span className="fw-semibold">Nearest Landmark:</span> {editModal.order.landmark}
                              </div>
                            )}
                            <div className="mt-3 pt-2 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                              <span className="small text-muted">
                                Pre-filled checklist for this order's booked services &amp; sites
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-solid-brand rounded-pill fw-bold px-3 shadow-sm"
                                onClick={() => handlePrintOrderInspectionSheet(editModal.order)}
                                disabled={isGeneratingInspectionSheet}
                              >
                                <i className={`fas ${isGeneratingInspectionSheet ? 'fa-spinner fa-spin' : 'fa-file-pdf'} me-1`}></i>
                                {isGeneratingInspectionSheet ? 'Preparing PDF...' : 'Print Inspection Sheet'}
                              </button>
                            </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {activeTab === 'quotation' && (
                  <div className="row">
                    <div className="col-md-12 d-flex flex-column">
                      <div className="alert alert-info border-0 shadow-sm p-3 mb-4 small">
                        <i className="fas fa-info-circle me-2"></i>
                        Build the hierarchical quotation based on inspection findings. This will be sent to the client for approval.
                      </div>
                      <div className="mb-3 d-flex justify-content-between align-items-center">
                        <label className="form-label fw-bold text-muted mb-0">Quotation Status</label>
                        <span className={`badge ${editModal.order.quotation_status === 'Approved' ? 'bg-success' : editModal.order.quotation_status === 'Clarification Requested' ? 'bg-warning text-dark' : editModal.order.quotation_status === 'Client Declined' ? 'bg-danger' : 'bg-secondary'}`}>{editModal.order.quotation_status || 'Pending Inspection'}</span>
                      </div>
                      
                      {orderServices.map(service => {
                        const serviceId = service.id || service._id;
                        return (
                          <div key={serviceId} className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-light border-0 py-3">
                              <label className="form-label fw-bold text-muted mb-0">{service.name}</label>
                            </div>
                            <div className="card-body bg-white pt-3 pb-3 px-4">
                              <ServicePricingFields
                                service={service}
                                values={quotationForm.estimate_inputs[serviceId] || {}}
                                onChange={(fieldKey, val) => handleQuotationInputChange(serviceId, fieldKey, val)}
                                justifications={quotationForm.justifications[serviceId] || {}}
                                onJustificationChange={(fieldKey, reason) => handleJustificationChange(serviceId, fieldKey, reason)}
                                showJustifications={true}
                              />
                            </div>
                          </div>
                        );
                      })}

                      <div className="card shadow-sm border mb-4" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="form-label fw-bold text-muted mb-0">Estimated Total Trips:</label>
                            <span className="fw-bold text-dark">
                              {estimatedTrips} {estimatedTrips === 1 ? 'Trip' : 'Trips'}
                              {estimatedTrips >= 5 ? (
                                <span className="badge bg-danger ms-2">Whole-Day Lock (2 Trucks)</span>
                              ) : (
                                <span className="badge bg-success ms-2">Single Slot (1 Truck)</span>
                              )}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="form-label fw-bold text-muted mb-0">Total (Before Discount):</label>
                            <span className="fw-bold text-dark">₱{quotationSubtotal.toLocaleString()}</span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="form-label fw-bold text-muted mb-0">Discount Applied (₱):</label>
                            <input type="number" className="form-control form-control-sm text-end shadow-sm" style={{ width: '120px', borderColor: '#86efac' }} value={quotationForm.discount_amount} onChange={(e) => setQuotationForm(prev => ({ ...prev, discount_amount: e.target.value }))} />
                          </div>
                          <hr className="my-2" style={{ borderColor: '#86efac' }} />
                          <div className="d-flex justify-content-between align-items-center mt-2">
                            <label className="form-label fw-bold text-muted mb-0">Final Quotation Total:</label>
                            <span className="fw-bold" style={{ color: '#166534', fontSize: '1.25rem' }}>₱{quotationTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button className="btn btn-success w-100 rounded-pill fw-bold shadow-sm p-3 mb-2" onClick={handleSubmitQuotation} disabled={isSaving || ['Completed', 'Cancelled'].includes(editModal.order.status)}>
                        {['Completed', 'Cancelled'].includes(editModal.order.status) ? `Quotation Locked (${editModal.order.status})` : (isSaving ? 'Submitting...' : 'Send Quotation to Client')}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'scheduling' && (
                  <div className="row">
                    <div className="col-md-12 d-flex flex-column">
                      {isInspectionComplete && !showExecutionScheduleCard && editModal.order.status !== 'Cancelled' && editModal.order.status !== 'Completed' && (
                        <div className="order-1">
                          <label className="form-label fw-bold small text-muted mb-2">Service Execution Scheduling</label>
                          <div className="card shadow-sm border-info border-opacity-25 mb-4" style={{ backgroundColor: '#f0f9ff' }}>
                            <div className="card-body">
                              <div className="d-flex align-items-start gap-2">
                                <i className="fas fa-hourglass-half text-primary mt-1"></i>
                                <div>
                                  <div className="fw-bold text-dark small mb-1">Awaiting Client Quotation Approval &amp; Execution Date</div>
                                  <div className="small text-muted">
                                    Current quotation status: <strong>{editModal.order.quotation_status || 'Pending Client Approval'}</strong>. Once the client approves the quotation and selects their execution date and time slot, truck team deployment will unlock here.
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className={isInspectionComplete ? 'order-2' : 'order-1'}>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <label className="form-label fw-bold small text-muted mb-0">
                            Inspection Scheduling
                          </label>
                          {isInspectionComplete && (
                            <span className="badge rounded-pill" style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                              <i className="fas fa-check-circle me-1"></i>Inspection Completed
                            </span>
                          )}
                        </div>
                      <div className="card shadow-sm border-0 mb-4 bg-light">
                        <div className="card-body">
                          <div className="form-group mb-3">
                            <label className="form-label fw-bold small text-muted">Client Preferred Inspection Date</label>
                            <input 
                              type="date" 
                              className="form-control bg-white border-0 shadow-sm" 
                              value={editModal.order?.date?.split('T')[0] || ''} 
                              readOnly
                            />
                          </div>
                          <div className="form-group mb-3">
                            <label className="form-label fw-bold small text-muted">Confirmed Inspection Date</label>
                            <input 
                              type="date" 
                              name="confirmed_date"
                              readOnly={isInspectionComplete}
                              style={isInspectionComplete ? { opacity: 0.8, cursor: 'not-allowed' } : undefined}
                              className="form-control bg-white border-0 shadow-sm" 
                              value={editForm.confirmed_date}
                              onChange={handleEditChange}
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label fw-bold small text-muted">Confirmed Inspection Time Slot</label>
                            <select
                              name="confirmed_time_slot"
                              disabled={isInspectionComplete}
                              style={isInspectionComplete ? { opacity: 0.8, cursor: 'not-allowed' } : undefined}
                              className="form-select bg-white border-0 shadow-sm"
                              value={editForm.confirmed_time_slot || ''}
                              onChange={handleEditChange}
                            >
                              <option value="">Select Time Slot</option>
                              <option value="Morning">Morning (8AM - 12PM)</option>
                              <option value="Afternoon">Afternoon (12PM - 5PM)</option>
                              <option value="Evening">Evening (5PM - 9PM)</option>
                              {editForm.confirmed_time_slot && !['Morning', 'Afternoon', 'Evening'].includes(editForm.confirmed_time_slot) && (
                                <option value={editForm.confirmed_time_slot}>{editForm.confirmed_time_slot}</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>

                        {isInspectionComplete && (
                          <small className="text-muted d-block mb-3" style={{ marginTop: '-10px' }}>
                            <i className="fas fa-lock me-1"></i>Inspection record is locked because this order has already progressed past site inspection.
                          </small>
                        )}
                      </div>

                      {showExecutionScheduleCard && (
                        <div className={isInspectionComplete ? 'order-1' : 'order-2'}>
                          <label className="form-label fw-bold small text-muted mb-2">Service Execution Scheduling</label>
                          <div className="card shadow-sm border-success border-opacity-25 mb-4" style={{ backgroundColor: '#f0fdf4' }}>
                            <div className="card-body">
                              <div className="form-group mb-3">
                                <label className="form-label fw-bold small text-muted">Service Execution Date</label>
                                <input 
                                  type="date" 
                                  className="form-control shadow-sm" 
                                  value={editModal.order.service_execution_date ? editModal.order.service_execution_date.split('T')[0] : ''} 
                                  readOnly
                                />
                                <small className="text-muted mt-1 d-block">Auto-confirmed by client</small>
                              </div>
                              <div className="form-group mb-3">
                                <label className="form-label fw-bold small text-muted">Service Execution Time Slot</label>
                                <input 
                                  type="text" 
                                  className="form-control shadow-sm" 
                                  value={editModal.order.service_execution_time_slot || ''} 
                                  readOnly
                                />
                              </div>
                              {isHighCapacityOrder ? (
                                <div className="form-group mb-0">
                                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                                    <label className="form-label fw-bold small text-muted mb-0">
                                      Assign 2 Vacuum Trucks <span className="badge bg-danger ms-1">Whole-Day (5+ Trips)</span>
                                    </label>
                                    {selectedHighCapTrucks.length === 2 ? (
                                      <span className="badge bg-success"><i className="fas fa-check-circle me-1"></i>2 Trucks Selected</span>
                                    ) : (
                                      <span className="badge bg-warning text-dark"><i className="fas fa-exclamation-circle me-1"></i>{selectedHighCapTrucks.length}/2 Selected</span>
                                    )}
                                  </div>

                                  {operationalTrucks.length >= 2 && freeOperationalTrucks.length < 2 && (
                                    <div className="alert alert-warning py-2 px-3 small mb-2">
                                      <i className="fas fa-calendar-times me-1"></i>
                                      <strong>Schedule Notice:</strong> Only {freeOperationalTrucks.length} operational truck{freeOperationalTrucks.length === 1 ? ' is' : 's are'} unbooked on this execution date. At least 2 free trucks are required.
                                    </div>
                                  )}
                                  {operationalTrucks.length < 2 && (
                                    <div className="alert alert-warning py-2 px-3 small mb-2">
                                      <i className="fas fa-exclamation-triangle me-1"></i>
                                      <strong>Notice:</strong> Only {operationalTrucks.length} operational truck{operationalTrucks.length === 1 ? ' is' : 's are'} available in Settings. At least 2 are required.
                                    </div>
                                  )}

                                  <div className="p-3 bg-white rounded border border-success border-opacity-50 shadow-sm">
                                    <div className="small text-muted mb-2">
                                      {operationalTrucks.length === 2 ? (
                                        <span>Both operational trucks are automatically paired for this full-day execution:</span>
                                      ) : (
                                        <span>Select exactly <strong>2 operational trucks</strong> to deploy for this whole-day execution:</span>
                                      )}
                                    </div>

                                    <div className="d-flex flex-column gap-2">
                                      {truckTeams.map((team, idx) => {
                                        const teamName = typeof team === 'string' ? team : team.name;
                                        const isAvailable = typeof team === 'string' ? true : team.status !== 'unavailable';
                                        const isChecked = selectedHighCapTrucks.includes(teamName);
                                        const conflict = bookedTruckMap[teamName.toLowerCase()];
                                        const isSelectable = (isAvailable && !conflict) || isChecked;

                                        return (
                                          <div 
                                            key={(typeof team === 'object' && team.id) || idx}
                                            className="d-flex align-items-center justify-content-between p-2 px-3 rounded"
                                            style={{
                                              backgroundColor: isChecked ? '#f0fdf4' : '#f8fafc',
                                              border: isChecked ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                                              opacity: (!isAvailable || (conflict && !isChecked)) ? 0.6 : 1,
                                              transition: 'all 0.15s ease'
                                            }}
                                          >
                                            <div className="form-check mb-0 d-flex align-items-center">
                                              <input
                                                className="form-check-input me-2 mt-0"
                                                type="checkbox"
                                                id={`truck-team-cb-${idx}`}
                                                checked={isChecked}
                                                disabled={!isSelectable}
                                                onChange={() => handleToggleHighCapacityTruck(teamName)}
                                                style={{ cursor: isSelectable ? 'pointer' : 'not-allowed', accentColor: '#0D8D1E' }}
                                              />
                                              <label
                                                className="form-check-label fw-bold mb-0"
                                                htmlFor={`truck-team-cb-${idx}`}
                                                style={{
                                                  cursor: isSelectable ? 'pointer' : 'not-allowed',
                                                  color: isChecked ? '#166534' : '#334155'
                                                }}
                                              >
                                                <i className="fas fa-truck me-2" style={{ color: isChecked ? '#0D8D1E' : '#64748b' }}></i>
                                                {teamName}
                                              </label>
                                            </div>
                                            <span
                                              className={`badge rounded-pill ${conflict ? 'bg-warning text-dark' : !isAvailable ? 'bg-danger' : !isChecked ? 'bg-secondary' : ''}`}
                                              style={
                                                !conflict && isAvailable && isChecked
                                                  ? { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.72rem' }
                                                  : { fontSize: '0.72rem' }
                                              }
                                            >
                                              {conflict ? `Booked (#${conflict.orderId}, ${conflict.slot})` : !isAvailable ? 'Unavailable (Maintenance)' : isChecked ? 'Assigned' : 'Available'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {freeOperationalTrucks.length >= 2 && selectedHighCapTrucks.length !== 2 && (
                                      <div className="mt-2 text-end">
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm text-decoration-none p-0 text-success fw-bold"
                                          onClick={handleAutoAssignTwoTrucks}
                                        >
                                          <i className="fas fa-magic me-1"></i>Auto-Select {freeOperationalTrucks.length === 2 ? 'Both Free Trucks' : 'First 2 Free Trucks'}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-2 small text-muted">
                                    Current Assignment: <strong>{editForm.truck_team || 'None (Unassigned)'}</strong>
                                    {modalTruckConflicts.length > 0 && (
                                      <div className="alert alert-danger py-2 px-3 small mt-2 mb-0">
                                        <i className="fas fa-exclamation-triangle me-1"></i>
                                        <strong>Schedule Conflict:</strong> {modalTruckConflicts.map(c => `${c.truckName} (#${c.orderId}, ${c.slot})`).join(', ')} is already booked on this execution date. Please reassign.
                                      </div>
                                    )}
                                    {modalTruckConflicts.length === 0 && modalTruckMaintenance.length > 0 && (
                                      <div className="alert alert-warning py-2 px-3 small mt-2 mb-0">
                                        <i className="fas fa-tools me-1"></i>
                                        <strong>Maintenance Notice:</strong> {modalTruckMaintenance.join(', ')} is currently marked Unavailable (Maintenance) in Site Settings.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="form-group mb-0">
                                  <label className="form-label fw-bold small text-muted">Assign Truck Team</label>
                                  <select 
                                    name="truck_team"
                                    className="form-select shadow-sm border-success"
                                    value={editForm.truck_team}
                                    onChange={handleEditChange}
                                  >
                                    <option value="">-- Select a Team --</option>
                                    {truckTeams.map((team, idx) => {
                                      const teamName = typeof team === 'string' ? team : team.name;
                                      const isAvailable = typeof team === 'string' ? true : team.status !== 'unavailable';
                                      return (
                                        <option 
                                          key={(typeof team === 'object' && team.id) || idx} 
                                          value={teamName}
                                          disabled={(!isAvailable || Boolean(bookedTruckMap[teamName.toLowerCase()])) && editForm.truck_team !== teamName}
                                        >
                                          {teamName}
                                          {bookedTruckMap[teamName.toLowerCase()]
                                            ? ` (Booked - #${bookedTruckMap[teamName.toLowerCase()].orderId}, ${bookedTruckMap[teamName.toLowerCase()].slot})`
                                            : (!isAvailable ? ' (Unavailable - Maintenance)' : '')}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <small className="text-muted mt-1 d-block">Assign an available team to deploy on the execution date (teams booked in an overlapping slot are disabled).</small>
                                  {modalTruckConflicts.length > 0 && (
                                    <div className="alert alert-danger py-2 px-3 small mt-2 mb-0">
                                      <i className="fas fa-exclamation-triangle me-1"></i>
                                      <strong>Schedule Conflict:</strong> {modalTruckConflicts[0].truckName} is also assigned to Order <strong>#{modalTruckConflicts[0].orderId}</strong> ({modalTruckConflicts[0].slot}) on this date. Please reassign to an available truck team.
                                    </div>
                                  )}
                                  {modalTruckConflicts.length === 0 && modalTruckMaintenance.length > 0 && (
                                    <div className="alert alert-warning py-2 px-3 small mt-2 mb-0">
                                      <i className="fas fa-tools me-1"></i>
                                      <strong>Maintenance Notice:</strong> {modalTruckMaintenance.join(', ')} is currently marked Unavailable (Maintenance) in Site Settings. Consider reassigning to an operational truck.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="row">
                    <div className="col-md-12 d-flex flex-column">
                      <div className="alert alert-info border-0 shadow-sm p-3 mb-4 small">
                        <i className="fas fa-info-circle me-2"></i>
                        Uploaded documents will be immediately visible on the client's dashboard under this order.
                      </div>

                      <div className="form-group mb-4">
                        <label className="form-label fw-bold small text-muted">Upload Service Report / Invoice</label>
                        <input 
                          type="file" 
                          accept=".pdf"
                          className="form-control bg-light border-0 shadow-sm"
                          onChange={(e) => setServiceReportFile(e.target.files[0])}
                        />
                        {editModal.order.service_report_pdf_url && (
                          <div className="mt-2 small">
                            <a href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${editModal.order.service_report_pdf_url}`} target="_blank" rel="noopener noreferrer" className="text-success text-decoration-none fw-bold">
                              <i className="fas fa-file-pdf me-1"></i>View Current Service Report
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="side-drawer-footer d-flex justify-content-between align-items-center">
              {!isSubAdmin ? (
                <button
                  type="button"
                  className="btn btn-danger rounded-pill px-4 fw-bold shadow-sm"
                  onClick={() => {
                    const idToDelete = editModal.order?.id;
                    closeEditModal();
                    if (idToDelete) requestDeleteOrder(idToDelete);
                  }}
                  disabled={isSaving}
                  aria-label="Delete this order"
                >
                  <i className="fas fa-trash-alt me-1"></i> Delete Order
                </button>
              ) : <div />}
              <div className="d-flex gap-2">
                <button 
                  type="button" 
                  className="btn btn-light rounded-pill px-4 fw-bold shadow-sm" 
                  onClick={closeEditModal}
                  disabled={isSaving}
                >
                  {isSubAdmin ? 'Close' : 'Cancel'}
                </button>
                {!isSubAdmin && (
                  <button 
                    type="button" 
                    className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" 
                    onClick={handleSaveChangesClick}
                    disabled={isSaving}
                    style={{ display: activeTab === 'quotation' ? 'none' : 'block' }}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Reject Modal */}
      {rejectModalOpen && createPortal(
        <div 
          className="modal fade show" 
          style={{ 
            display: 'block', 
            zIndex: 1080, 
            backgroundColor: 'transparent', 
            backdropFilter: 'blur(5px)', 
            WebkitBackdropFilter: 'blur(5px)' 
          }} 
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                <h5 className="modal-title text-white"><i className="fas fa-exclamation-triangle me-2"></i>Reject Reschedule</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setRejectModalOpen(false); setRejectReasonText(''); }}></button>
              </div>
              <div className="modal-body text-start mt-3 mb-3 p-4">
                <h6 className="fw-normal mb-3">Please provide a reason for rejecting the reschedule request. This will be shown to the client.</h6>
                <textarea
                  className="form-control bg-light"
                  rows="3"
                  maxLength={500}
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value.slice(0, 500))}
                  placeholder="Enter rejection reason..."
                  autoFocus
                ></textarea>
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-light rounded-pill px-4 fw-bold" onClick={() => { setRejectModalOpen(false); setRejectReasonText(''); }}>Cancel</button>
                <button 
                  className="btn btn-danger rounded-pill px-4 fw-bold shadow-sm" 
                  onClick={() => {
                    submitRescheduleAction('reject_reschedule', rejectReasonText);
                    setRejectModalOpen(false);
                    setRejectReasonText('');
                  }}
                  disabled={isSaving || !rejectReasonText.trim()}
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      </section>
    </div>
  );
}

export default OrderDatabase;
