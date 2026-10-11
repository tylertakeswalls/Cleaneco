import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../api/api';
import logo from '../assets/styles/images/logo_fixed.png';

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loggedInUser, setLoggedInUser] = useState(sessionStorage.getItem("loggedInUser"));
  const [userId, setUserId] = useState(sessionStorage.getItem("userId"));
  
  // States for Profile and Notifications
  const [profilePic, setProfilePic] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifTray, setShowNotifTray] = useState(false);

  // Update auth state on location change (acting as a listener for login/logout)
  useEffect(() => {
    setLoggedInUser(sessionStorage.getItem("loggedInUser"));
    setUserId(sessionStorage.getItem("userId"));
  }, [location]);

  // Fetch user data and poll notifications when userId changes
  useEffect(() => {
    if (userId) {
      // Fetch user profile picture
      api.get(`/users/${userId}`)
        .then(res => {
          if (res.data && res.data.profile_picture) {
            setProfilePic(res.data.profile_picture);
          } else {
            setProfilePic('');
          }
        })
        .catch(err => console.error(err));

      // Poll notifications (lazy fetch once + 60s interval)
      if (loggedInUser !== 'admin') {
        loadNotifications(userId);
        const interval = setInterval(() => {
          loadNotifications(userId);
        }, 60000);
        return () => clearInterval(interval);
      }
    } else {
      setProfilePic('');
      setNotifications([]);
      setUnreadCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loggedInUser]);

  // Close mobile navbar on route change
  useEffect(() => {
    const navbarCollapse = document.getElementById('navbarSupportedContent');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      if (window.bootstrap && window.bootstrap.Collapse) {
        const bsCollapse = window.bootstrap.Collapse.getInstance(navbarCollapse) || new window.bootstrap.Collapse(navbarCollapse, { toggle: false });
        bsCollapse.hide();
      } else {
        const toggler = document.querySelector('.navbar-toggler');
        if (toggler && getComputedStyle(toggler).display !== 'none') {
          toggler.click();
        } else {
          navbarCollapse.classList.remove('show');
        }
      }
    }
  }, [location]);

  const loadNotifications = async (uid) => {
    try {
      const response = await api.get(`/notifications?userId=${uid}`);
      const data = response.data.notifications || [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.put(`/notifications/${notif.id}/read`);
        loadNotifications(userId);
      } catch (error) {
        console.error("Error marking notification read:", error);
      }
    }
    setShowNotifTray(false);
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.put(`/notifications/read_all/all?userId=${userId}`);
      loadNotifications(userId);
    } catch (error) {
      console.error("Error marking all notifications read:", error);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    setLoggedInUser(null);
    setUserId(null);
    setProfilePic('');
    navigate('/');
  };

  const renderNavLinks = () => {
    if (loggedInUser === 'admin') {
      return (
        <>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`} to="/admin">
              Dashboard
            </Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/admin/orders' ? 'active' : ''}`} to="/admin/orders">
              Order Database
            </Link>
          </li>
        </>
      );
    }
    
    if (loggedInUser && loggedInUser !== 'admin') {
      return (
        <>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/client' ? 'active' : ''}`} to="/client">Home</Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/order' ? 'active' : ''}`} to="/order">Book Order</Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/orders' ? 'active' : ''}`} to="/orders">Ongoing Orders</Link>
          </li>
          <li className="nav-item dropdown">
            <button className="nav-link dropdown-toggle btn btn-link" id="servicesDropdown" data-bs-toggle="dropdown">
              Our Services
            </button>
            <div className="dropdown-menu">
              <Link className="dropdown-item" to="/client/services/siphoning-desludging">Siphoning & Desludging</Link>
              <div className="dropdown-divider"></div>
              <Link className="dropdown-item" to="/client/services/deep-cleaning-declogging">Deep Cleaning & Declogging</Link>
            </div>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`} to="/about">About Us</Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/client/contact' || location.pathname === '/contact' ? 'active' : ''}`} to="/client/contact">Contact Us</Link>
          </li>
          <li className="nav-item dropdown">
            <button className="nav-link dropdown-toggle btn btn-link text-decoration-none" id="resourcesDropdownClient" data-bs-toggle="dropdown">
              Resources
            </button>
            <div className="dropdown-menu">
              <Link className="dropdown-item" to="/resources">General Resources</Link>
              <div className="dropdown-divider"></div>
              <a className="dropdown-item" href={`${api.defaults.baseURL}/settings/tos/pdf`} target="_blank" rel="noreferrer">Terms of Service</a>
            </div>
          </li>
        </>
      );
    }

    return (
      <>
        <li className="nav-item"><Link className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} to="/">Home</Link></li>
        <li className="nav-item dropdown">
          <button className="nav-link dropdown-toggle btn btn-link" id="servicesDropdown" data-bs-toggle="dropdown">Our Services</button>
          <div className="dropdown-menu">
            <Link className="dropdown-item" to="/services/siphoning-desludging">Siphoning & Desludging</Link>
            <div className="dropdown-divider"></div>
            <Link className="dropdown-item" to="/services/deep-cleaning-declogging">Deep Cleaning & Declogging</Link>
          </div>
        </li>
        <li className="nav-item"><Link className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`} to="/about">About Us</Link></li>
        <li className="nav-item"><Link className={`nav-link ${location.pathname === '/contact' ? 'active' : ''}`} to="/contact">Contact Us</Link></li>
        <li className="nav-item dropdown">
          <button className="nav-link dropdown-toggle btn btn-link text-decoration-none" id="resourcesDropdown" data-bs-toggle="dropdown">Resources</button>
          <div className="dropdown-menu">
            <Link className="dropdown-item" to="/resources">General Resources</Link>
            <div className="dropdown-divider"></div>
            <a className="dropdown-item" href={`${api.defaults.baseURL}/settings/tos/pdf`} target="_blank" rel="noreferrer">Terms of Service</a>
          </div>
        </li>
      </>
    );
  };

  const renderBrandLink = () => {
    if (loggedInUser === 'admin') return '/admin';
    if (loggedInUser && loggedInUser !== 'admin') return '/client';
    return '/';
  };

  const renderNavActions = () => {
    if (!loggedInUser) return null;
    return (
      <ul className="navbar-nav flex-row align-items-center mb-0 ms-auto me-2 me-lg-0">
        {loggedInUser !== 'admin' && (
          <li className="nav-item position-relative me-3" style={{ cursor: 'pointer' }} onClick={() => setShowNotifTray(!showNotifTray)}>
            <div className="nav-link">
              <i className="fas fa-bell fs-5" style={{ color: '#ffffff' }}></i>
              {unreadCount > 0 && (
                <span className="position-absolute translate-middle badge rounded-pill bg-danger" style={{ top: '25%', left: '80%', fontSize: '0.6rem' }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {showNotifTray && (
              <div className="card shadow-lg border position-absolute client-notif-tray" style={{ top: '100%', zIndex: 1050, borderRadius: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
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
                    notifications.map(notif => (
                      <div key={notif.id} className={`list-group-item list-group-item-action p-3 border-bottom d-flex align-items-start gap-2 ${notif.is_read ? '' : 'bg-light'}`} style={{ cursor: 'pointer', borderLeft: notif.is_read ? 'none' : '4px solid #0D8D1E' }} onClick={() => handleNotificationClick(notif)}>
                        <div className="flex-grow-1">
                          <div className={`small ${notif.is_read ? 'text-secondary' : 'fw-bold text-dark'}`}>{notif.message}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>{notif.details}</div>
                        </div>
                        {!notif.is_read && <span className="rounded-circle bg-success mt-1" style={{ width: '8px', height: '8px', flexShrink: 0 }}></span>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </li>
        )}
        
        {/* Profile Picture Link */}
        <li className="nav-item dropdown position-relative">
          <div className="nav-link dropdown-toggle d-flex align-items-center p-0" role="button" data-bs-toggle="dropdown" aria-expanded="false" style={{ cursor: 'pointer' }}>
            <img 
              src={profilePic || '/default_profile.jpg'} 
              alt="Profile" 
              className="rounded-circle bg-white"
              style={{ width: '35px', height: '35px', objectFit: 'cover', border: '2px solid #ffffff' }}
            />
          </div>
          <ul className="dropdown-menu shadow position-absolute" aria-labelledby="profileDropdown" style={{ right: 0, left: 'auto', minWidth: '160px', top: '100%', marginTop: '0.5rem' }}>
            <li>
              <Link className="dropdown-item fw-bold py-2" to={loggedInUser === 'admin' ? '/admin/profile' : '/client/profile'}>
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
  };

  // Hide the global header on the new Admin Dashboard so it doesn't conflict with the custom sidebar
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-cleaneco">
      <div className="container-fluid">
        <Link className="navbar-brand" to={renderBrandLink()}>
          <img src={logo} height="60" width="auto" alt="Cleaneco Logo" />
        </Link>

        {/* Actions + Toggler Wrap for Mobile Layout */}
        <div className="d-flex align-items-center order-lg-3 ms-lg-3">
          {renderNavActions()}
          <button className="navbar-toggler ms-2" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent">
            <span className="navbar-toggler-icon"></span>
          </button>
        </div>

        <div className="collapse navbar-collapse order-lg-2" id="navbarSupportedContent">
          <ul className="navbar-nav me-auto">
            {renderNavLinks()}
          </ul>

          {/* Login and Register Links (Only when NOT logged in) */}
          {!loggedInUser && (
            <ul className="navbar-nav ms-auto align-items-center">
              <li className="nav-item"><Link className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`} to="/register">Register</Link></li>
              <li className="nav-item"><Link className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`} to="/login">Login</Link></li>
            </ul>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Header;