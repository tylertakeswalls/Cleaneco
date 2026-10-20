import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/orderdatabase.css';
import carousel7 from '../assets/styles/images/carousell7.png';
import AlertModal from '../components/AlertModal';
import { formatDate, getStatusClass } from '../utils/helpers';
import { useConfirm } from '../context/ConfirmContext';
import { useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import reportHeaderImg from '../assets/styles/images/report_header.png';
import { formatName } from '../utils/formatName';

function OrderDatabase() {
  const confirm = useConfirm();
  const container = useRef();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [editModal, setEditModal] = useState({ show: false, order: null });
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
  const [services, setServices] = useState([]);
  const [truckTeams, setTruckTeams] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReasonText, setRejectReasonText] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();

  const showAlert = (title, message, type = 'info') => {
      setModalConfig({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
      setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const calculateRevenue = (ordersData) => {
    const total = ordersData.reduce((sum, order) => {
      const price = parseFloat(order.has_final_price ? order.final_price : order.price) || 0;
      return order.status === 'Completed' ? sum + price : sum;
    }, 0);
    setTotalRevenue(total);
  };
  
  const requestDeleteOrder = async (id) => {
    const isConfirmed = await confirm({
      title: "Confirm Deletion",
      text: "⚠️ Are you sure you want to delete this order?",
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

        const grouped = ordersRes.data.reduce((acc, order) => {
          if (!acc[order.order_id]) {
            acc[order.order_id] = { ...order, service_names: [], service_ids: [], first_id: order.id };
          }
          acc[order.order_id].service_names.push(order.service_name || order.service_type);
          if (order.service_id && !acc[order.order_id].service_ids.includes(order.service_id)) {
            acc[order.order_id].service_ids.push(order.service_id);
          }
          return acc;
        }, {});
        
        const groupedOrders = Object.values(grouped).map(o => ({
          ...o,
          id: o.first_id,
          service_name: o.service_names.join(', ')
        }));

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
      const match = orders.find(o => String(o.order_id).toLowerCase() === targetOrderId.toLowerCase());
      if (match) {
        openEditModal(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, orders]);

  const openEditModal = (order) => {
    const trips = Number(order.total_trips) || 1;
    let initialTruckTeam = order.truck_team || '';

    // If order has >= 5 trips and no truck assigned yet, auto-pair operational trucks if at least 2 exist
    if (trips >= 5 && !initialTruckTeam) {
      const operational = truckTeams.filter(t => (typeof t === 'string' ? true : t.status !== 'unavailable'));
      if (operational.length >= 2) {
        const nameA = typeof operational[0] === 'string' ? operational[0] : operational[0].name;
        const nameB = typeof operational[1] === 'string' ? operational[1] : operational[1].name;
        initialTruckTeam = `${nameA} & ${nameB}`;
      }
    }

    setEditModal({ show: true, order });
    setEditForm({
      status: order.status || '',
      price: order.price || '',
      request_type: order.request_type || '',
      approval_fee: order.approval_fee || '',
      confirmed_date: order.confirmed_date ? new Date(order.confirmed_date).toISOString().split('T')[0] : '',
      confirmed_time_slot: order.confirmed_time_slot || '',
      truck_team: initialTruckTeam,
      misc_fee: order.misc_fee || '',
      internal_notes: order.internal_notes || ''
    });
    setServiceReportFile(null);
    setQuotationForm({
      estimate_inputs: order.estimate_inputs ? JSON.parse(JSON.stringify(order.estimate_inputs)) : {},
      discount_amount: order.discount_amount || 0,
      justifications: order.justifications || {}
    });
    setActiveTab('details');
  };

  const closeEditModal = () => {
    setEditModal({ show: false, order: null });
  };

  const handleEditChange = (e) => {
    setEditForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
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

  const getQuotationSubtotal = () => {
    if (!editModal.order || !editModal.order.service_ids) return 0;
    
    let total = 0;
    editModal.order.service_ids.forEach(serviceId => {
      const service = services.find(s => s.id === serviceId || s._id === serviceId);
      if (service) {
        const name = service.name.toLowerCase();
        const inputs = quotationForm.estimate_inputs[serviceId] || {};
        
        if (name.includes('siphon') || name.includes('desludg')) {
            const numTanks = parseInt(inputs.numTanks || 1);
            const capacityType = parseInt(inputs.capacityType || 1);
            const accessibility = inputs.accessibility || 'easy';
            const trips = numTanks * capacityType;
            let cost = trips * 8000;
            if (accessibility === 'difficult') {
                cost += 1500;
            }
            total += cost;
        } else if (name.includes('deep clean') || name.includes('declog')) {
            const numTanks = parseInt(inputs.numTanks || 1);
            total += numTanks * 8000;
        } else {
            total += service.base_price || 0;
        }
      }
    });
    return total;
  };

  const calculateTotalTrips = () => {
    if (!editModal.order || !editModal.order.service_ids) return 1;
    let trips = 0;
    editModal.order.service_ids.forEach(serviceId => {
      const service = services.find(s => s.id === serviceId || s._id === serviceId);
      if (service) {
        const name = service.name.toLowerCase();
        const inputs = quotationForm.estimate_inputs[serviceId] || {};
        if (name.includes('siphon') || name.includes('desludg')) {
          const numTanks = parseInt(inputs.numTanks || 1, 10);
          const capacityType = parseInt(inputs.capacityType || 1, 10);
          trips += Math.max(1, numTanks * capacityType);
        } else if (name.includes('deep clean') || name.includes('declog')) {
          const numTanks = parseInt(inputs.numTanks || 1, 10);
          trips += Math.max(1, numTanks);
        } else {
          trips += 1;
        }
      }
    });
    return Math.max(1, trips);
  };

  const quotationSubtotal = getQuotationSubtotal();
  const quotationTotal = Math.max(0, quotationSubtotal - (parseFloat(quotationForm.discount_amount) || 0));
  const estimatedTrips = calculateTotalTrips();

  const isHighCapacityOrder = ((Number(editModal.order?.total_trips) || 0) >= 5) || (estimatedTrips >= 5);
  const operationalTrucks = truckTeams.filter(t => (typeof t === 'string' ? true : t.status !== 'unavailable'));
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
    if (operationalTrucks.length >= 2) {
      const nameA = typeof operationalTrucks[0] === 'string' ? operationalTrucks[0] : operationalTrucks[0].name;
      const nameB = typeof operationalTrucks[1] === 'string' ? operationalTrucks[1] : operationalTrucks[1].name;
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
        const grouped = ordersRes.data.reduce((acc, order) => {
          if (!acc[order.order_id]) acc[order.order_id] = { ...order, service_names: [], first_id: order.id };
          acc[order.order_id].service_names.push(order.service_name || order.service_type);

          return acc;
        }, {});
        
        const groupedOrders = Object.values(grouped).map(o => ({
          ...o, id: o.first_id, service_name: o.service_names.join(', '), price: o.price
        }));

        setOrders(groupedOrders);
        calculateRevenue(groupedOrders);
        closeEditModal();
      } else {
        showAlert("Error", response.data.message || "Failed to submit quotation", "error");
      }
    } catch (err) {
      console.error(err);
      showAlert("Error", "Error submitting quotation.", "error");
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
      const grouped = response.data.reduce((acc, order) => {
        if (!acc[order.order_id]) {
          acc[order.order_id] = { ...order, service_names: [], first_id: order.id };
        }
        acc[order.order_id].service_names.push(order.service_name || order.service_type);
        return acc;
      }, {});
      
      const groupedOrders = Object.values(grouped).map(o => ({
        ...o,
        id: o.first_id,
        service_name: o.service_names.join(', ')
      }));

      setOrders(groupedOrders);
      calculateRevenue(groupedOrders);
      closeEditModal();
      showAlert("Success", "Order updated successfully!", "success");
    } catch (error) {
      console.error("Error updating order:", error);
      showAlert("Error", "Error updating order.", "error");
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
        const grouped = ordersRes.data.reduce((acc, order) => {
          if (!acc[order.order_id]) {
            acc[order.order_id] = { ...order, service_names: [], first_id: order.id };
          }
          acc[order.order_id].service_names.push(order.service_name || order.service_type);

          return acc;
        }, {});
        const groupedOrders = Object.values(grouped).map(o => ({
          ...o,
          id: o.first_id,
          service_name: o.service_names.join(', '),
          price: o.price
        }));
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
        const grouped = ordersRes.data.reduce((acc, order) => {
          if (!acc[order.order_id]) {
            acc[order.order_id] = { ...order, service_names: [], first_id: order.id };
          }
          acc[order.order_id].service_names.push(order.service_name || order.service_type);

          return acc;
        }, {});
        const groupedOrders = Object.values(grouped).map(o => ({
          ...o,
          id: o.first_id,
          service_name: o.service_names.join(', '),
          price: o.price
        }));
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
            <h3 className="text-center mb-4">Order Database</h3>
            <div className="table-container">
              <table className="table table-bordered text-center mb-0">
                <thead className="thead-light">
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Price (₱)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan="8" className="text-center">Loading orders...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const uniqueServices = [...new Set(orders.map(o => o.service_name || o.service_type).filter(Boolean))].sort();

  const filteredOrders = orders.filter(order => {
    const matchType = filterType === '' || (order.service_name && order.service_name === filterType);
    const matchStatus = filterStatus === '' || order.status === filterStatus;
    const matchDate = filterDate === '' || order.date === filterDate;
    return matchType && matchStatus && matchDate;
  });

  const handleDownloadReport = async () => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    
    const img = new Image();
    img.src = reportHeaderImg;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    
    doc.addImage(img, 'PNG', 0, 0, 210, 65);

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Order Database Report", 14, 75);
    doc.setFont("times", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 82);

    const tableColumn = ["Order ID", "Customer", "Service", "Pref. Date", "Status", "Team", "Price"];
    const tableRows = [];

    filteredOrders.forEach(order => {
      const orderData = [
        order.order_id || '-',
        formatName(order),
        order.service_name || order.service_type || '-',
        formatDate(order.date),
        order.status || '-',
        order.truck_team || 'Unassigned',
        order.price ? order.price.toString() : "-"
      ];
      tableRows.push(orderData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 90,
      styles: { fontSize: 8 },
      headStyles: { fillColor: '#0D8D1E' }
    });

    doc.save(`Order_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
          <h3 className="text-center mb-4">Order Database</h3>
          
          <div className="filters-container mb-3 d-flex gap-3 align-items-center flex-wrap">
            <select 
              className="form-select m-0" 
              style={{ width: '200px', height: '52px' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Filter by Service</option>
              {uniqueServices.map(service => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>
            <select 
              className="form-select m-0" 
              style={{ width: '200px', height: '52px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <input 
              type="date" 
              className="form-control m-0" 
              style={{ width: '200px', height: '52px' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            <button className="btn btn-secondary m-0 d-flex align-items-center justify-content-center" style={{ borderRadius: '10px', padding: '0 20px', height: '52px' }} onClick={() => { setFilterType(''); setFilterStatus(''); setFilterDate(''); }}>Clear Filters</button>
            <button className="btn btn-primary m-0 d-flex align-items-center justify-content-center ms-auto" style={{ borderRadius: '10px', padding: '0 20px', height: '52px', background: '#0D8D1E', border: 'none' }} onClick={handleDownloadReport}>
              <i className="fas fa-file-pdf me-2"></i> Download Report
            </button>
          </div>
          
          <div className="table-container">
            <table className="table table-bordered text-center mb-0">
              <thead className="thead-light">
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Pref. Date</th>
                  <th>Status</th>
                  <th>Truck Team</th>
                  <th>Final Price (₱)</th>
                  <th>Actions</th>
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
                      <td>{order.order_id}</td>
                      <td>{formatName(order)}</td>
                      <td>
                        {order.service_name || order.service_type}
                        {order.estimate_inputs && order.estimate_inputs.accessibility === 'difficult' && (
                          <div className="badge bg-danger mt-1 d-block"><i className="fas fa-exclamation-triangle me-1"></i>Requires Extension Hoses</div>
                        )}
                      </td>
                      <td>{formatDate(order.date)}</td>
                      <td className={`status-cell ${getStatusClass(order.status)}`}>
                        {order.status}
                        {order.request_type && (
                          <div className="small text-warning fw-bold mt-1">{order.request_type}</div>
                        )}
                      </td>
                      <td>{order.truck_team || 'Unassigned'}</td>
                      <td>{order.has_final_price ? '₱' + order.final_price : "-"}</td>
                      <td>
                      <button 
                        className="btn-edit" 
                        onClick={() => openEditModal(order)}
                        disabled={order.status === 'Cancelled'}
                        style={order.status === 'Cancelled' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                        Manage
                      </button>
                      <button 
                        className="btn-delete" 
                        onClick={() => requestDeleteOrder(order.id)}
                      >
                        Delete
                      </button>
                    </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="revenue-box">
          <h4>Total Revenue</h4>
          <div className="revenue-amount">₱{totalRevenue.toFixed(2)}</div>
        </div>
        
        {editModal.show && createPortal(
        <div className="side-drawer-overlay" onClick={closeEditModal}>
          <div className="side-drawer" onClick={e => e.stopPropagation()}>
            <div className="side-drawer-header">
              <h5 className="mb-0 text-dark fw-bold"><i className="fas fa-edit me-2" style={{color: '#0D8D1E'}}></i>Manage Order</h5>
              <button type="button" className="btn-close" onClick={closeEditModal}></button>
            </div>
            
            <div className="side-drawer-body p-0">
              <ul className="nav nav-tabs px-4 pt-3 bg-light border-bottom" style={{ gap: '5px' }}>
                <li className="nav-item">
                  <button className={`nav-link fw-bold ${activeTab === 'details' ? 'active border-bottom-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('details')} style={activeTab === 'details' ? { color: '#0D8D1E' } : {}}>Details</button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link fw-bold ${activeTab === 'quotation' ? 'active border-bottom-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('quotation')} style={activeTab === 'quotation' ? { color: '#0D8D1E' } : {}}>Quotation</button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link fw-bold ${activeTab === 'scheduling' ? 'active border-bottom-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('scheduling')} style={activeTab === 'scheduling' ? { color: '#0D8D1E' } : {}}>Scheduling</button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link fw-bold ${activeTab === 'documents' ? 'active border-bottom-0' : 'text-muted border-0 bg-transparent'}`} onClick={() => setActiveTab('documents')} style={activeTab === 'documents' ? { color: '#0D8D1E' } : {}}>Documents</button>
                </li>
              </ul>

              <div className="tab-content p-4">
                {activeTab === 'details' && (
                  <div className="row">
                    <div className="col-md-12">
                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Order Status</label>
                        <select 
                          name="status"
                          className="form-select bg-light border-0 shadow-sm"
                          value={editForm.status}
                          onChange={handleEditChange}
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
                          className="form-control bg-light border-0 shadow-sm" 
                          placeholder="Private notes (client will not see this)"
                          value={editForm.internal_notes}
                          onChange={handleEditChange}
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
                        >
                          <option value="">None</option>
                          <option value="Cancel Requested">Cancel Requested</option>
                          <option value="Reschedule Requested">Reschedule Requested</option>
                        </select>
                      </div>
                      
                      {editModal.order.request_type === 'Reschedule Requested' && editModal.order.reschedule_date && (
                        <div className="alert alert-warning border-0 shadow-sm p-3 mb-4">
                          <h6 className="fw-bold text-dark mb-2">
                            <i className="fas fa-calendar-alt me-2 text-warning"></i>
                            Reschedule Request Details ({editModal.order.reschedule_target === 'execution' ? 'Service Execution' : 'Site Inspection'})
                          </h6>
                          <div className="small mb-1"><strong>New Date:</strong> {formatDate(editModal.order.reschedule_date)}</div>
                          <div className="small mb-1"><strong>New Time:</strong> {editModal.order.reschedule_time_slot}</div>
                          <div className="small mb-3"><strong>Reason:</strong> {editModal.order.reschedule_reason}</div>
                          
                          <div className="d-flex gap-2">
                            <button className="btn btn-success btn-sm fw-bold w-100" onClick={() => submitRescheduleAction('approve_reschedule')} disabled={isSaving}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm fw-bold w-100" onClick={() => setRejectModalOpen(true)} disabled={isSaving}>
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {editModal.order.payment_method === 'cheque' && (
                        <div className="alert alert-secondary border-0 shadow-sm p-3 mb-4">
                          <h6 className="fw-bold text-dark mb-2"><i className="fas fa-money-check-alt me-2 text-primary"></i>Cheque Payment Details</h6>
                          <div className="small mb-1"><strong>Status:</strong> <span className={`badge ${editModal.order.cheque_status === 'approved' ? 'bg-success' : editModal.order.cheque_status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>{editModal.order.cheque_status?.replace('_', ' ').toUpperCase()}</span></div>
                          <div className="small mb-1"><strong>Bank:</strong> {editModal.order.cheque_issuing_bank || editModal.order.cheque_bank_name || 'N/A'}</div>
                          <div className="small mb-1"><strong>Cheque No:</strong> {editModal.order.cheque_number || 'N/A'}</div>
                          <div className="small mb-1"><strong>Account Name:</strong> {editModal.order.cheque_payer_name || editModal.order.cheque_account_name || 'N/A'}</div>
                          <div className="small mb-3"><strong>Amount:</strong> ₱{editModal.order.cheque_amount || '1100'}</div>
                          
                          {editModal.order.cheque_image_url && (
                            <div className="mb-3">
                              <a href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${editModal.order.cheque_image_url}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary fw-bold">
                                <i className="fas fa-image me-1"></i>View Cheque Image
                              </a>
                            </div>
                          )}

                          {editModal.order.cheque_status === 'pending_verification' && (
                            <div className="d-flex gap-2 pt-2 border-top">
                              <button className="btn btn-success btn-sm fw-bold w-100" onClick={() => handleVerifyCheque('approve')} disabled={isSaving}>
                                <i className="fas fa-check me-1"></i>Approve
                              </button>
                              <button className="btn btn-danger btn-sm fw-bold w-100" onClick={() => handleVerifyCheque('reject')} disabled={isSaving}>
                                <i className="fas fa-times me-1"></i>Reject
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {editModal.order.households && editModal.order.households.length > 0 && (
                        <div className="card border-0 shadow-sm p-3 mb-4 bg-light">
                          <h6 className="fw-bold text-dark mb-2">
                            <i className="fas fa-users me-2 text-success"></i>Participating Households ({editModal.order.num_households || editModal.order.households.length})
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
                              className="table table-sm bg-white mb-0 small" 
                              style={{ 
                                borderCollapse: 'separate', 
                                borderSpacing: 0, 
                                width: '100%',
                                marginBottom: 0
                              }}
                            >
                              <thead className="table-light">
                                <tr>
                                  <th 
                                    style={{ 
                                      width: '40px', 
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
                                      borderBottom: '1px solid #dee2e6', 
                                      borderRight: '1px solid #dee2e6',
                                      borderTop: 'none' 
                                    }}
                                    className="px-2 py-1"
                                  >
                                    Name
                                  </th>
                                  <th 
                                    style={{ 
                                      borderTopRightRadius: '7px', 
                                      borderBottom: '1px solid #dee2e6', 
                                      borderTop: 'none', 
                                      borderRight: 'none' 
                                    }}
                                    className="px-2 py-1"
                                  >
                                    Address
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {editModal.order.households.map((h, i) => {
                                  const isLast = i === editModal.order.households.length - 1;
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
                                          borderRight: '1px solid #dee2e6'
                                        }}
                                      >
                                        {h.name} {i === 0 && <span className="badge bg-success ms-1">Lead</span>}
                                      </td>
                                      <td 
                                        className="px-2 py-1" 
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
                    </div>
                  </div>
                )}

                {activeTab === 'quotation' && (
                  <div className="row">
                    <div className="col-md-12">
                      <div className="alert alert-info border-0 shadow-sm p-3 mb-4 small">
                        <i className="fas fa-info-circle me-2"></i>
                        Build the hierarchical quotation based on inspection findings. This will be sent to the client for approval.
                      </div>
                      <div className="mb-3 d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-dark">Quotation Status: </span>
                        <span className={`badge ${editModal.order.quotation_status === 'Approved' ? 'bg-success' : editModal.order.quotation_status === 'Clarification Requested' ? 'bg-warning text-dark' : editModal.order.quotation_status === 'Client Declined' ? 'bg-danger' : 'bg-secondary'}`}>{editModal.order.quotation_status || 'Pending Inspection'}</span>
                      </div>
                      
                      {editModal.order.service_ids && editModal.order.service_ids.map(serviceId => {
                        const service = services.find(s => s.id === serviceId || s._id === serviceId);
                        if (!service) return null;
                        const name = service.name.toLowerCase();
                        return (
                          <div key={serviceId} className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-light border-0 py-3">
                              <h6 className="mb-0 fw-bold text-success">{service.name}</h6>
                            </div>
                            <div className="card-body bg-white pt-3 pb-3 px-4">
                              {name.includes('siphon') || name.includes('desludg') ? (
                                <>
                                  <div className="form-group mb-3">
                                      <label className="form-label small mb-1 fw-bold">Number of Septic Tanks</label>
                                      <div className="d-flex gap-2">
                                        <input type="number" className="form-control form-control-sm" style={{flex: 1}} value={quotationForm.estimate_inputs[serviceId]?.numTanks || '1'} onChange={(e) => handleQuotationInputChange(serviceId, 'numTanks', e.target.value)} />
                                        <input type="text" className="form-control form-control-sm" style={{flex: 2}} placeholder="Reason (e.g. Found hidden tank)" value={quotationForm.justifications[serviceId]?.numTanks || ''} onChange={(e) => handleJustificationChange(serviceId, 'numTanks', e.target.value)} />
                                      </div>
                                  </div>
                                  <div className="form-group mb-3">
                                      <label className="form-label small mb-1 fw-bold">Estimated Tank Capacity / Type</label>
                                      <div className="d-flex gap-2">
                                        <select className="form-select form-select-sm" style={{flex: 1}} value={quotationForm.estimate_inputs[serviceId]?.capacityType || '1'} onChange={(e) => handleQuotationInputChange(serviceId, 'capacityType', e.target.value)}>
                                            <option value="1">Standard (1 Trip)</option>
                                            <option value="2">Large (2+ Trips)</option>
                                        </select>
                                        <input type="text" className="form-control form-control-sm" style={{flex: 1}} placeholder="Reason" value={quotationForm.justifications[serviceId]?.capacityType || ''} onChange={(e) => handleJustificationChange(serviceId, 'capacityType', e.target.value)} />
                                      </div>
                                  </div>
                                  <div className="form-group mb-0">
                                      <label className="form-label small mb-1 fw-bold">Site Accessibility</label>
                                      <div className="d-flex gap-2">
                                        <select className="form-select form-select-sm" style={{flex: 1}} value={quotationForm.estimate_inputs[serviceId]?.accessibility || 'easy'} onChange={(e) => handleQuotationInputChange(serviceId, 'accessibility', e.target.value)}>
                                            <option value="easy">Easy (10-20m)</option>
                                            <option value="difficult">Difficult (Long hoses)</option>
                                        </select>
                                        <input type="text" className="form-control form-control-sm" style={{flex: 1}} placeholder="Reason" value={quotationForm.justifications[serviceId]?.accessibility || ''} onChange={(e) => handleJustificationChange(serviceId, 'accessibility', e.target.value)} />
                                      </div>
                                  </div>
                                </>
                              ) : name.includes('deep clean') || name.includes('declog') ? (
                                <div className="form-group mb-0">
                                    <label className="form-label small mb-1 fw-bold">Number of Septic Tanks</label>
                                    <div className="d-flex gap-2">
                                      <input type="number" className="form-control form-control-sm" style={{flex: 1}} value={quotationForm.estimate_inputs[serviceId]?.numTanks || '1'} onChange={(e) => handleQuotationInputChange(serviceId, 'numTanks', e.target.value)} />
                                      <input type="text" className="form-control form-control-sm" style={{flex: 2}} placeholder="Reason" value={quotationForm.justifications[serviceId]?.numTanks || ''} onChange={(e) => handleJustificationChange(serviceId, 'numTanks', e.target.value)} />
                                    </div>
                                </div>
                              ) : (
                                <div className="text-muted small">Fixed price service (₱{service.base_price || 0}).</div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div className="card shadow-sm border mb-4" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-bold text-secondary">Estimated Total Trips:</span>
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
                            <span className="fw-bold text-secondary">Total (Before Discount):</span>
                            <span className="fw-bold text-dark">₱{quotationSubtotal.toLocaleString()}</span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-bold text-secondary">Discount Applied (₱):</span>
                            <input type="number" className="form-control form-control-sm text-end shadow-sm" style={{ width: '120px', borderColor: '#86efac' }} value={quotationForm.discount_amount} onChange={(e) => setQuotationForm(prev => ({ ...prev, discount_amount: e.target.value }))} />
                          </div>
                          <hr className="my-2" style={{ borderColor: '#86efac' }} />
                          <div className="d-flex justify-content-between align-items-center mt-2">
                            <span className="fw-bold text-dark">Final Quotation Total:</span>
                            <span className="fw-bold" style={{ color: '#166534', fontSize: '1.25rem' }}>₱{quotationTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button className="btn btn-success w-100 rounded-pill fw-bold shadow-sm p-3 mb-2" onClick={handleSubmitQuotation} disabled={isSaving}>
                        {isSaving ? 'Submitting...' : 'Send Quotation to Client'}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'scheduling' && (
                  <div className="row">
                    <div className="col-md-12">
                      <h6 className="fw-bold text-primary mb-3"><i className="fas fa-search me-2"></i>Inspection Scheduling</h6>
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
                              className="form-control bg-white border-0 shadow-sm" 
                              value={editForm.confirmed_date}
                              onChange={handleEditChange}
                            />
                          </div>
                          <div className="form-group mb-0">
                            <label className="form-label fw-bold small text-muted">Confirmed Inspection Time Slot</label>
                            <input 
                              type="text" 
                              name="confirmed_time_slot"
                              className="form-control bg-white border-0 shadow-sm" 
                              placeholder="e.g. 08:00 AM - 10:00 AM"
                              value={editForm.confirmed_time_slot}
                              onChange={handleEditChange}
                            />
                          </div>
                        </div>
                      </div>

                      {editModal.order.quotation_status === 'Approved' && (
                        <>
                          <h6 className="fw-bold text-success mb-3"><i className="fas fa-truck-loading me-2"></i>Service Execution Scheduling</h6>
                          <div className="card shadow-sm border-success border-opacity-25 mb-4" style={{ backgroundColor: '#f0fdf4' }}>
                            <div className="card-body">
                              <div className="form-group mb-3">
                                <label className="form-label fw-bold small text-secondary">Service Execution Date</label>
                                <input 
                                  type="date" 
                                  className="form-control shadow-sm" 
                                  value={editModal.order.service_execution_date ? editModal.order.service_execution_date.split('T')[0] : ''} 
                                  readOnly
                                />
                                <small className="text-muted mt-1 d-block">Auto-confirmed by client</small>
                              </div>
                              <div className="form-group mb-3">
                                <label className="form-label fw-bold small text-secondary">Service Execution Time Slot</label>
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
                                    <label className="form-label fw-bold small text-secondary mb-0">
                                      Assign 2 Vacuum Trucks <span className="badge bg-danger ms-1">Whole-Day (5+ Trips)</span>
                                    </label>
                                    {selectedHighCapTrucks.length === 2 ? (
                                      <span className="badge bg-success"><i className="fas fa-check-circle me-1"></i>2 Trucks Selected</span>
                                    ) : (
                                      <span className="badge bg-warning text-dark"><i className="fas fa-exclamation-circle me-1"></i>{selectedHighCapTrucks.length}/2 Selected</span>
                                    )}
                                  </div>

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

                                        return (
                                          <div 
                                            key={(typeof team === 'object' && team.id) || idx}
                                            className={`d-flex align-items-center justify-content-between p-2 px-3 rounded border ${isChecked ? 'bg-success bg-opacity-10 border-success' : 'border-light-subtle'}`}
                                            style={{ opacity: !isAvailable ? 0.6 : 1 }}
                                          >
                                            <div className="form-check mb-0 d-flex align-items-center">
                                              <input
                                                className="form-check-input me-2 mt-0"
                                                type="checkbox"
                                                id={`truck-team-cb-${idx}`}
                                                checked={isChecked}
                                                disabled={!isAvailable}
                                                onChange={() => handleToggleHighCapacityTruck(teamName)}
                                                style={{ cursor: isAvailable ? 'pointer' : 'not-allowed' }}
                                              />
                                              <label className="form-check-label fw-bold text-dark mb-0" htmlFor={`truck-team-cb-${idx}`} style={{ cursor: isAvailable ? 'pointer' : 'not-allowed' }}>
                                                <i className="fas fa-truck me-2 text-success"></i>
                                                {teamName}
                                              </label>
                                            </div>
                                            <span className={`badge ${isAvailable ? (isChecked ? 'bg-success' : 'bg-secondary') : 'bg-danger'}`} style={{ fontSize: '0.72rem' }}>
                                              {!isAvailable ? 'Unavailable (Maintenance)' : isChecked ? 'Assigned' : 'Available'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {operationalTrucks.length >= 2 && selectedHighCapTrucks.length !== 2 && (
                                      <div className="mt-2 text-end">
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm text-decoration-none p-0 text-success fw-bold"
                                          onClick={handleAutoAssignTwoTrucks}
                                        >
                                          <i className="fas fa-magic me-1"></i>Auto-Select {operationalTrucks.length === 2 ? 'Both Available Trucks' : 'First 2 Available Trucks'}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-2 small text-muted">
                                    Current Assignment: <strong>{editForm.truck_team || 'None (Unassigned)'}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="form-group mb-0">
                                  <label className="form-label fw-bold small text-secondary">Assign Truck Team</label>
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
                                          disabled={!isAvailable && editForm.truck_team !== teamName}
                                        >
                                          {teamName} {!isAvailable ? '(Unavailable - Maintenance)' : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <small className="text-muted mt-1 d-block">Assign a team to deploy on the execution date.</small>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="row">
                    <div className="col-md-12">
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
                      
                      <div className="alert alert-info mt-4 small border-0 shadow-sm">
                        <i className="fas fa-info-circle me-2"></i>
                        Uploaded documents will be immediately visible on the client's dashboard under this order.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="side-drawer-footer">
              <button 
                type="button" 
                className="btn btn-light rounded-pill px-4 fw-bold shadow-sm" 
                onClick={closeEditModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-success rounded-pill px-4 fw-bold shadow-sm" 
                onClick={handleSaveChangesClick}
                disabled={isSaving}
                style={{ display: activeTab === 'quotation' ? 'none' : 'block' }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
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
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value)}
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
