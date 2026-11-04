import { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../api/api';
import logo from '../assets/styles/images/logo_fixed.png';
import '../assets/styles/admin.css';
import { getNotificationRoute, getNotificationMeta } from '../utils/notificationRoutes';

export default function AdminLayout() {
  const [adminFullName, setAdminFullName] = useState(() => {
    const stored = sessionStorage.getItem("userName");
    if (stored && stored.trim() && stored !== "undefined" && stored !== "null") {
      return stored.trim();
    }
    const loggedIn = sessionStorage.getItem("loggedInUser");
    return loggedIn || "Admin";
  });
  const [profilePic, setProfilePic] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [showNotifTray, setShowNotifTray] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const loggedInUser = sessionStorage.getItem("loggedInUser");
    const userRole = sessionStorage.getItem("userRole");
    const userId = sessionStorage.getItem("userId");
    const storedName = sessionStorage.getItem("userName");

    if (!loggedInUser || userRole !== "admin") {
      navigate('/login');
      return;
    }

    if (storedName && storedName.trim() && storedName !== "undefined" && storedName !== "null") {
      setAdminFullName(storedName.trim());
    }

    let isMounted = true;
    const fetchInitialLayoutData = async () => {
      try {
        const promises = [
          loadNotifications(),
          loadUnreadMessages()
        ];
        if (userId) {
          promises.push(
            api.get(`/users/${userId}`)
              .then(res => {
                if (isMounted && res.data) {
                  if (res.data.profile_picture) {
                    setProfilePic(res.data.profile_picture);
                  }
                  const nameParts = [res.data.first_name, res.data.middle_name, res.data.last_name].filter(Boolean).join(' ').trim();
                  if (nameParts) {
                    setAdminFullName(nameParts);
                    sessionStorage.setItem('userName', nameParts);
                  }
                }
              })
              .catch(err => console.error(err))
          );
        }
        await Promise.all(promises);
      } catch (err) {
        console.error("Error loading layout data:", err);
      }
    };

    fetchInitialLayoutData();

    const handleProfileUpdate = (e) => {
      if (e.detail?.fullName) {
        setAdminFullName(e.detail.fullName);
      } else {
        const stored = sessionStorage.getItem("userName");
        if (stored && stored.trim()) setAdminFullName(stored.trim());
      }
      if (e.detail?.profilePic) {
        setProfilePic(e.detail.profilePic);
      }
    };

    window.addEventListener('user-name-updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);

    const interval = setInterval(() => {
      loadUnreadMessages();
      loadNotifications();
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('user-name-updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [navigate]);

  useEffect(() => {
    const stored = sessionStorage.getItem("userName");
    if (stored && stored.trim() && stored !== "undefined" && stored !== "null") {
      setAdminFullName(stored.trim());
    }
  }, [location.pathname]);

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    navigate('/');
  };

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      const data = response.data.notifications || [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const loadUnreadMessages = async () => {
    try {
      const res = await api.get('/messages/unread-count?role=admin');
      if (res.data && res.data.success) {
        setUnreadMessagesCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Error loading unread messages count:", err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.put('/notifications/' + notif.id + '/read');
        loadNotifications();
      } catch (error) {
        console.error("Error marking notification read:", error);
      }
    }
    setShowNotifTray(false);
    const targetRoute = getNotificationRoute(notif, true);
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.put('/notifications/read_all/all');
      loadNotifications();
    } catch (error) {
      console.error("Error marking all notifications read:", error);
    }
  };

  const renderNavActions = () => (
    <ul className="navbar-nav flex-row align-items-center mb-0">
      <li className="nav-item position-relative me-3" style={{ cursor: 'pointer' }} onClick={() => setShowNotifTray(!showNotifTray)} role="button" aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`} tabIndex={0}>
        <div className="nav-link">
          <i className="fas fa-bell fs-5" style={{ color: '#ffffff' }}></i>
          {unreadCount > 0 && (
            <span className="position-absolute translate-middle badge rounded-pill bg-danger" style={{ top: '25%', left: '80%', fontSize: '0.6rem' }}>
              {unreadCount}
            </span>
          )}
        </div>

        {showNotifTray && (
          <div className="card shadow-lg border position-absolute" style={{ top: '100%', right: '0', width: '350px', zIndex: 1050, borderRadius: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
            <div className="card-header bg-white d-flex justify-content-between align-items-center border-bottom py-2">
              <span className="fw-bold text-dark">Notifications</span>
              {unreadCount > 0 && (
                <button className="btn btn-link text-success p-0 fw-bold small text-decoration-none" style={{ fontSize: '0.8rem', color: '#0D8D1E' }} onClick={(e) => { e.stopPropagation(); handleMarkAllNotificationsRead(); }}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="list-group list-group-flush">
              {notifications.length === 0 ? (
                <div className="text-center p-3 text-secondary small">No notifications yet.</div>
              ) : (
                notifications.map(notif => {
                  const meta = getNotificationMeta(notif);
                  return (
                    <div 
                      key={notif.id} 
                      className={`list-group-item list-group-item-action p-3 border-bottom d-flex align-items-center gap-2 ${notif.is_read ? '' : 'bg-light'}`} 
                      style={{ cursor: 'pointer', borderLeft: notif.is_read ? 'none' : '4px solid #0D8D1E', transition: 'background-color 0.15s ease' }} 
                      onClick={() => handleNotificationClick(notif)}
                      title="Click to view details"
                    >
                      <div 
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '34px', height: '34px', backgroundColor: meta.iconBg, color: meta.iconColor }}
                      >
                        <i className={meta.icon} style={{ fontSize: '0.85rem' }}></i>
                      </div>
                      <div className="flex-grow-1 overflow-hidden">
                        <div className={`small ${notif.is_read ? 'text-secondary' : 'fw-bold text-dark'}`}>{notif.message}</div>
                        {notif.details && <div className="text-muted text-truncate" style={{ fontSize: '0.75rem', marginTop: '2px' }}>{notif.details}</div>}
                      </div>
                      {!notif.is_read && <span className="rounded-circle bg-success flex-shrink-0" style={{ width: '8px', height: '8px' }}></span>}
                      <i className="fas fa-chevron-right text-muted opacity-50 ms-1 flex-shrink-0" style={{ fontSize: '0.72rem' }}></i>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </li>

      <li className="nav-item dropdown position-relative">
        <div 
          className="nav-link dropdown-toggle d-flex align-items-center p-0" 
          role="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          aria-label="Admin account menu"
          style={{ cursor: 'pointer' }}
        >
          <img 
            src={profilePic || '/default_profile.jpg'} 
            alt="Profile" 
            className="rounded-circle bg-white"
            style={{ width: '35px', height: '35px', objectFit: 'cover', border: '2px solid #ffffff' }}
          />
        </div>
        <ul 
          className="dropdown-menu dropdown-menu-end shadow position-absolute" 
          style={{ right: 0, left: 'auto', minWidth: '160px', top: '100%', marginTop: '0.5rem', border: 'none', borderRadius: '8px' }}
        >
          <li>
            <Link className="dropdown-item fw-bold py-2" to="/admin/profile">
              <i className="fas fa-user-circle me-2 text-success"></i> My Account
            </Link>
          </li>
          <li><hr className="dropdown-divider my-1" /></li>
          <li>
            <button className="dropdown-item text-danger fw-bold py-2" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt me-2"></i> Logout
            </button>
          </li>
        </ul>
      </li>
    </ul>
  );

  return (
    <div className="d-flex admin-layout-wrapper" style={{ height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      
      {/* SIDEBAR */}
      <div 
        className="d-flex flex-column position-fixed shadow-sm admin-sidebar" 
        style={{ 
          top: 0, left: 0, bottom: 0, zIndex: 1100, 
          backgroundColor: '#0D8D1E'
        }}
      >
        <div className="p-4 d-none d-lg-flex align-items-center justify-content-center" style={{ height: '70px' }}>
          <img src={logo} alt="Cleaneco Logo" style={{ maxHeight: '40px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>

        {/* Mobile Sidebar Header */}
        <div className="px-3 py-2 d-flex d-lg-none align-items-center justify-content-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <img src={logo} alt="Cleaneco Logo" style={{ maxHeight: '35px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          {renderNavActions()}
        </div>

        {/* Sidebar Profile */}
        <div className="d-none d-lg-flex align-items-center px-4 py-3 mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <img 
            src={profilePic || '/default_profile.jpg'} 
            alt="Profile" 
            className="rounded-circle flex-shrink-0"
            style={{ width: '45px', height: '45px', objectFit: 'cover', border: '2px solid white' }}
          />
          <div className="ms-3 overflow-hidden flex-grow-1" style={{ minWidth: 0 }}>
            <h6 className="mb-0 fw-bold text-white text-truncate" title={adminFullName}>{adminFullName}</h6>
            <small className="text-white" style={{ fontSize: '0.75rem', opacity: 0.8 }}>Company Admin</small>
          </div>
        </div>

        <div className="p-3 flex-grow-1 overflow-auto">
          <div className="d-flex flex-column gap-1 admin-nav-links">
            <Link to="/admin" className={`btn btn-link text-start text-decoration-none d-flex align-items-center px-3 py-2 mb-1 text-white ${location.pathname === '/admin' ? '' : 'opacity-75'}`} style={location.pathname === '/admin' ? { fontWeight: '600', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.5rem' } : { fontWeight: '500' }}>
              <span className="flex-grow-1">Dashboard</span>
              <i className="fas fa-home ms-2"></i>
            </Link>
            <Link to="/admin/messages" className={`btn btn-link text-start text-decoration-none d-flex align-items-center px-3 py-2 mb-1 text-white ${location.pathname === '/admin/messages' ? '' : 'opacity-75'}`} aria-label={`Messages ${unreadMessagesCount > 0 ? `(${unreadMessagesCount} unread)` : ''}`} style={location.pathname === '/admin/messages' ? { fontWeight: '600', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.5rem' } : { fontWeight: '500' }}>
              <span className="flex-grow-1">Messages</span>
              {unreadMessagesCount > 0 && (
                <span className="badge rounded-pill bg-danger me-2" style={{ fontSize: '0.7rem' }}>
                  {unreadMessagesCount}
                </span>
              )}
              <i className="fas fa-comments ms-2"></i>
            </Link>
            <Link to="/admin/orders" className={`btn btn-link text-start text-decoration-none d-flex align-items-center px-3 py-2 mb-1 text-white ${location.pathname === '/admin/orders' ? '' : 'opacity-75'}`} aria-label="Orders Database" style={location.pathname === '/admin/orders' ? { fontWeight: '600', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.5rem' } : { fontWeight: '500' }}>
              <span className="flex-grow-1">All Orders</span>
              <i className="fas fa-database ms-2"></i>
            </Link>
            <Link to="/admin/calendar" className={`btn btn-link text-start text-decoration-none d-flex align-items-center px-3 py-2 mb-1 text-white ${location.pathname === '/admin/calendar' ? '' : 'opacity-75'}`} aria-label="Operations Calendar" style={location.pathname === '/admin/calendar' ? { fontWeight: '600', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.5rem' } : { fontWeight: '500' }}>
              <span className="flex-grow-1">Calendar</span>
              <i className="fas fa-calendar-alt ms-2"></i>
            </Link>
            <Link to="/admin/services" className={`btn btn-link text-start text-decoration-none d-flex align-items-center px-3 py-2 mb-1 text-white ${location.pathname === '/admin/services' ? '' : 'opacity-75'}`} style={location.pathname === '/admin/services' ? { fontWeight: '600', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.5rem' } : { fontWeight: '500' }}>
              <span className="flex-grow-1">Services</span>
              <i className="fas fa-cogs ms-2"></i>
            </Link>
            <Link to="/admin/users" className={`btn btn-link text-start text-decoration-none d-flex align-items-center px-3 py-2 mb-1 text-white ${location.pathname === '/admin/users' ? '' : 'opacity-75'}`} style={location.pathname === '/admin/users' ? { fontWeight: '600', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.5rem' } : { fontWeight: '500' }}>
              <span className="flex-grow-1">Users Setup</span>
              <i className="fas fa-users ms-2"></i>
            </Link>
            <Link to="/admin/settings" className={`btn btn-link text-start text-decoration-none d-flex align-items-center px-3 py-2 mb-1 text-white ${location.pathname === '/admin/settings' ? '' : 'opacity-75'}`} style={location.pathname === '/admin/settings' ? { fontWeight: '600', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.5rem' } : { fontWeight: '500' }}>
              <span className="flex-grow-1">Site Settings</span>
              <i className="fas fa-cog ms-2"></i>
            </Link>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow-1 d-flex flex-column admin-main-content">
        
        {/* TOP NAVBAR (Desktop Only) */}
        <nav className="navbar navbar-expand-lg navbar-cleaneco shadow-sm admin-top-navbar d-none d-lg-flex" style={{ minHeight: '84px' }}>
          <div className="container-fluid d-flex justify-content-end">
            {renderNavActions()}
          </div>
        </nav>

        {/* PAGE CONTENT */}
        <div className="flex-grow-1 overflow-auto admin-outlet-wrapper" style={{ paddingBottom: '100px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
