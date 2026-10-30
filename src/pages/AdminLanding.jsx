import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import api from '../api/api';
import '../assets/styles/admin.css';
import AdminCalendar from '../components/AdminCalendar';
import { formatName } from '../utils/formatName';
import { groupOrdersByOrderId, calculateOrderCollectedRevenue } from '../utils/pricing';

const getOrderTimestamp = (order) => {
  const rawCreated = order.created_at || order.createdAt;
  if (rawCreated) {
    const parsed = new Date(rawCreated).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof order.order_id === 'string' && /^ORD\d{10,}$/.test(order.order_id)) {
    const ordTs = Number(order.order_id.slice(3));
    if (!Number.isNaN(ordTs)) return ordTs;
  }
  const rawId = String(order.id || order._id || '');
  if (/^[a-fA-F0-9]{24}$/.test(rawId)) {
    return parseInt(rawId.slice(0, 8), 16) * 1000;
  }
  if (order.date) {
    const parsedDate = new Date(order.date).getTime();
    if (!Number.isNaN(parsedDate)) return parsedDate;
  }
  return 0;
};

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
  const groupedOrders = useMemo(() => groupOrdersByOrderId(allOrders), [allOrders]);
  const navigate = useNavigate();

  const statusChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const statusChartInstance = useRef(null);
  const lineChartInstance = useRef(null);
  
  const growthChartRef = useRef(null);
  const growthChartInstance = useRef(null);
  const [growthPeriod, setGrowthPeriod] = useState('monthly');

  const serviceStats = useMemo(() => {
    const counts = {};
    groupedOrders.forEach(order => {
      if (order.status === 'Cancelled') return;
      const sList = (Array.isArray(order.service_names) && order.service_names.length > 0)
        ? order.service_names
        : [order.service_name || order.service_type].filter(Boolean);
      const uniqueInOrder = [...new Set(sList)];
      uniqueInOrder.forEach(sName => {
        counts[sName] = (counts[sName] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [groupedOrders]);

  const totalServiceBookings = useMemo(() => {
    return serviceStats.reduce((sum, item) => sum + item[1], 0);
  }, [serviceStats]);

  const maxServiceBookings = useMemo(() => {
    return serviceStats.length > 0 ? serviceStats[0][1] : 1;
  }, [serviceStats]);

  useEffect(() => {
    loadDashboardData();
  }, [navigate]);

  useEffect(() => {
    const renderCharts = () => {
      const statusCounts = groupedOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});

      const dailyRevenue = groupedOrders.reduce((acc, order) => {
        const rev = calculateOrderCollectedRevenue(order);
        if (rev > 0 && order.date) {
          const parsed = new Date(order.date);
          if (!Number.isNaN(parsed.getTime())) {
            const d = parsed.toISOString().split('T')[0];
            acc[d] = (acc[d] || 0) + rev;
          }
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
            labels: sortedDates.map(d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
              label: 'Gross Sales',
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

    if (groupedOrders.length > 0) renderCharts();

    return () => {
      if (statusChartInstance.current) statusChartInstance.current.destroy();
      if (lineChartInstance.current) lineChartInstance.current.destroy();
    };
  }, [groupedOrders]);

  useEffect(() => {
    if (groupedOrders.length === 0) return;

    // Use unified grouped orders & collected cash revenue across Monthly, Quarterly, and Yearly buckets.
    const getBucket = (dateObj) => {
      const year = dateObj.getUTCFullYear();
      if (growthPeriod === 'yearly') return `${year}`;
      if (growthPeriod === 'quarterly') {
        const q = Math.floor(dateObj.getUTCMonth() / 3) + 1;
        return `${year}-Q${q}`;
      }
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    };

    const aggregated = groupedOrders.reduce((acc, order) => {
      const rev = calculateOrderCollectedRevenue(order);
      if (rev > 0 && order.date) {
        const d = new Date(order.date);
        if (!Number.isNaN(d.getTime())) {
          const bucket = getBucket(d);
          acc[bucket] = (acc[bucket] || 0) + rev;
        }
      }
      return acc;
    }, {});

    const sortedBuckets = Object.keys(aggregated).sort();
    const labels = [];
    const growthData = [];

    for (let i = 0; i < sortedBuckets.length; i++) {
      const currentBucket = sortedBuckets[i];
      const currentRev = aggregated[currentBucket];
      
      let growth = 0;
      if (i > 0) {
        const prevRev = aggregated[sortedBuckets[i - 1]];
        if (prevRev > 0) {
          growth = ((currentRev - prevRev) / prevRev) * 100;
        } else if (currentRev > 0) {
          growth = 100; 
        }
      }

      let label = currentBucket;
      if (growthPeriod === 'monthly') {
        const [y, m] = currentBucket.split('-');
        const date = new Date(y, parseInt(m) - 1, 1);
        const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
        const yearShort = String(y).slice(-2);
        label = `${monthShort} '${yearShort}`;
      }

      labels.push(label);
      growthData.push(growth);
    }

    if (growthChartInstance.current) growthChartInstance.current.destroy();

    const ctx = growthChartRef.current?.getContext('2d');
    if (ctx) {
      growthChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Sales Growth (%)',
            data: growthData,
            borderColor: '#0D8D1E',
            backgroundColor: 'rgba(13, 141, 30, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#0D8D1E',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function(context) {
                  return context[0]?.label || '';
                },
                label: function(context) {
                  return ` Growth: ${context.parsed.y.toFixed(2)}%`;
                }
              }
            }
          },
          scales: {
            y: {
              grid: { color: '#f0f0f0', drawBorder: false },
              ticks: { callback: (value) => value + '%', color: '#a0a0a0' }
            },
            x: {
              grid: { display: false },
              ticks: {
                color: '#a0a0a0',
                maxRotation: 0,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: 7
              }
            }
          }
        }
      });
    }

    return () => {
      if (growthChartInstance.current) growthChartInstance.current.destroy();
    };
  }, [groupedOrders, growthPeriod]);

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
      const [ordersRes, servicesRes] = await Promise.all([
        api.get('/orders'),
        api.get('/services')
      ]);
      
      const ordersData = ordersRes.data;
      setAllOrders(ordersData);

      const grouped = groupOrdersByOrderId(ordersData);
      const servicesData = servicesRes.data;

      const statusMap = {};
      let computedRevenue = 0;
      grouped.forEach(order => {
        const st = order.status || 'Pending';
        statusMap[st] = (statusMap[st] || 0) + 1;
        computedRevenue += calculateOrderCollectedRevenue(order);
      });

      setDashboardData({
        totalRevenue: computedRevenue,
        completedOrders: statusMap["Completed"] || 0,
        inProgressOrders: statusMap["In Progress"] || 0,
        pendingOrders: statusMap["Pending"] || 0,
        cancelledOrders: statusMap["Cancelled"] || 0,
        totalServices: servicesData.length,
        availableServices: servicesData.filter(s => s.status === 'available').length,
        totalOrders: grouped.length
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const recentOrders = useMemo(() => {
    return [...groupedOrders]
      .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a))
      .slice(0, 5);
  }, [groupedOrders]);

  return (
    <>
      {/* PAGE CONTENT */}
      <div className="p-4 w-100 h-100">

        {/* Page Header */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
          <h4 className="fw-bold text-dark mb-0 d-flex align-items-center">
            <span className="d-inline-flex align-items-center justify-content-center bg-white shadow-sm text-brand rounded me-3 icon-container-md">
              <i className="fas fa-home"></i>
            </span>
            Dashboard
          </h4>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="text-muted fw-bold me-2" style={{ fontSize: '0.85rem' }}>Reports:</span>
            <button className="btn btn-brand btn-sm shadow-sm px-3" onClick={() => handleGenerateReport('monthly')}>
              <i className="fas fa-file-pdf me-1"></i>Monthly
            </button>
            <button className="btn btn-brand btn-sm shadow-sm px-3" onClick={() => handleGenerateReport('quarterly')}>
              <i className="fas fa-file-pdf me-1"></i>Quarterly
            </button>
            <button className="btn btn-brand btn-sm shadow-sm px-3" onClick={() => handleGenerateReport('yearly')}>
              <i className="fas fa-file-pdf me-1"></i>Yearly
            </button>
          </div>
        </div>

        {/* 3 LARGE STAT CARDS */}
        <div className="row g-4 mb-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <p className="text-muted mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Gross Sales</p>
                <h3 className="fw-bold mb-3 text-dark">₱ {dashboardData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                <div className="rounded-circle d-flex align-items-center justify-content-center bg-brand-soft icon-container-lg">
                  <i className="fas fa-chart-line fs-5 text-brand"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <p className="text-muted mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Total Orders</p>
                <h3 className="fw-bold mb-3 text-dark">{dashboardData.totalOrders.toLocaleString()}</h3>
                <div className="rounded-circle d-flex align-items-center justify-content-center bg-brand-soft icon-container-lg">
                  <i className="fas fa-bookmark fs-5 text-brand"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <p className="text-muted mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Completed Orders</p>
                <h3 className="fw-bold mb-3 text-dark">{dashboardData.completedOrders.toLocaleString()}</h3>
                <div className="rounded-circle d-flex align-items-center justify-content-center bg-brand-soft icon-container-lg">
                  <i className="fas fa-gem fs-5 text-brand"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CHARTS GRID */}
        <div className="row g-4">
          {/* Revenue / Visits Chart (Large Left) */}
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Visit And Sales Statistics</h5>
                  <div className="d-flex gap-3">
                    <div className="d-flex align-items-center"><span className="rounded-circle me-2" style={{ width: '10px', height: '10px', backgroundColor: '#20c997' }}></span><small className="text-muted">Gross Sales</small></div>
                  </div>
                </div>
                <div style={{ height: '300px' }} className="d-flex justify-content-center align-items-center">
                  {allOrders.length === 0 ? (
                    <div className="text-center text-muted">
                      <i className="fas fa-chart-bar fs-1 mb-3 text-light"></i>
                      <p className="mb-0">No sales data available yet.</p>
                    </div>
                  ) : (
                    <canvas ref={lineChartRef} role="img" aria-label="Bar chart showing daily sales over time"></canvas>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Sources / Order Status Chart (Smaller Right) */}
          <div className="col-lg-5">
            <div className="card border-0 shadow-sm h-100 d-flex flex-column rounded-xl">
              <div className="card-body p-4 d-flex flex-column">
                <h5 className="fw-bold text-dark mb-4" style={{ fontSize: '1.1rem' }}>Order Status Overview</h5>
                <div className="flex-grow-1 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                  {allOrders.length === 0 ? (
                    <div className="text-center text-muted">
                      <i className="fas fa-chart-pie fs-1 mb-3 text-light"></i>
                      <p className="mb-0">Waiting for first orders...</p>
                    </div>
                  ) : (
                    <canvas ref={statusChartRef} role="img" aria-label="Donut chart showing order status distribution"></canvas>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SERVICES & GROWTH CHARTS */}
        <div className="row mt-4 g-4">
          {/* Most Availed Services (Modern Ranked Leaderboard) */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Most Availed Services</h5>
                    <small className="text-muted" style={{ fontSize: '0.78rem' }}>Ranked by client bookings</small>
                  </div>
                  <span className="badge rounded-pill" style={{ backgroundColor: '#e8f5e9', color: '#0D8D1E', border: '1px solid #c8e6c9', fontSize: '0.75rem', padding: '5px 12px' }}>
                    <i className="fas fa-fire me-1"></i>{totalServiceBookings} Total Bookings
                  </span>
                </div>
                <div className="flex-grow-1 overflow-auto pe-1" style={{ maxHeight: '300px' }}>
                  {serviceStats.length === 0 ? (
                    <div className="text-center text-muted py-5 my-auto">
                      <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '56px', height: '56px' }}>
                        <i className="fas fa-broom fs-4 text-secondary"></i>
                      </div>
                      <p className="mb-0 fw-bold text-dark">No service bookings yet</p>
                      <small>Bookings will appear here once submitted.</small>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {serviceStats.map(([sName, count], idx) => {
                        const rank = idx + 1;
                        const percentOfTotal = totalServiceBookings > 0 ? Math.round((count / totalServiceBookings) * 100) : 0;
                        const relativeBarWidth = maxServiceBookings > 0 ? Math.max(4, Math.round((count / maxServiceBookings) * 100)) : 0;
                        const isTop = rank === 1;

                        return (
                          <div
                            key={sName}
                            className="p-2 px-3 rounded-3"
                            style={{
                              backgroundColor: isTop ? '#f0fdf4' : '#fafafa',
                              border: isTop ? '1px solid #bbf7d0' : '1px solid rgba(0,0,0,0.04)'
                            }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <div className="d-flex align-items-center gap-2 text-truncate me-2">
                                <span
                                  className="d-inline-flex align-items-center justify-content-center rounded-circle fw-bold"
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    fontSize: '0.7rem',
                                    backgroundColor: isTop ? '#0D8D1E' : '#e5e7eb',
                                    color: isTop ? '#ffffff' : '#4b5563',
                                    flexShrink: 0
                                  }}
                                >
                                  {rank}
                                </span>
                                <span
                                  className={`text-truncate ${isTop ? 'fw-bold text-dark' : 'fw-semibold text-secondary'}`}
                                  style={{ fontSize: '0.86rem' }}
                                  title={sName}
                                >
                                  {sName}
                                </span>
                              </div>
                              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                <span className="fw-bold text-dark" style={{ fontSize: '0.82rem' }}>
                                  {count} {count === 1 ? 'order' : 'orders'}
                                </span>
                                <span
                                  className="badge rounded-pill"
                                  style={{
                                    backgroundColor: isTop ? '#dcfce7' : '#f3f4f6',
                                    color: isTop ? '#15803d' : '#6b7280',
                                    fontSize: '0.7rem',
                                    padding: '2px 7px'
                                  }}
                                >
                                  {percentOfTotal}%
                                </span>
                              </div>
                            </div>
                            <div className="progress" style={{ height: '5px', backgroundColor: isTop ? '#dcfce7' : '#e5e7eb', borderRadius: '999px' }}>
                              <div
                                className="progress-bar rounded-pill"
                                role="progressbar"
                                style={{
                                  width: `${relativeBarWidth}%`,
                                  backgroundColor: isTop ? '#0D8D1E' : '#20c997'
                                }}
                                aria-valuenow={relativeBarWidth}
                                aria-valuemin="0"
                                aria-valuemax="100"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sales Growth Statistics */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Sales Growth Statistics</h5>
                  <div className="d-flex gap-2">
                    <button 
                      className={`btn btn-sm ${growthPeriod === 'monthly' ? 'btn-brand' : 'btn-outline-secondary'}`} 
                      onClick={() => setGrowthPeriod('monthly')}
                    >Monthly</button>
                    <button 
                      className={`btn btn-sm ${growthPeriod === 'quarterly' ? 'btn-brand' : 'btn-outline-secondary'}`} 
                      onClick={() => setGrowthPeriod('quarterly')}
                    >Quarterly</button>
                    <button 
                      className={`btn btn-sm ${growthPeriod === 'yearly' ? 'btn-brand' : 'btn-outline-secondary'}`} 
                      onClick={() => setGrowthPeriod('yearly')}
                    >Yearly</button>
                  </div>
                </div>
                <div style={{ height: '300px' }} className="d-flex justify-content-center align-items-center">
                  {allOrders.length === 0 ? (
                    <div className="text-center text-muted">
                      <i className="fas fa-chart-line fs-1 mb-3 text-light"></i>
                      <p className="mb-0">Not enough data to calculate growth.</p>
                    </div>
                  ) : (
                    <canvas ref={growthChartRef} role="img" aria-label="Line chart showing sales growth"></canvas>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ADMIN CALENDAR & RECENT ORDERS */}
        <div className="row mt-4 g-4">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4">
                <h5 className="fw-bold text-dark mb-4" style={{ fontSize: '1.1rem' }}>Calendar</h5>
                <AdminCalendar orders={groupedOrders} />
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Recent Orders</h5>
                  <Link to="/admin/orders" className="text-brand text-decoration-none small fw-bold">View All</Link>
                </div>
                <div className="flex-grow-1 d-flex flex-column gap-3 overflow-auto" style={{ maxHeight: '400px' }}>
                  {recentOrders.length === 0 ? (
                    <div className="text-center text-muted my-auto py-5">
                      <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height:'60px'}}>
                         <i className="fas fa-inbox fs-3 text-secondary"></i>
                      </div>
                      <p className="mb-0 fw-bold text-dark">No orders yet</p>
                      <small>Your recent orders will appear here.</small>
                    </div>
                  ) : (
                    recentOrders.map((order, idx) => (
                      <div
                        key={order.order_id || order.id || idx}
                        className="d-flex align-items-center p-3 rounded"
                        style={{
                          backgroundColor: '#f8f9fa',
                          border: '1px solid rgba(0,0,0,0.05)',
                          cursor: order.order_id ? 'pointer' : 'default'
                        }}
                        onClick={() => {
                          if (order.order_id) {
                            navigate(`/admin/orders?orderId=${encodeURIComponent(order.order_id)}`);
                          }
                        }}
                      >
                        <div className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0 bg-brand-soft icon-container-md text-brand">
                          <i className="fas fa-shopping-bag"></i>
                        </div>
                        <div className="flex-grow-1 min-w-0">
                          <h6 className="mb-1 fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>{order.service_name || order.service_type || 'Service'}</h6>
                          <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted text-truncate me-2">{formatName(order)}</small>
                            <span className="badge flex-shrink-0" style={{
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
