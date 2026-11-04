import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import AdminCalendar from '../components/AdminCalendar';
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
    <div className="container-fluid px-3 px-md-4 py-4">
      {/* Header with Title and Quick Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className="d-inline-flex align-items-center justify-content-center rounded-circle text-white shadow-sm"
              style={{ width: '40px', height: '40px', backgroundColor: '#0D8D1E' }}
            >
              <i className="fas fa-calendar-alt fs-5"></i>
            </span>
            <h2 className="fw-bold mb-0 text-dark" style={{ letterSpacing: '-0.5px' }}>
              Operations & Scheduling Calendar
            </h2>
          </div>
          <p className="text-muted mb-0 small" style={{ marginLeft: '48px' }}>
            Comprehensive month view of all site inspections, confirmed service executions, and truck team schedules.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-light border bg-white shadow-sm rounded-pill px-3 py-2 fw-semibold text-secondary d-flex align-items-center gap-2"
            onClick={fetchOrders}
            disabled={loading}
            title="Refresh scheduling data"
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin text-success' : ''}`}></i>
            <span>Refresh</span>
          </button>
          <Link
            to="/admin/orders"
            className="btn text-white rounded-pill px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
            style={{ backgroundColor: '#0D8D1E', border: 'none' }}
          >
            <i className="fas fa-database"></i>
            <span>All Orders</span>
          </Link>
        </div>
      </div>

      {/* Operational Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '44px', height: '44px', backgroundColor: '#eef8f0', color: '#0D8D1E' }}
              >
                <i className="fas fa-calendar-check fs-5"></i>
              </div>
              <div className="overflow-hidden">
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                  Total Bookings
                </div>
                <div className="fs-4 fw-bold text-dark lh-1 mt-1">{metrics.total}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '44px', height: '44px', backgroundColor: '#fffbeb', color: '#b45309' }}
              >
                <i className="fas fa-clipboard-list fs-5"></i>
              </div>
              <div className="overflow-hidden">
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                  Pref. Inspections
                </div>
                <div className="fs-4 fw-bold text-dark lh-1 mt-1">{metrics.prefInspection}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '44px', height: '44px', backgroundColor: '#eff6ff', color: '#1d4ed8' }}
              >
                <i className="fas fa-truck-loading fs-5"></i>
              </div>
              <div className="overflow-hidden">
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                  Service Executions
                </div>
                <div className="fs-4 fw-bold text-dark lh-1 mt-1">{metrics.serviceExecution}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm rounded-3 h-100 bg-white">
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '44px', height: '44px', backgroundColor: '#f0fdf4', color: '#15803d' }}
              >
                <i className="fas fa-check-double fs-5"></i>
              </div>
              <div className="overflow-hidden">
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                  Completed Orders
                </div>
                <div className="fs-4 fw-bold text-dark lh-1 mt-1">{metrics.completed}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="card border-0 shadow-sm rounded-xl overflow-hidden bg-white mb-4">
        <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h5 className="fw-bold text-dark mb-0" style={{ fontSize: '1.05rem' }}>
              Monthly Schedule Grid
            </h5>
            <span className="badge rounded-pill bg-light text-secondary border px-2 py-1 small fw-normal">
              Click any date to inspect details
            </span>
          </div>

          <div className="d-flex align-items-center gap-3 small text-muted d-none d-lg-flex">
            <span className="d-inline-flex align-items-center gap-1">
              <span className="rounded-circle" style={{ width: '10px', height: '10px', backgroundColor: '#ffb300' }}></span>
              Pending / Pref.
            </span>
            <span className="d-inline-flex align-items-center gap-1">
              <span className="rounded-circle" style={{ width: '10px', height: '10px', backgroundColor: '#2563eb' }}></span>
              In Progress / Execution
            </span>
            <span className="d-inline-flex align-items-center gap-1">
              <span className="rounded-circle" style={{ width: '10px', height: '10px', backgroundColor: '#2e7d32' }}></span>
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
  );
}

