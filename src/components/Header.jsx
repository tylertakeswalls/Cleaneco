import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
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

  // Re-fetch user profile and notifications when route/auth changes
  useEffect(() => {
    const currentLoggedIn = sessionStorage.getItem("loggedInUser");
    const currentUserId = sessionStorage.getItem("userId");
    
    setLoggedInUser(currentLoggedIn);
    setUserId(currentUserId);

    if (currentUserId) {
      // Fetch user profile picture
      api.get(`/users/${currentUserId}`)
        .then(res => {
          if (res.data && res.data.profile_picture) {
            setProfilePic(res.data.profile_picture);
          } else {
            setProfilePic('');
          }
        })
        .catch(err => console.error(err));

      // Fetch client notifications if not admin
      if (currentLoggedIn !== 'admin') {
        loadNotifications(currentUserId);
      }
    } else {
      setProfilePic('');
      setNotifications([]);
      setUnreadCount(0);
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
              <Link className="dropdown-item" to="/client/services/siphoning-desludging">Siphoning / Desludging</Link>
              <div className="dropdown-divider"></div>
              <Link className="dropdown-item" to="/client/services/deep-cleaning">Deep Cleaning</Link>
              <div className="dropdown-divider"></div>
              <Link className="dropdown-item" to="/client/services/declogging">Declogging</Link>
            </div>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`} to="/about">About Us</Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/resources' ? 'active' : ''}`} to="/resources">Resources</Link>
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
            <Link className="dropdown-item" to="/services/siphoning-desludging">Siphoning / Desludging</Link>
            <div className="dropdown-divider"></div>
            <Link className="dropdown-item" to="/services/deep-cleaning">Deep Cleaning</Link>
            <div className="dropdown-divider"></div>
            <Link className="dropdown-item" to="/services/declogging">Declogging</Link>
          </div>
        </li>
        <li className="nav-item"><Link className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`} to="/about">About Us</Link></li>
        <li className="nav-item"><Link className={`nav-link ${location.pathname === '/resources' ? 'active' : ''}`} to="/resources">Resources</Link></li>
      </>
    );
  };

  const renderBrandLink = () => {
    if (loggedInUser === 'admin') return '/admin';
    if (loggedInUser && loggedInUser !== 'admin') return '/client';
    return '/';
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

        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent">
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav me-auto">
            {renderNavLinks()}
          </ul>

          <ul className="navbar-nav ms-auto align-items-center">
            {!loggedInUser ? (
              <>
                <li className="nav-item"><Link className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`} to="/register">Register</Link></li>
                <li className="nav-item"><Link className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`} to="/login">Login</Link></li>
              </>
            ) : (
              <>
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
                      <div className="card shadow-lg border position-absolute" style={{ top: '100%', right: '0', width: '320px', zIndex: 1050, borderRadius: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
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
                <li className="nav-item dropdown me-2 position-relative">
                  <div className="nav-link dropdown-toggle d-flex align-items-center" role="button" data-bs-toggle="dropdown" aria-expanded="false" style={{ cursor: 'pointer' }}>
                    <img 
                      src={profilePic || 'https://via.placeholder.com/40'} 
                      alt="Profile" 
                      className="rounded-circle bg-white"
                      style={{ width: '35px', height: '35px', objectFit: 'cover', border: '2px solid #ffffff' }}
                    />
                  </div>
                  <ul className="dropdown-menu dropdown-menu-end shadow position-absolute" aria-labelledby="profileDropdown" style={{ right: 0, left: 'auto', minWidth: '160px' }}>
                    <li>
                      <Link className="dropdown-item fw-bold" to={loggedInUser === 'admin' ? '/admin/profile' : '/client/profile'}>
                        <i className="fas fa-user-circle me-2 text-success"></i> My Account
                      </Link>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button className="dropdown-item text-danger fw-bold" onClick={handleLogout}>
                        <i className="fas fa-sign-out-alt me-2"></i> Logout
                      </button>
                    </li>
                  </ul>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Header;