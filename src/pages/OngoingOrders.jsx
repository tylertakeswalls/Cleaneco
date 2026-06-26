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
  const navigate = useNavigate();
  const loggedInUser = sessionStorage.getItem("loggedInUser");
  const userId = sessionStorage.getItem("userId");

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
        const response = await api.get(`/read.php?type=user_orders&id=${userId}`);
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
    const discount = order.discount_amount ? parseFloat(order.discount_amount) : 0;
    const total = basePrice - discount;
    
    // Table
    autoTable(doc, {
        startY: 85,
        head: [['Description', 'Amount']],
        body: [
            ['Base Service Fee', `PHP ${basePrice.toFixed(2)}`],
            ...(discount > 0 ? [['Senior Citizen Discount (20%)', `- PHP ${discount.toFixed(2)}`]] : []),
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
                      <td className={getStatusClass(order.status)}>{order.status}</td>
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
    </div>
  );
}

export default OngoingOrders;