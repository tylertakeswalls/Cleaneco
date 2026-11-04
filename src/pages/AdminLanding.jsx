import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import api from '../api/api';
import '../assets/styles/admin.css';
import AdminCalendar from '../components/AdminCalendar';
import { formatName } from '../utils/formatName';
import { formatOrderReference } from '../utils/helpers';
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

  const [loading, setLoading] = useState(true);
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
  const [salesPeriod, setSalesPeriod] = useState('monthly');

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
    let isCurrent = true;
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [ordersRes, servicesRes] = await Promise.all([
          api.get('/orders'),
          api.get('/services')
        ]);
        if (!isCurrent) return;

        const ordersData = ordersRes.data || [];
        setAllOrders(ordersData);

        const grouped = groupOrdersByOrderId(ordersData);
        const servicesData = servicesRes.data || [];

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
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    fetchDashboard();
    return () => {
      isCurrent = false;
    };
  }, []);

  // Cleanup chart instances on component unmount
  useEffect(() => {
    return () => {
      if (statusChartInstance.current) statusChartInstance.current.destroy();
      if (lineChartInstance.current) lineChartInstance.current.destroy();
      if (growthChartInstance.current) growthChartInstance.current.destroy();
    };
  }, []);

  // Status chart (Doughnut)
  useEffect(() => {
    if (groupedOrders.length === 0) return;

    const statusCounts = groupedOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    const chartData = {
      labels: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
      datasets: [{
        data: [
          statusCounts['Pending'] || 0,
          statusCounts['In Progress'] || 0,
          statusCounts['Completed'] || 0,
          statusCounts['Cancelled'] || 0
        ],
        backgroundColor: ['#ffb300', '#2563eb', '#2e7d32', '#d32f2f'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };

    if (statusChartInstance.current) {
      statusChartInstance.current.data = chartData;
      statusChartInstance.current.update('none');
    } else {
      const statusCtx = statusChartRef.current?.getContext('2d');
      if (statusCtx) {
        statusChartInstance.current = new Chart(statusCtx, {
          type: 'doughnut',
          data: chartData,
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
    }
  }, [groupedOrders]);

  // Gross Sales Bar Chart
  useEffect(() => {
    if (groupedOrders.length === 0) return;

    const getBucket = (dateObj) => {
      const year = dateObj.getFullYear();
      if (salesPeriod === 'yearly') return `${year}`;
      if (salesPeriod === 'quarterly') {
        const q = Math.floor(dateObj.getMonth() / 3) + 1;
        return `${year}-Q${q}`;
      }
      if (salesPeriod === 'monthly') {
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      }
      // 'daily'
      return dateObj.toISOString().split('T')[0];
    };

    // If daily, only take the last 30 days of activity to prevent clumping
    let minDailyTime = 0;
    if (salesPeriod === 'daily') {
      let maxTime = Date.now();
      groupedOrders.forEach(o => {
        if (o.date) {
          const t = new Date(o.date).getTime();
          if (!Number.isNaN(t) && t > maxTime) maxTime = t;
        }
      });
      minDailyTime = maxTime - (30 * 24 * 60 * 60 * 1000);
    }

    const aggregated = groupedOrders.reduce((acc, order) => {
      const rev = calculateOrderCollectedRevenue(order);
      if (rev > 0 && order.date) {
        const parsed = new Date(order.date);
        if (!Number.isNaN(parsed.getTime())) {
          if (salesPeriod === 'daily' && minDailyTime > 0 && parsed.getTime() < minDailyTime) {
            return acc;
          }
          const bucket = getBucket(parsed);
          acc[bucket] = (acc[bucket] || 0) + rev;
        }
      }
      return acc;
    }, {});

    const sortedBuckets = Object.keys(aggregated).sort();
    const revenueValues = sortedBuckets.map(b => aggregated[b]);
    const labels = sortedBuckets.map(bucket => {
      if (salesPeriod === 'yearly') return bucket;
      if (salesPeriod === 'quarterly') return bucket;
      if (salesPeriod === 'monthly') {
        const [y, m] = bucket.split('-');
        const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
        const yearShort = String(y).slice(-2);
        return `${monthShort} '${yearShort}`;
      }
      // 'daily'
      return new Date(`${bucket}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const chartData = {
      labels,
      datasets: [{
        label: 'Gross Sales',
        data: revenueValues,
        backgroundColor: '#0D8D1E',
        hoverBackgroundColor: '#0A6F17',
        borderRadius: 6,
        maxBarThickness: 36,
      }]
    };

    if (lineChartInstance.current) {
      lineChartInstance.current.data = chartData;
      lineChartInstance.current.update('none');
    } else {
      const lineCtx = lineChartRef.current?.getContext('2d');
      if (lineCtx) {
        lineChartInstance.current = new Chart(lineCtx, {
          type: 'bar',
          data: chartData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1f2937',
                titleFont: { size: 12, family: "'Inter', sans-serif" },
                bodyFont: { size: 12, family: "'Inter', sans-serif" },
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                  label: function(context) {
                    const val = context.parsed.y || 0;
                    return `Gross Sales: ₱${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: '#f3f4f6', drawBorder: false },
                ticks: {
                  callback: (value) => '₱' + Number(value).toLocaleString('en-US'),
                  color: '#9ca3af',
                  font: { size: 11, family: "'Inter', sans-serif" }
                }
              },
              x: {
                grid: { display: false },
                ticks: {
                  color: '#9ca3af',
                  autoSkip: true,
                  maxTicksLimit: 8,
                  maxRotation: 0,
                  minRotation: 0,
                  font: { size: 11, family: "'Inter', sans-serif" }
                }
              }
            }
          }
        });
      }
    }
  }, [groupedOrders, salesPeriod]);

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

    const chartData = {
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
    };

    if (growthChartInstance.current) {
      growthChartInstance.current.data = chartData;
      growthChartInstance.current.update('none');
    } else {
      const ctx = growthChartRef.current?.getContext('2d');
      if (ctx) {
        growthChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: chartData,
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
    }
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

  const recentOrders = useMemo(() => {
    return [...groupedOrders]
      .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a))
      .slice(0, 5);
  }, [groupedOrders]);

  // Operational triage items needing admin action
  const attentionItems = useMemo(() => {
    const items = [];
    groupedOrders.forEach(order => {
      // 1. Cheque payments pending verification
      if (order.payment_method === 'cheque' && order.cheque_status === 'pending_verification') {
        items.push({
          id: order.id,
          order_id: order.order_id,
          type: 'cheque',
          badgeText: 'Cheque Verification',
          badgeClass: 'bg-warning text-dark',
          icon: 'fas fa-money-check-alt text-warning',
          client: formatName(order.first_name, order.middle_name, order.last_name) || order.user_email || 'Client',
          details: `₱${(order.cheque_amount || 1100).toLocaleString()} cheque waiting for verification`
        });
      }

      // 2. Reschedule requests
      if (order.request_type === 'Reschedule Requested' || (order.reschedule_date && !order.reschedule_resolved)) {
        items.push({
          id: order.id,
          order_id: order.order_id,
          type: 'reschedule',
          badgeText: 'Reschedule Request',
          badgeClass: 'text-white',
          badgeStyle: { backgroundColor: '#2563eb' },
          icon: 'fas fa-calendar-alt',
          iconStyle: { color: '#2563eb' },
          client: formatName(order.first_name, order.middle_name, order.last_name) || order.user_email || 'Client',
          details: 'Client requested a schedule change'
        });
      }

      // 3. Clarification requests on quotations
      if (order.quotation_status === 'Clarification Requested') {
        items.push({
          id: order.id,
          order_id: order.order_id,
          type: 'clarification',
          badgeText: 'Clarification Needed',
          badgeClass: 'bg-danger text-white',
          icon: 'fas fa-question-circle text-danger',
          client: formatName(order.first_name, order.middle_name, order.last_name) || order.user_email || 'Client',
          details: 'Client requested clarification on quotation'
        });
      }
    });

    return items;
  }, [groupedOrders]);

  const adminFirstName = useMemo(() => {
    const rawName = sessionStorage.getItem("userName");
    if (rawName && rawName.trim()) {
      const first = rawName.trim().split(/\s+/)[0];
      if (first && first.toLowerCase() !== 'undefined' && first.toLowerCase() !== 'null') {
        return first.charAt(0).toUpperCase() + first.slice(1);
      }
    }
    const loggedIn = sessionStorage.getItem("loggedInUser");
    if (loggedIn && loggedIn.trim()) {
      return loggedIn.charAt(0).toUpperCase() + loggedIn.slice(1);
    }
    return 'Admin';
  }, []);

  return (
    <>
      {/* PAGE CONTENT */}
      <div className="p-4 w-100 h-100">

        {/* Page Header Banner */}
        <div className="card border-0 shadow-sm rounded-xl p-4 mb-4 bg-white">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
            <div>
              <h4 className="fw-bold mb-1" style={{ letterSpacing: '-0.3px', color: '#1e293b' }}>
                Hello, <span className="text-brand" style={{ color: '#0D8D1E' }}>{adminFirstName}!</span>
              </h4>
              <p className="text-muted small mb-0">
                Here's an overview of today's bookings, sales, and operations.
              </p>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="text-muted fw-bold me-1 small"><i className="fas fa-download me-1 text-brand"></i>Export:</span>
              <button 
                className="btn btn-brand btn-sm shadow-sm px-3 rounded-pill fw-semibold text-white" 
                onClick={() => handleGenerateReport('monthly')}
                title="Download Monthly Performance Report PDF"
                aria-label="Download Monthly Performance Report PDF"
              >
                <i className="fas fa-file-pdf me-1 text-white"></i>Monthly Report
              </button>
              <button 
                className="btn btn-brand btn-sm shadow-sm px-3 rounded-pill fw-semibold text-white" 
                onClick={() => handleGenerateReport('quarterly')}
                title="Download Quarterly Performance Report PDF"
                aria-label="Download Quarterly Performance Report PDF"
              >
                <i className="fas fa-file-pdf me-1 text-white"></i>Quarterly Report
              </button>
              <button 
                className="btn btn-brand btn-sm shadow-sm px-3 rounded-pill fw-semibold text-white" 
                onClick={() => handleGenerateReport('yearly')}
                title="Download Yearly Performance Report PDF"
                aria-label="Download Yearly Performance Report PDF"
              >
                <i className="fas fa-file-pdf me-1 text-white"></i>Yearly Report
              </button>
            </div>
          </div>
        </div>

        {/* 3 LARGE STAT CARDS */}
        <div className="row g-4 mb-4">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm h-100 rounded-xl">
              <div className="card-body p-4 d-flex flex-column align-items-center justify-content-center text-center">
                <p className="text-muted mb-2" style={{ fontSize: '0.9rem', fontWeight: '500' }}>Gross Sales</p>
                <h3 className="fw-bold mb-3 text-dark">
                  {loading ? (
                    <div className="spinner-border spinner-border-sm text-success" role="status"></div>
                  ) : (
                    `₱ ${dashboardData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                  )}
                </h3>
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
                <h3 className="fw-bold mb-3 text-dark">
                  {loading ? (
                    <div className="spinner-border spinner-border-sm text-success" role="status"></div>
                  ) : (
                    dashboardData.totalOrders.toLocaleString()
                  )}
                </h3>
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
                <h3 className="fw-bold mb-3 text-dark">
                  {loading ? (
                    <div className="spinner-border spinner-border-sm text-success" role="status"></div>
                  ) : (
                    dashboardData.completedOrders.toLocaleString()
                  )}
                </h3>
                <div className="rounded-circle d-flex align-items-center justify-content-center bg-brand-soft icon-container-lg">
                  <i className="fas fa-check fs-5 text-brand"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NEEDS ATTENTION TRIAGE PANEL */}
        <div className="card border-0 shadow-sm rounded-xl mb-4 overflow-hidden">
          <div className="card-header bg-white border-0 p-4 pb-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                <i className="fas fa-bell text-warning"></i>
                Needs Attention Today
                {attentionItems.length > 0 && (
                  <span className="badge rounded-pill bg-danger ms-2" style={{ fontSize: '0.75rem' }}>
                    {attentionItems.length}
                  </span>
                )}
              </h5>
              <p className="text-muted small mb-0">Pending cheques, quotation clarifications, and schedule change requests</p>
            </div>
            <Link to="/admin/orders" className="btn btn-brand btn-sm rounded-pill px-3 fw-semibold text-white">
              View All Orders <i className="fas fa-arrow-right ms-1"></i>
            </Link>
          </div>
          <div className="card-body p-4">
            {loading ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                <span className="small">Checking operational triage...</span>
              </div>
            ) : attentionItems.length === 0 ? (
              <div className="text-center py-3 text-muted">
                <i className="fas fa-check-circle text-success fs-3 mb-2 d-block"></i>
                <span className="fw-medium">All caught up! No cheques, clarifications, or reschedule requests pending triage.</span>
              </div>
            ) : (
              <div className="row g-3">
                {attentionItems.slice(0, 6).map((item, idx) => (
                  <div key={item.id || idx} className="col-md-6 col-lg-4">
                    <div className="p-3 rounded border bg-light h-100 d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className={`badge rounded-pill ${item.badgeClass} px-2 py-1`} style={{ fontSize: '0.75rem', ...(item.badgeStyle || {}) }}>
                            {item.badgeText}
                          </span>
                          <span className="badge bg-white text-dark border px-2 py-1 fw-bold text-nowrap">#{formatOrderReference(item.order_id)}</span>
                        </div>
                        <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                          <i className={item.icon} style={item.iconStyle || {}}></i>
                          <span className="text-truncate">{item.client}</span>
                        </div>
                        <p className="small text-secondary mb-0">{item.details}</p>
                      </div>
                      <div className="mt-3 pt-2 border-top text-end">
                        <Link to={`/admin/orders?orderId=${encodeURIComponent(item.order_id)}`} className="btn btn-sm btn-brand rounded-pill px-3 py-1 text-white">
                          Manage <i className="fas fa-chevron-right ms-1" style={{ fontSize: '0.7rem' }}></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MAIN CHARTS GRID */}
        <div className="row g-4 align-items-stretch">
          {/* Daily Gross Sales Chart (Large Left) */}
          <div className="col-lg-7 d-flex">
            <div className="card border-0 shadow-sm w-100 rounded-xl d-flex flex-column">
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Gross Sales Statistics</h5>
                  <div className="d-flex gap-2">
                    <button 
                      className={`btn btn-sm ${salesPeriod === 'daily' ? 'btn-brand' : 'btn-solid-light'}`} 
                      onClick={() => setSalesPeriod('daily')}
                    >Daily</button>
                    <button 
                      className={`btn btn-sm ${salesPeriod === 'monthly' ? 'btn-brand' : 'btn-solid-light'}`} 
                      onClick={() => setSalesPeriod('monthly')}
                    >Monthly</button>
                    <button 
                      className={`btn btn-sm ${salesPeriod === 'quarterly' ? 'btn-brand' : 'btn-solid-light'}`} 
                      onClick={() => setSalesPeriod('quarterly')}
                    >Quarterly</button>
                    <button 
                      className={`btn btn-sm ${salesPeriod === 'yearly' ? 'btn-brand' : 'btn-solid-light'}`} 
                      onClick={() => setSalesPeriod('yearly')}
                    >Yearly</button>
                  </div>
                </div>
                <div className="flex-grow-1 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                  {loading ? (
                    <div className="text-center text-muted">
                      <div className="spinner-border text-success mb-2" role="status"></div>
                      <p className="mb-0 small">Loading sales statistics...</p>
                    </div>
                  ) : allOrders.length === 0 ? (
                    <div className="text-center text-muted">
                      <i className="fas fa-chart-bar fs-1 mb-3 text-light"></i>
                      <p className="mb-0">No sales data available yet.</p>
                    </div>
                  ) : (
                    <canvas ref={lineChartRef} role="img" aria-label="Bar chart showing gross sales over time"></canvas>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Sources / Order Status Chart (Smaller Right) */}
          <div className="col-lg-5 d-flex">
            <div className="card border-0 shadow-sm w-100 rounded-xl d-flex flex-column">
              <div className="card-body p-4 d-flex flex-column">
                <h5 className="fw-bold text-dark mb-4" style={{ fontSize: '1.1rem' }}>Order Status Overview</h5>
                <div className="flex-grow-1 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                  {loading ? (
                    <div className="text-center text-muted">
                      <div className="spinner-border text-success mb-2" role="status"></div>
                      <p className="mb-0 small">Loading status distribution...</p>
                    </div>
                  ) : allOrders.length === 0 ? (
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
        <div className="row mt-4 g-4 align-items-stretch">
          {/* Most Availed Services (Modern Ranked Leaderboard) */}
          <div className="col-lg-6 d-flex">
            <div className="card border-0 shadow-sm w-100 rounded-xl d-flex flex-column">
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
                <div className="flex-grow-1 overflow-auto pe-1" style={{ minHeight: '300px' }}>
                  {loading ? (
                    <div className="text-center py-5 text-muted my-auto">
                      <div className="spinner-border text-success mb-2" role="status"></div>
                      <p className="mb-0 small">Loading service rankings...</p>
                    </div>
                  ) : serviceStats.length === 0 ? (
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
                                  backgroundColor: '#0D8D1E'
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
          <div className="col-lg-6 d-flex">
            <div className="card border-0 shadow-sm w-100 rounded-xl d-flex flex-column">
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Sales Growth Statistics</h5>
                  <div className="d-flex gap-2">
                    <button 
                      className={`btn btn-sm ${growthPeriod === 'monthly' ? 'btn-brand' : 'btn-solid-light'}`} 
                      onClick={() => setGrowthPeriod('monthly')}
                    >Monthly</button>
                    <button 
                      className={`btn btn-sm ${growthPeriod === 'quarterly' ? 'btn-brand' : 'btn-solid-light'}`} 
                      onClick={() => setGrowthPeriod('quarterly')}
                    >Quarterly</button>
                    <button 
                      className={`btn btn-sm ${growthPeriod === 'yearly' ? 'btn-brand' : 'btn-solid-light'}`} 
                      onClick={() => setGrowthPeriod('yearly')}
                    >Yearly</button>
                  </div>
                </div>
                <div className="flex-grow-1 d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                  {loading ? (
                    <div className="text-center text-muted">
                      <div className="spinner-border text-success mb-2" role="status"></div>
                      <p className="mb-0 small">Calculating growth trends...</p>
                    </div>
                  ) : groupedOrders.length < 2 ? (
                    <div className="text-center text-muted p-4">
                      <i className="fas fa-chart-line fs-1 mb-3 text-secondary opacity-50 d-block"></i>
                      <p className="fw-semibold text-dark mb-1">Not enough historical data to calculate sales growth</p>
                      <small className="text-muted">Growth trends will automatically appear once orders span across 2 or more comparison periods ({growthPeriod}).</small>
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
        <div className="row mt-4 g-4 align-items-stretch">
          <div className="col-lg-8 d-flex">
            <div className="card border-0 shadow-sm w-100 rounded-xl d-flex flex-column">
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Calendar</h5>
                  <Link to="/admin/calendar" className="text-brand text-decoration-none small fw-bold">
                    Full Screen View <i className="fas fa-arrow-right ms-1"></i>
                  </Link>
                </div>
                <div className="flex-grow-1">
                  <AdminCalendar orders={groupedOrders} />
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4 d-flex">
            <div className="card border-0 shadow-sm w-100 rounded-xl overflow-hidden d-flex flex-column">
              <div className="card-body p-3 p-sm-4 d-flex flex-column flex-grow-1">
                <div className="d-flex justify-content-between align-items-center mb-3 mb-sm-4">
                  <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.1rem' }}>Recent Orders</h5>
                  <Link to="/admin/orders" className="text-brand text-decoration-none small fw-bold">View All</Link>
                </div>
                <div 
                  className="flex-grow-1 d-flex flex-column gap-2 gap-sm-3 recent-orders-list" 
                  style={{ minHeight: 0, overflowY: 'auto' }}
                >
                  {loading ? (
                    <div className="text-center text-muted my-auto py-5">
                      <div className="spinner-border text-success mb-3" role="status"></div>
                      <p className="mb-0 fw-bold text-dark">Loading recent orders...</p>
                    </div>
                  ) : recentOrders.length === 0 ? (
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
                        className="d-flex align-items-center p-2 p-sm-3 rounded"
                        style={{
                          backgroundColor: '#f8f9fa',
                          border: '1px solid rgba(0,0,0,0.05)',
                          cursor: order.order_id ? 'pointer' : 'default',
                          width: '100%',
                          minWidth: 0
                        }}
                        onClick={() => {
                          if (order.order_id) {
                            navigate(`/admin/orders?orderId=${encodeURIComponent(order.order_id)}`);
                          }
                        }}
                      >
                        <div className="rounded-circle d-flex align-items-center justify-content-center me-2 me-sm-3 flex-shrink-0 bg-brand-soft icon-container-md text-brand">
                          <i className="fas fa-shopping-bag"></i>
                        </div>
                        <div className="flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
                          <h6 className="mb-1 fw-bold text-truncate" style={{ fontSize: '0.88rem' }}>
                            {order.service_name || order.service_type || 'Service'}
                          </h6>
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <small className="text-muted text-truncate" style={{ minWidth: 0, flex: '1 1 auto' }}>
                              {formatName(order)}
                            </small>
                            <span 
                              className="badge flex-shrink-0" 
                              style={{
                                backgroundColor: order.status === 'Completed' ? '#2e7d32' :
                                  order.status === 'Pending' ? '#ffb300' :
                                    order.status === 'Cancelled' ? '#d32f2f' : '#2563eb',
                                color: '#ffffff',
                                fontSize: '0.68rem',
                                padding: '4px 8px'
                              }}
                            >
                              {order.status}
                            </span>
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
