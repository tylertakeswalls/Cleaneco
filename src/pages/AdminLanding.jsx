import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import api from '../api/axiosConfig';
import '../assets/styles/admin.css';
import AdminCalendar from '../components/AdminCalendar';


function AdminLanding() {
  // state for dashboard statistics and metrics
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    completedOrders: 0,
    inProgressOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    totalServices: 0,
    availableServices: 0
  });

  // state to store all orders data from the database
  const [allOrders, setAllOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifTray, setShowNotifTray] = useState(false);
  const navigate = useNavigate();

  // chart canvas references
  const statusChartRef = useRef(null);
  const serviceChartRef = useRef(null);
  const lineChartRef = useRef(null);

  // chart instances for cleanup
  const statusChartInstance = useRef(null);
  const serviceChartInstance = useRef(null);
  const lineChartInstance = useRef(null);

  // check admin authentication on component mount
  useEffect(() => {
    const loggedInUser = sessionStorage.getItem("loggedInUser");
    const userRole = sessionStorage.getItem("userRole");

    if (!loggedInUser || userRole !== "admin") {
      navigate('/login');
      return;
    }

    loadDashboardData();
    loadNotifications();
  }, [navigate]);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/read.php?type=notifications');
      const data = response.data || [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.put('/update.php', {
          type: 'notifications_read',
          id: notif.id
        });
        loadNotifications();
      } catch (error) {
        console.error("Error marking notification read:", error);
      }
    }
    setShowNotifTray(false);
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.put('/update.php', {
        type: 'notifications_read'
      });
      loadNotifications();
    } catch (error) {
      console.error("Error marking all notifications read:", error);
    }
  };

  // handle chart rendering when orders data changes
  useEffect(() => {
    const renderCharts = () => {
      // count orders by status for the doughnut chart
      const statusCounts = allOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

      // count orders by service type for the bar chart
      const serviceCounts = allOrders.reduce((acc, order) => {
        acc[order.service_name] = (acc[order.service_name] || 0) + 1;
        return acc;
      }, {});

      // calculate daily revenue for completed orders
      const dailyRevenue = allOrders.reduce((acc, order) => {
        if (order.status === "Completed") {
          const d = order.date;
          const price = parseFloat(String(order.price || '').replace(/[₱,]/g, '').trim()) || 0;
          acc[d] = (acc[d] || 0) + price;
        }
        return acc;
      }, {});

      const sortedDates = Object.keys(dailyRevenue).sort();
      const revenueValues = sortedDates.map(date => dailyRevenue[date]);

      // clean up existing chart instances before creating new ones
      if (statusChartInstance.current) {
        statusChartInstance.current.destroy();
      }
      if (serviceChartInstance.current) {
        serviceChartInstance.current.destroy();
      }
      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }

      // create orders status doughnut chart
      const statusCtx = statusChartRef.current?.getContext('2d');
      if (statusCtx) {
        statusChartInstance.current = new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
            datasets: [{
              data: [
                statusCounts['Pending'] || 0,
                statusCounts['In Progress'] || 0,
                statusCounts['Completed'] || 0,
                statusCounts['Cancelled'] || 0
              ],
              backgroundColor: ['#ffc107', '#007bff', '#0D8D1E', '#dc3545'],
              hoverBackgroundColor: ['#e0a800', '#0056b3', '#0A6F17', '#c82333'],
              borderWidth: 2,
              borderColor: '#fff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  padding: 20,
                  usePointStyle: true,
                  font: {
                    size: 12
                  }
                }
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    const label = context.label || '';
                    const value = context.raw || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = Math.round((value / total) * 100);
                    return `${label}: ${value} (${percentage}%)`;
                  }
                }
              }
            },
            animation: {
              animateScale: true,
              animateRotate: true
            }
          }
        });
      }

      // create service type bar chart
      const serviceCtx = serviceChartRef.current?.getContext('2d');
      if (serviceCtx) {
        const serviceNames = Object.keys(serviceCounts);
        const serviceValues = Object.values(serviceCounts);

        // Generate colors for each service
        const backgroundColors = serviceNames.map((_, index) => {
          const colors = ['#0D8D1E', '#20c997', '#17a2b8', '#6f42c1', '#fd7e14'];
          return colors[index % colors.length];
        });

        serviceChartInstance.current = new Chart(serviceCtx, {
          type: 'bar',
          data: {
            labels: serviceNames,
            datasets: [{
              label: 'Number of Orders',
              data: serviceValues,
              backgroundColor: backgroundColors,
              borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
              borderWidth: 1,
              borderRadius: 4,
              borderSkipped: false,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return `Orders: ${context.raw}`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1,
                  precision: 0
                },
                grid: {
                  drawBorder: false
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          }
        });
      }

      // create revenue trend line chart
      const lineCtx = lineChartRef.current?.getContext('2d');
      if (lineCtx) {
        lineChartInstance.current = new Chart(lineCtx, {
          type: 'line',
          data: {
            labels: sortedDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
              label: 'Completed Revenue',
              data: revenueValues,
              borderColor: '#0D8D1E',
              backgroundColor: 'rgba(13, 141, 30, 0.05)',
              fill: true,
              tension: 0.3,
              borderWidth: 3,
              pointBackgroundColor: '#0D8D1E',
              pointRadius: 4,
              pointHoverRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return `Revenue: ₱${parseFloat(context.raw).toFixed(2)}`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function (value) {
                    return '₱' + value;
                  }
                },
                grid: {
                  drawBorder: false
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          }
        });
      }
    };

    // render charts only when we have order data
    if (allOrders.length > 0) {
      renderCharts();
    }

    // cleanup function to destroy charts when component unmounts
    return () => {
      if (statusChartInstance.current) {
        statusChartInstance.current.destroy();
      }
      if (serviceChartInstance.current) {
        serviceChartInstance.current.destroy();
      }
      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }
    };
  }, [allOrders]);

  // load dashboard data from the PHP backend
  const loadDashboardData = async () => {
    try {
      // Fetch orders data
      const ordersResponse = await api.get('/read.php?type=orders');
      const ordersData = ordersResponse.data;
      setAllOrders(ordersData);

      // Fetch services data
      const servicesResponse = await api.get('/services.php');
      const servicesData = servicesResponse.data;

      let totalRevenue = 0;
      let pending = 0;
      let inProgress = 0;
      let completed = 0;
      let cancelled = 0;

      // process each order to calculate metrics
      ordersData.forEach(order => {
        const cleanedPriceString = String(order.price || '')
          .replace(/[₱,]/g, '')
          .trim();

        const price = parseFloat(cleanedPriceString);

        // only count revenue from completed orders
        if (!isNaN(price) && order.status === "Completed") {
          totalRevenue += price;
        }

        // count orders by status
        switch (order.status) {
          case "Pending":
            pending++;
            break;
          case "In Progress":
            inProgress++;
            break;
          case "Completed":
            completed++;
            break;
          case "Cancelled":
            cancelled++;
            break;
          default:
            break;
        }
      });

      // Calculate services statistics
      const totalServices = servicesData.length;
      const availableServices = servicesData.filter(service => service.status === 'available').length;

      // update dashboard state with calculated data
      setDashboardData({
        totalRevenue,
        completedOrders: completed,
        inProgressOrders: inProgress,
        pendingOrders: pending,
        cancelledOrders: cancelled,
        totalServices,
        availableServices
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      alert("⚠️ Error loading dashboard data.");
    }
  };

  // Function to refresh dashboard data
  const handleRefresh = () => {
    loadDashboardData();
  };

  return (
    <div className="container-fluid py-4 px-lg-5" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '3rem' }}>

      {/* Modern Dashboard Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
        <div>
          <h2 className="fw-bolder mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>Overview Dashboard</h2>
          <p className="text-muted mb-0 fw-medium">Real-time control panel for Cleaneco operations.</p>
        </div>
        <div className="d-flex gap-2 mt-3 mt-md-0 align-items-center position-relative">
          {/* Facebook-like Notification Bell */}
          <div className="position-relative me-1" style={{ cursor: 'pointer' }} onClick={() => setShowNotifTray(!showNotifTray)}>
            <div className="btn btn-light shadow-sm border d-flex align-items-center justify-content-center rounded-circle" style={{ width: '45px', height: '45px' }}>
              <i className="fas fa-bell fs-5" style={{ color: '#0D8D1E' }}></i>
            </div>
            {unreadCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.7rem' }}>
                {unreadCount}
              </span>
            )}
          </div>

          {/* Notification Tray Dropdown */}
          {showNotifTray && (
            <div className="card shadow-lg border position-absolute" style={{
              top: '55px',
              right: '0',
              width: '320px',
              zIndex: 1050,
              borderRadius: '0.75rem',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              <div className="card-header bg-white d-flex justify-content-between align-items-center border-bottom py-2">
                <span className="fw-bold text-dark">Recent Bookings</span>
                {unreadCount > 0 && (
                  <button className="btn btn-link text-success p-0 fw-bold small text-decoration-none" style={{ fontSize: '0.8rem', color: '#0D8D1E' }} onClick={handleMarkAllNotificationsRead}>
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="list-group list-group-flush">
                {notifications.length === 0 ? (
                  <div className="text-center p-3 text-secondary small">No notifications yet.</div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`list-group-item list-group-item-action p-3 border-bottom d-flex align-items-start gap-2 ${notif.is_read ? '' : 'bg-light'}`}
                      style={{ cursor: 'pointer', borderLeft: notif.is_read ? 'none' : '4px solid #0D8D1E' }}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="flex-grow-1">
                        <div className={`small ${notif.is_read ? 'text-secondary' : 'fw-bold text-dark'}`}>{notif.message}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>{notif.details}</div>
                        <div className="text-secondary" style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                          {new Date(notif.created_at).toLocaleString()}
                        </div>
                      </div>
                      {!notif.is_read && (
                        <span className="rounded-circle bg-success mt-1" style={{ width: '8px', height: '8px', flexShrink: 0 }}></span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <button onClick={handleRefresh} className="btn btn-light shadow-sm border fw-bold d-inline-flex align-items-center justify-content-center" style={{ borderRadius: '0.5rem', padding: '0.625rem 1.25rem' }}>
            <i className="fas fa-sync-alt me-2" style={{ color: '#0D8D1E' }}></i> Refresh
          </button>
          <Link to="/admin/services" className="btn btn-success shadow-sm fw-bold border-0 d-inline-flex align-items-center justify-content-center" style={{ borderRadius: '0.5rem', padding: '0.625rem 1.25rem', background: '#0D8D1E' }}>
            <i className="fas fa-plus me-2"></i> Create Service
          </Link>
        </div>
      </div>

      {/* Main Grid: Calendar, Charts, Actions */}
      <div className="row g-4 mb-5">

        {/* Left Col: Calendar */}
        <div className="col-xl-4 col-lg-12 d-flex flex-column">
          <div className="card shadow-sm border-0 flex-grow-1" style={{ borderRadius: '1.25rem' }}>
            <div className="card-body p-4 d-flex flex-column">
              <h5 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>
                <i className="far fa-calendar-alt me-2" style={{ color: '#0D8D1E' }}></i> Delivery Schedule
              </h5>
              <div className="flex-grow-1" style={{ minHeight: '380px' }}>
                <AdminCalendar orders={allOrders} onOrderCreated={loadDashboardData} />
              </div>
            </div>
          </div>
        </div>

        {/* Middle Col: Charts */}
        <div className="col-xl-4 col-lg-6 d-flex flex-column">
          <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '1.25rem' }}>
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>
                <i className="fas fa-chart-line me-2" style={{ color: '#0D8D1E' }}></i> Revenue Trend (Completed Orders)
              </h5>
              <div style={{ height: '220px' }}><canvas ref={lineChartRef}></canvas></div>
            </div>
          </div>
          <div className="card shadow-sm border-0 flex-grow-1" style={{ borderRadius: '1.25rem' }}>
            <div className="card-body p-4 d-flex flex-column">
              <h5 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>
                <i className="fas fa-chart-bar me-2" style={{ color: '#0D8D1E' }}></i> Services Breakdown
              </h5>
              <div style={{ height: '180px' }}><canvas ref={serviceChartRef}></canvas></div>
            </div>
          </div>
        </div>

        {/* Right Col: Quick Actions */}
        <div className="col-xl-4 col-lg-6 d-flex flex-column">
          <div className="card shadow-lg border-0 mb-4 position-relative overflow-hidden"
            style={{ borderRadius: '1.25rem', background: 'linear-gradient(145deg, #0D8D1E 0%, #085a13 100%)' }}>

            {/* Background design ring */}
            <div className="position-absolute" style={{ width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: '-50px', right: '-50px', pointerEvents: 'none' }}></div>

            <div className="card-body p-4 d-flex flex-column position-relative z-1 text-white">
              <h5 className="fw-bold mb-4">
                <i className="fas fa-bolt me-2 text-warning"></i>Quick Links
              </h5>

              <div className="d-flex flex-column gap-3">
                <Link to="/admin/orders" className="btn btn-light shadow-sm text-start fw-bold w-100 px-3 py-3 d-flex align-items-center" style={{ borderRadius: '0.85rem', color: '#0D8D1E' }}>
                  <i className="fas fa-database me-3 fs-5"></i> All Orders
                </Link>
                <Link to="/admin/services" className="btn btn-light shadow-sm text-start fw-bold w-100 px-3 py-3 d-flex align-items-center" style={{ borderRadius: '0.85rem', color: '#0D8D1E' }}>
                  <i className="fas fa-cogs me-3 fs-5"></i> Services
                </Link>
                <Link to="/admin/users" className="btn btn-light shadow-sm text-start fw-bold w-100 px-3 py-3 d-flex align-items-center" style={{ borderRadius: '0.85rem', color: '#0D8D1E' }}>
                  <i className="fas fa-users me-3 fs-5"></i> Users Setup
                </Link>
                <Link to="/admin/settings" className="btn btn-light shadow-sm text-start fw-bold w-100 px-3 py-3 d-flex align-items-center" style={{ borderRadius: '0.85rem', color: '#0D8D1E' }}>
                  <i className="fas fa-cog me-3 fs-5"></i> Site Settings
                </Link>
              </div>

              <div className="mt-auto pt-4">
                <div className="bg-white rounded p-3 text-center shadow-sm" style={{ opacity: '0.95', borderBottom: '4px solid #0D8D1E' }}>
                  <p className="mb-0 fw-bolder" style={{ color: '#0D8D1E', fontSize: '0.9rem', letterSpacing: '0.5px' }}>CLEANECO V1</p>
                  <small className="text-secondary fw-bold" style={{ fontSize: '0.75rem' }}>SYSTEM ONLINE</small>
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm border-0 flex-grow-1" style={{ borderRadius: '1.25rem' }}>
            <div className="card-body p-4 d-flex flex-column">
              <h5 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>
                <i className="fas fa-chart-pie me-2" style={{ color: '#0D8D1E' }}></i> Order Status Distribution
              </h5>
              <div style={{ height: '200px' }}><canvas ref={statusChartRef}></canvas></div>
            </div>
          </div>
        </div>

      </div>

      {/* 8 Compact Stat Cards (Moved to bottom) */}
      <div className="row g-3 mb-4">
        {[
          { icon: 'fa-dollar-sign', color: 'bg-success bg-gradient', label: 'Total Revenue', val: `₱${dashboardData.totalRevenue.toFixed(2)}` },
          { icon: 'fa-clipboard-list', color: 'bg-primary bg-gradient', label: 'All Orders', val: allOrders.length },
          { icon: 'fa-check-circle', color: 'bg-info bg-gradient', label: 'Completed', val: dashboardData.completedOrders },
          { icon: 'fa-cogs', color: 'bg-secondary bg-gradient', label: 'In Progress', val: dashboardData.inProgressOrders },
          { icon: 'fa-hourglass-half', color: 'bg-warning bg-gradient', label: 'Pending', val: dashboardData.pendingOrders },
          { icon: 'fa-times-circle', color: 'bg-danger bg-gradient', label: 'Cancelled', val: dashboardData.cancelledOrders },
          { icon: 'fa-concierge-bell', color: 'bg-dark bg-gradient', label: 'Total Services', val: dashboardData.totalServices },
          { icon: 'fa-check', color: 'bg-success bg-gradient', label: 'Available', val: dashboardData.availableServices },
        ].map((stat, i) => (
          <div className="col-xl-3 col-lg-4 col-md-6 col-sm-6" key={i}>
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '1rem', transition: 'transform 0.2s', cursor: 'default' }}>
              <div className="card-body d-flex flex-column align-items-center justify-content-center p-3 text-center">
                <div className={`text-white rounded-circle d-flex align-items-center justify-content-center mb-2 ${stat.color} shadow-sm`} style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                  <i className={`fas ${stat.icon}`}></i>
                </div>
                <h4 className="fw-bolder mb-0 text-dark" style={{ fontSize: '1.35rem', letterSpacing: '-0.5px' }}>{stat.val}</h4>
                <p className="text-muted mb-0 mt-1" style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

export default AdminLanding;
