import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import '../assets/styles/orderdatabase.css';
import carousel7 from '../assets/styles/images/carousell7.png';

function OrderDatabase() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [editModal, setEditModal] = useState({ show: false, order: null });
  const [editForm, setEditForm] = useState({ status: '', price: '' });
  
  const navigate = useNavigate();

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
  
  const handleDeleteOrder = async (id) => {
  if (!window.confirm("⚠️ Are you sure you want to delete this order?")) return;

  try {
    const response = await api.delete('/delete.php', {
      data: { type: 'order', id }
    });

    if (response.data.success) {
      const updatedOrders = orders.filter(order => order.id !== id);
      setOrders(updatedOrders);
      calculateRevenue(updatedOrders);
      alert("✅ Order deleted successfully!");
    } else {
      alert("⚠️ " + response.data.message);
    }
  } catch (error) {
    console.error("Error deleting order:", error);
    alert("⚠️ Failed to delete order.");
  }
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
        setOrders(response.data);
        calculateRevenue(response.data);
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
      price: order.price || ''
    });
  };

  const closeEditModal = () => {
    setEditModal({ show: false, order: null });
    setEditForm({ status: '', price: '' });
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
        price: editForm.price
      });

      if (response.data && response.data.message) {
        const updatedOrders = orders.map(order => 
          order.id === editModal.order.id 
            ? { ...order, status: editForm.status, price: editForm.price }
            : order
        );
        setOrders(updatedOrders);
        calculateRevenue(updatedOrders);
        closeEditModal();
        alert("✅ Order updated successfully!");
      } else {
        alert("⚠️ Error updating order.");
      }
    } catch (error) {
      console.error("Error updating order:", error);
      alert("⚠️ Error updating order.");
    }
  };

  if (loading) {
    return (
      <div>
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
                  <tr><td colSpan="8" className="text-center">Loading orders...</td></tr>
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
                {orders.length === 0 ? (
                  <tr><td colSpan="8" className="text-center">No orders found.</td></tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.order_id}</td>
                      <td>{order.first_name} {order.last_name}</td>
                      <td>{order.service_name || order.service_type}</td>
                      <td>{formatDate(order.date)}</td>
                      <td>{order.time_slot}</td>
                      <td className={`status-cell ${getStatusClass(order.status)}`}>
                        {order.status}
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
                        onClick={() => handleDeleteOrder(order.id)}
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