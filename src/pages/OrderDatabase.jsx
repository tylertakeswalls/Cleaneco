import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import '../assets/styles/orderdatabase.css';
import carousel7 from '../assets/styles/images/carousell7.png';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

function OrderDatabase() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [editModal, setEditModal] = useState({ show: false, order: null });
  const [editForm, setEditForm] = useState({ status: '', price: '', request_type: '', approval_fee: '' });
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmModalConfig, setConfirmModalConfig] = useState({ isOpen: false, title: '', message: '', orderId: null });
  
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  const navigate = useNavigate();

  const showAlert = (title, message, type = 'info') => {
      setModalConfig({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
      setModalConfig(prev => ({ ...prev, isOpen: false }));
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

  const calculateRevenue = (ordersData) => {
    const total = ordersData.reduce((sum, order) => {
      const price = parseFloat(order.price) || 0;
      return order.status === 'Completed' ? sum + price : sum;
    }, 0);
    setTotalRevenue(total);
  };
  
  const requestDeleteOrder = (id) => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Confirm Deletion",
      message: "⚠️ Are you sure you want to delete this order?",
      orderId: id
    });
  };

  const confirmDeleteOrder = async () => {
    const id = confirmModalConfig.orderId;
    setConfirmModalConfig({ isOpen: false, title: '', message: '', orderId: null });

    try {
      const response = await api.delete('/delete.php', {
        data: { type: 'order', id }
      });

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
  };

  const cancelDeleteOrder = () => {
    setConfirmModalConfig({ isOpen: false, title: '', message: '', orderId: null });
  };


  useEffect(() => {
    const loggedInUser = sessionStorage.getItem("loggedInUser");
    const userRole = sessionStorage.getItem("userRole");
    
    if (!loggedInUser || userRole !== "admin") {
      navigate('/login');
      return;
    }
    
    const loadOrders = async () => {
      try {
        const response = await api.get('/read.php?type=orders');
        
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
        setLoading(false);
      } catch (error) {
        console.error("Error loading orders:", error);
        setLoading(false);
      }
    };

    loadOrders();
  }, [navigate]);

  const getStatusClass = (status) => {
    const statusClasses = {
      "Completed": "completed-text",
      "In Progress": "in-progress-text", 
      "Cancelled": "cancelled-text"
    };
    return statusClasses[status] || "pending-text";
  };

  const openEditModal = (order) => {
    setEditModal({ show: true, order });
    setEditForm({
      status: order.status || '',
      price: order.price || '',
      request_type: order.request_type || '',
      approval_fee: order.approval_fee || ''
    });
  };

  const closeEditModal = () => {
    setEditModal({ show: false, order: null });
    setEditForm({ status: '', price: '', request_type: '', approval_fee: '' });
  };

  const handleEditChange = (e) => {
    setEditForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const saveOrderChanges = async () => {
    if (!editModal.order) return;

    try {
      const response = await api.put('/update.php', {
        type: 'order',
        id: editModal.order.id,
        status: editForm.status,
        price: editForm.price,
        request_type: editForm.request_type,
        approval_fee: editForm.approval_fee
      });

      if (response.data && response.data.message) {
        const updatedOrders = orders.map(order => 
          order.id === editModal.order.id 
            ? { ...order, status: editForm.status, price: editForm.price, request_type: editForm.request_type, approval_fee: editForm.approval_fee }
            : order
        );
        setOrders(updatedOrders);
        calculateRevenue(updatedOrders);
        closeEditModal();
        showAlert("Success", "Order updated successfully!", "success");
      } else {
        showAlert("Error", "Error updating order.", "error");
      }
    } catch (error) {
      console.error("Error updating order:", error);
      showAlert("Error", "Error updating order.", "error");
    }
  };

  if (loading) {
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
                    <th>Discount / ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan="9" className="text-center">Loading orders...</td></tr>
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
    <div>
      <AlertModal 
          isOpen={modalConfig.isOpen} 
          title={modalConfig.title} 
          message={modalConfig.message} 
          type={modalConfig.type} 
          onClose={closeAlert} 
      />
      <ConfirmModal
          isOpen={confirmModalConfig.isOpen}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          onConfirm={confirmDeleteOrder}
          onCancel={cancelDeleteOrder}
      />
      <img className="img-fluid banner-img" src={carousel7} alt="Banner" />
    
      <section className="section-bg">
        <div className="table-box">
          <h3 className="text-center mb-4">Order Database</h3>
          
          <div className="filters-container mb-3 d-flex gap-3 justify-content-center flex-wrap">
            <select 
              className="form-control" 
              style={{ width: '200px' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Filter by Service</option>
              {uniqueServices.map(service => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>
            <select 
              className="form-control" 
              style={{ width: '200px' }}
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
              className="form-control" 
              style={{ width: '200px' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            <button className="btn btn-secondary" onClick={() => { setFilterType(''); setFilterStatus(''); setFilterDate(''); }}>Clear Filters</button>
          </div>
          
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
                  <th>Discount / ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan="9" className="text-center">No orders found.</td></tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.order_id}</td>
                      <td>{order.first_name} {order.last_name}</td>
                      <td>{order.service_name || order.service_type}</td>
                      <td>{formatDate(order.date)}</td>
                      <td>{order.time_slot}</td>
                      <td className={`status-cell ${getStatusClass(order.status)}`}>
                        {order.status}
                        {order.request_type && (
                          <div className="small text-warning fw-bold mt-1">{order.request_type}</div>
                        )}
                        {order.approval_fee > 0 && (
                          <div className="small text-danger fw-bold mt-1">Fee: ₱{parseFloat(order.approval_fee).toFixed(2)}</div>
                        )}
                      </td>
                      <td>{order.price ? '₱' + order.price : "-"}</td>
                      <td>
                        {order.discount_amount > 0 ? (
                            <div className="d-flex flex-column align-items-center">
                                <span className="badge bg-success mb-1">-₱{order.discount_amount}</span>
                                {order.senior_card_image && (
                                    <a href={`http://localhost/firstapp/php-backend/${order.senior_card_image}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-success p-1" style={{ fontSize: '0.75rem' }}>
                                        View ID
                                    </a>
                                )}
                            </div>
                        ) : "-"}
                      </td>
                     <td>
                      <button 
                        className="btn-edit" 
                        onClick={() => openEditModal(order)}
                      >
                        Edit
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
      </section>

      {editModal.show && (
        <div className="modal-backdrop show">
          <div className="modal d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-body">
                  <h5 className="text-center font-weight-bold mb-3">Edit Order</h5>
                  <p className="text-muted text-center mb-4">Update order status or set a price.</p>

                  <form>
                    <div className="form-group">
                      <label>Status</label>
                      <select 
                        name="status"
                        className="form-control"
                        value={editForm.status}
                        onChange={handleEditChange}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Price (₱)</label>
                      <input 
                        type="number" 
                        name="price"
                        className="form-control" 
                        placeholder="Enter price"
                        value={editForm.price}
                        onChange={handleEditChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Request Type</label>
                      <select 
                        name="request_type"
                        className="form-control"
                        value={editForm.request_type}
                        onChange={handleEditChange}
                      >
                        <option value="">None</option>
                        <option value="Cancel Requested">Cancel Requested</option>
                        <option value="Reschedule Requested">Reschedule Requested</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Approval Fee (₱)</label>
                      <input 
                        type="number" 
                        name="approval_fee"
                        className="form-control" 
                        placeholder="Enter approval fee"
                        value={editForm.approval_fee}
                        onChange={handleEditChange}
                      />
                    </div>
                  </form>

                  <div className="text-center mt-4">
                    <button 
                      type="button" 
                      className="btn btn-light mr-2" 
                      onClick={closeEditModal}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-success" 
                      onClick={saveOrderChanges}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderDatabase;