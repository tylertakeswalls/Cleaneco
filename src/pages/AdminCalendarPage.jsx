import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import AdminCalendar from '../components/AdminCalendar';
import carousel2 from '../assets/styles/images/carousel2.webp';
import '../assets/styles/orderdatabase.css';
import '../assets/styles/adminCalendar.css';
import { resolveOrderSchedule } from '../utils/helpers';
import { groupOrdersByOrderId } from '../utils/pricing';

export default function AdminCalendarPage() {
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/orders');
      const ordersData = Array.isArray(res.data) ? res.data : (res.data?.orders || []);
      setAllOrders(ordersData);
    } catch (err) {
      console.error('Error fetching calendar orders:', err);
      setError('Unable to load scheduling calendar. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const groupedOrders = useMemo(() => groupOrdersByOrderId(allOrders), [allOrders]);

  // Operational metrics calculated from orders with resolved schedules
  const metrics = useMemo(() => {
    let prefInspection = 0;
    let confirmedInspection = 0;
    let serviceExecution = 0;
    let completed = 0;

    groupedOrders.forEach((order) => {
      const sched = resolveOrderSchedule(order);
      if (order.status === 'Completed') {
        completed++;
      } else if (sched.phase === 'pref_inspection') {
        prefInspection++;
      } else if (sched.phase === 'for_inspection') {
        confirmedInspection++;
      } else if (sched.phase === 'awaiting_execution') {
        serviceExecution++;
      }
    });

    return {
      total: groupedOrders.length,
      prefInspection,
      confirmedInspection,
      serviceExecution,
      completed
    };
  }, [groupedOrders]);

  return (
    <>
      {/* Page Hero Banner */}
      <img className="img-fluid banner-img" src={carousel2} alt="Operations Calendar Banner" />

      <section className="section-bg">
        <div className="table-box">
          {/* Page Title & Description (Centered to match Order Database & Registered Users) */}
          <div className="text-center mb-4">
            <h3 className="fw-bold text-dark mb-1">Operations & Scheduling Calendar</h3>
            <p className="text-muted small mb-0">Overview of site inspection appointments, service execution bookings, and truck assignments</p>
          </div>

          {/* Executive KPI Metric Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Total Bookings</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(13, 141, 30, 0.12)', color: '#0D8D1E' }}>
                    <i className="fas fa-calendar-check"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-dark">
                  {metrics.total}
                </div>
                <p className="db-kpi-subtext">
                  Scheduled Operations
                </p>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Pref. Inspections</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(217, 119, 6, 0.12)', color: '#d97706' }}>
                    <i className="fas fa-clipboard-list"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-warning">
                  {metrics.prefInspection}
                </div>
                <p className="db-kpi-subtext">
                  Awaiting Site Assessment
                </p>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Service Executions</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#2563eb' }}>
                    <i className="fas fa-truck-loading"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-primary">
                  {metrics.serviceExecution}
                </div>
                <p className="db-kpi-subtext">
                  Confirmed Service Dates
                </p>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="db-kpi-card">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="db-kpi-label">Completed Services</span>
                  <div className="db-kpi-icon" style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)', color: '#16a34a' }}>
                    <i className="fas fa-check"></i>
                  </div>
                </div>
                <div className="db-kpi-value text-success">
                  {metrics.completed}
                </div>
                <p className="db-kpi-subtext">
                  Successfully Executed
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar (Refresh beside All Orders) */}
          <div className="d-flex justify-content-end align-items-center mb-3 flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-solid-light rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-2 shadow-sm"
              onClick={fetchOrders}
              disabled={loading}
              title="Refresh scheduling data"
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin text-success' : 'text-success'}`}></i>
              <span>Refresh</span>
            </button>

            <Link
              to="/admin/orders"
              className="btn btn-sm btn-solid-brand rounded-pill px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
            >
              <i className="fas fa-database"></i>
              <span>All Orders</span>
            </Link>
          </div>

          {/* Main Calendar Panel */}
          <div className="card border shadow-sm rounded-3 overflow-hidden bg-white">
            <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-center align-items-center">
              <div className="d-flex align-items-center justify-content-center gap-3 gap-md-4 small text-muted flex-wrap">
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="rounded-circle" style={{ width: '9px', height: '9px', backgroundColor: '#dc2626' }}></span>
                  Cancelled
                </span>
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="rounded-circle" style={{ width: '9px', height: '9px', backgroundColor: '#ffb300' }}></span>
                  Pending / Pref.
                </span>
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="rounded-circle" style={{ width: '9px', height: '9px', backgroundColor: '#2563eb' }}></span>
                  In Progress / Execution
                </span>
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="rounded-circle" style={{ width: '9px', height: '9px', backgroundColor: '#2e7d32' }}></span>
                  Completed
                </span>
              </div>
            </div>

            <div className="card-body p-3 p-md-4">
              {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>{error}</span>
                </div>
              )}

              {loading ? (
                <div className="d-flex flex-column align-items-center justify-content-center py-5">
                  <div className="spinner-border text-success mb-3" role="status" style={{ color: '#0D8D1E' }}>
                    <span className="visually-hidden">Loading calendar...</span>
                  </div>
                  <p className="text-muted fw-semibold mb-0">Loading operations calendar & schedules...</p>
                </div>
              ) : (
                <AdminCalendar orders={groupedOrders} />
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
