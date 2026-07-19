import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import api from '../api/axiosConfig';
import '../assets/styles/admin.css';
import AdminCalendar from '../components/AdminCalendar';

// Removing gradient styles as we move to clean white cards

function AdminLanding() {
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    completedOrders: 0,
    inProgressOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    totalServices: 0,
    availableServices: 0,
    totalOrders: 0
  });

  const [allOrders, setAllOrders] = useState([]);
  const navigate = useNavigate();

  const statusChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const statusChartInstance = useRef(null);
  const lineChartInstance = useRef(null);

  useEffect(() => {
    loadDashboardData();
  }, [navigate]);

  useEffect(() => {
    const renderCharts = () => {
      const statusCounts = allOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

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

      if (statusChartInstance.current) statusChartInstance.current.destroy();
      if (lineChartInstance.current) lineChartInstance.current.destroy();

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
              backgroundColor: ['#ffc107', '#0dcaf0', '#20c997', '#dc3545'],
              borderWidth: 0,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  usePointStyle: true,
                  padding: 20,
                  font: { size: 12, family: "'Inter', sans-serif" }
                }
              }
            },
            cutout: '70%'
          }
        });
      }

      const lineCtx = lineChartRef.current?.getContext('2d');
      if (lineCtx) {
        lineChartInstance.current = new Chart(lineCtx, {
          type: 'bar', // Like the visit and sales statistics bar chart in reference
          data: {
            labels: sortedDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
              label: 'Revenue',
              data: revenueValues,
              backgroundColor: '#20c997',
              borderRadius: 4,
              barThickness: 12,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: '#f0f0f0', drawBorder: false },
                ticks: { callback: (value) => '₱' + value, color: '#a0a0a0' }
              },
              x: {
                grid: { display: false },
                ticks: { color: '#a0a0a0' }
              }
            }
          }
        });
      }
    };

    if (allOrders.length > 0) renderCharts();

    return () => {
      if (statusChartInstance.current) statusChartInstance.current.destroy();
      if (lineChartInstance.current) lineChartInstance.current.destroy();
    };
  }, [allOrders]);

  const handleGenerateReport = async (period) => {
    try {
      const response = await api.get(`/reports/generate?period=${period}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cleaneco_Report_${period}_${new Date().getFullYear()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading report:", error);
      alert("Failed to generate report. Please try again later.");
    }
  };

  const loadDashboardData = async () => {
    try {
      const ordersResponse = await api.get('/orders');
      const ordersData = ordersResponse.data;
      setAllOrders(ordersData);

      const servicesResponse = await api.get('/services');
      const servicesData = servicesResponse.data;

      let totalRevenue = 0, pending = 0, inProgress = 0, completed = 0, cancelled = 0;

      ordersData.forEach(order => {
        const cleanedPriceString = String(order.price || '').replace(/[₱,]/g, '').trim();
        const price = parseFloat(cleanedPriceString);
        if (!isNaN(price) && order.status === "Completed") totalRevenue += price;

        switch (order.status) {
          case "Pending": pending++; break;
          case "In Progress": inProgress++; break;
          case "Completed": completed++; break;
          case "Cancelled": cancelled++; break;
          default: break;
        }
      });

      setDashboardData({
        totalRevenue,
        completedOrders: completed,
        inProgressOrders: inProgress,
        pendingOrders: pending,
        cancelledOrders: cancelled,
        totalServices: servicesData.length,
        availableServices: servicesData.filter(s => s.status === 'available').length,
        totalOrders: ordersData.length
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  return (
    <>
      {/* PAGE CONTENT */}
      <div className="p-4 w-100 h-100">

        {/* Page Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="fw-bold text-dark mb-0 d-flex align-items-center">
            <span className="d-inline-flex align-items-center justify-content-center bg-white shadow-sm text-primary rounded me-3" style={{ width: '38px', height: '38px', color: '#0D8D1E' }}>
              <i className="fas fa-home" style={{ color: '#0D8D1E' }}></i>
            </span>
            Dashboard
          </h4>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted fw-bold me-2" style={{ fontSize: '0.85rem' }}>Reports:</span>
            <button className="btn btn-success btn-sm shadow-sm px-3" onClick={() => handleGenerateReport('monthly')} style={{ backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }}>
              <i className="fas fa-file-pdf me-1"></i>Monthly
            </button>
            <button className="btn btn-success btn-sm shadow-sm px-3" onClick={() => handleGenerateReport('quarterly')} style={{ backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }}>
              <i className="fas fa-file-pdf me-1"></i>Quarterly
            </button>
            <button className="btn btn-success btn-sm shadow-sm px-3" onClick={() => handleGenerateReport('yearly')} style={{ backgroundColor: '#0D8D1E', borderColor: '#0D8D1E' }}>
              <i className="fas fa-file-pdf me-1"></i>Yearly
            </button>
          </div>
        </div>

        {/* 3 LARGE STAT CARDS */}
        <div className="row g-4 mb-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
              <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <p className="text-muted mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Total Revenue</p>
                <h3 className="fw-bold mb-3 text-dark">₱ {dashboardData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px', backgroundColor: 'rgba(13, 141, 30, 0.1)' }}>
                  <i className="fas fa-chart-line fs-5" style={{ color: '#0D8D1E' }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
              <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <p className="text-muted mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Total Orders</p>
                <h3 className="fw-bold mb-3 text-dark">{dashboardData.totalOrders.toLocaleString()}</h3>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px', backgroundColor: 'rgba(13, 141, 30, 0.1)' }}>
                  <i className="fas fa-bookmark fs-5" style={{ color: '#0D8D1E' }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
              <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <p className="text-muted mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Completed Orders</p>
                <h3 className="fw-bold mb-3 text-dark">{dashboardData.completedOrders.toLocaleString()}</h3>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px', backgroundColor: 'rgba(13, 141, 30, 0.1)' }}>
                  <i className="fas fa-gem fs-5" style={{ color: '#0D8D1E' }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CHARTS GRID */}
        <div className="row g-4">
          {/* Revenue / Visits Chart (Large Left) */}
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Visit And Sales Statistics</h5>
                  <div className="d-flex gap-3">
                    <div className="d-flex align-items-center"><span className="rounded-circle me-2" style={{ width: '10px', height: '10px', backgroundColor: '#20c997' }}></span><small className="text-muted">Revenue</small></div>
                  </div>
                </div>
                <div style={{ height: '300px' }}><canvas ref={lineChartRef} role="img" aria-label="Bar chart showing daily revenue over time"></canvas></div>
              </div>
            </div>
          </div>

          {/* Traffic Sources / Order Status Chart (Smaller Right) */}
          <div className="col-lg-5">
            <div className="card border-0 shadow-sm h-100 d-flex flex-column" style={{ borderRadius: '10px' }}>
              <div className="card-body p-4 d-flex flex-column">
                <h5 className="fw-bold text-dark mb-4" style={{ fontSize: '1.1rem' }}>Order Status Overview</h5>
                <div className="flex-grow-1 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                  <canvas ref={statusChartRef} role="img" aria-label="Donut chart showing order status distribution: Pending, In Progress, Completed, and Cancelled"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ADMIN CALENDAR & RECENT ORDERS */}
        <div className="row mt-4 g-4">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
              <div className="card-body p-4">
                <h5 className="fw-bold text-dark mb-4" style={{ fontSize: '1.1rem' }}>Calendar</h5>
                <AdminCalendar orders={allOrders} />
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '10px' }}>
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Recent Orders</h5>
                  <Link to="/admin/orders" className="text-success text-decoration-none small fw-bold">View All</Link>
                </div>
                <div className="flex-grow-1 d-flex flex-column gap-3 overflow-auto" style={{ maxHeight: '400px' }}>
                  {allOrders.length === 0 ? (
                    <div className="text-center text-muted my-auto">No orders yet.</div>
                  ) : (
                    [...allOrders].reverse().slice(0, 5).map((order, idx) => (
                      <div key={idx} className="d-flex align-items-center p-3 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0" style={{ width: '40px', height: '40px', backgroundColor: 'rgba(13, 141, 30, 0.1)', color: '#0D8D1E' }}>
                          <i className="fas fa-shopping-bag"></i>
                        </div>
                        <div className="flex-grow-1 min-w-0">
                          <h6 className="mb-1 fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>{order.service_name || order.service_type || 'Service'}</h6>
                          <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">{order.first_name} {order.last_name}</small>
                            <span className="badge" style={{
                              backgroundColor: order.status === 'Completed' ? '#198754' :
                                order.status === 'Pending' ? '#ffc107' :
                                  order.status === 'Cancelled' ? '#dc3545' : '#0dcaf0',
                              color: order.status === 'Pending' ? '#000' : '#fff',
                              fontSize: '0.7rem'
                            }}>{order.status}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

export default AdminLanding;
