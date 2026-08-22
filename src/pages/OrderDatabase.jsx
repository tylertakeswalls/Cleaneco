import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import '../assets/styles/orderdatabase.css';
import carousel7 from '../assets/styles/images/carousell7.png';
import AlertModal from '../components/AlertModal';
import { formatDate, getStatusClass } from '../utils/helpers';
import { useConfirm } from '../context/ConfirmContext';
import { useRef } from 'react';

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
  const [quotationFile, setQuotationFile] = useState(null);
  const [serviceReportFile, setServiceReportFile] = useState(null);
  
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [truckTeams, setTruckTeams] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const navigate = useNavigate();

  const showAlert = (title, message, type = 'info') => {
      setModalConfig({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
      setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const calculateRevenue = (ordersData) => {
    const total = ordersData.reduce((sum, order) => {
      const price = parseFloat(order.price) || 0;
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
        const [ordersRes, settingsRes] = await Promise.all([
          api.get('/orders'),
          api.get('/settings/truck-teams').catch(() => ({ data: { truck_teams: [] } }))
        ]);
        
        if (settingsRes.data && settingsRes.data.truck_teams) {
          setTruckTeams(settingsRes.data.truck_teams);
        }

        const grouped = ordersRes.data.reduce((acc, order) => {
          if (!acc[order.order_id]) {
            acc[order.order_id] = { ...order, service_names: [], total_price: 0, first_id: order.id };
          }
          acc[order.order_id].service_names.push(order.service_name || order.service_type);
          acc[order.order_id].total_price += parseFloat(order.price || 0);
          return acc;
        }, {});
        
        const groupedOrders = Object.values(grouped).map(o => ({
          ...o,
          id: o.first_id,
          service_name: o.service_names.join(', '),
          price: o.total_price > 0 ? o.total_price.toFixed(2) : ''
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

  const openEditModal = (order) => {
    setEditModal({ show: true, order });
    setEditForm({
      status: order.status || '',
      price: order.price || '',
      request_type: order.request_type || '',
      approval_fee: order.approval_fee || '',
      confirmed_date: order.confirmed_date ? new Date(order.confirmed_date).toISOString().split('T')[0] : '',
      confirmed_time_slot: order.confirmed_time_slot || '',
      truck_team: order.truck_team || '',
      misc_fee: order.misc_fee || '',
      internal_notes: order.internal_notes || ''
    });
    setQuotationFile(null);
    setServiceReportFile(null);
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
        misc_fee: editForm.misc_fee,
        internal_notes: editForm.internal_notes,
        final_price: (editModal.order.base_estimate || 0) + (parseFloat(editForm.misc_fee) || 0),
        price: (editModal.order.base_estimate || 0) + (parseFloat(editForm.misc_fee) || 0)
      });

      // 2. Upload documents if any
      if (quotationFile || serviceReportFile) {
        const formData = new FormData();
        if (quotationFile) formData.append('quotation', quotationFile);
        if (serviceReportFile) formData.append('service_report', serviceReportFile);

        await api.post(`/orders/${editModal.order.id}/upload-documents`, formData);
      }

      // 3. Reload orders to get updated URLs
      const response = await api.get('/orders');
      const grouped = response.data.reduce((acc, order) => {
        if (!acc[order.order_id]) {
          acc[order.order_id] = { ...order, service_names: [], total_price: 0, first_id: order.id };
        }
        acc[order.order_id].service_names.push(order.service_name || order.service_type);
        acc[order.order_id].total_price += parseFloat(order.price || 0);
        return acc;
      }, {});
      
      const groupedOrders = Object.values(grouped).map(o => ({
        ...o,
        id: o.first_id,
        service_name: o.service_names.join(', '),
        price: o.total_price > 0 ? o.total_price.toFixed(2) : ''
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
                      <td>{order.first_name} {order.last_name}</td>
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
                      <td>{order.price ? '₱' + order.price : "-"}</td>
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
                        <label className="form-label fw-bold small text-muted">Base Estimate (₱)</label>
                        <input 
                          type="number" 
                          className="form-control bg-light border-0 shadow-sm" 
                          value={editModal.order?.base_estimate || 0} 
                          readOnly 
                        />
                      </div>

                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Misc Fee (₱)</label>
                        <input 
                          type="number" 
                          name="misc_fee"
                          className="form-control bg-light border-0 shadow-sm" 
                          value={editForm.misc_fee} 
                          onChange={handleEditChange}
                        />
                      </div>
                      
                      <div className="alert alert-success border-0 shadow-sm p-3 mb-4">
                        <small className="fw-bold d-block text-success mb-1">Calculated Final Price (+10% Tax):</small>
                        <h4 className="mb-0 fw-bold text-success">
                          ₱ {Math.round(((editModal.order?.base_estimate || 0) + Number(editForm.misc_fee)) * 1.10).toLocaleString()}
                        </h4>
                        <div className="mt-1 small">
                          Balance to pay: ₱ {Math.max(0, Math.round(((editModal.order?.base_estimate || 0) + Number(editForm.misc_fee)) * 1.10) - 1100).toLocaleString()}
                        </div>
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
                    </div>
                  </div>
                )}

                {activeTab === 'scheduling' && (
                  <div className="row">
                    <div className="col-md-12">
                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Confirmed Date</label>
                        <input 
                          type="date" 
                          name="confirmed_date"
                          className="form-control bg-light border-0 shadow-sm" 
                          value={editForm.confirmed_date}
                          onChange={handleEditChange}
                        />
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Confirmed Time Slot</label>
                        <input 
                          type="text" 
                          name="confirmed_time_slot"
                          className="form-control bg-light border-0 shadow-sm" 
                          placeholder="e.g. 08:00 AM - 10:00 AM"
                          value={editForm.confirmed_time_slot}
                          onChange={handleEditChange}
                        />
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Assign Truck Team</label>
                        <select 
                          name="truck_team"
                          className="form-select bg-light border-0 shadow-sm"
                          value={editForm.truck_team}
                          onChange={handleEditChange}
                        >
                          <option value="">-- Select a Team --</option>
                          {truckTeams.map(team => (
                            <option key={team} value={team}>{team}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group mb-3">
                        <label className="form-label fw-bold small text-muted">Service Date</label>
                        <input 
                          type="date" 
                          className="form-control bg-light border-0 shadow-sm" 
                          value={editModal.order?.date?.split('T')[0] || ''} 
                          readOnly
                        />
                        <small className="text-muted mt-1 d-block">Client preferred date</small>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="row">
                    <div className="col-md-12">
                      <div className="form-group mb-4">
                        <label className="form-label fw-bold small text-muted">Upload Quotation (Approved P.O.)</label>
                        <input 
                          type="file" 
                          accept=".pdf"
                          className="form-control bg-light border-0 shadow-sm"
                          onChange={(e) => setQuotationFile(e.target.files[0])}
                        />
                        {editModal.order.quotation_pdf_url && (
                          <div className="mt-2 small">
                            <a href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${editModal.order.quotation_pdf_url}`} target="_blank" rel="noopener noreferrer" className="text-success text-decoration-none fw-bold">
                              <i className="fas fa-file-pdf me-1"></i>View Current Quotation
                            </a>
                          </div>
                        )}
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
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
      </section>
    </div>
  );
}

export default OrderDatabase;