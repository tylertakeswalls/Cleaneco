import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import logo from '../assets/styles/images/logo_fixed.png';

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  // track logged in user state from session storage
  const [loggedInUser, setLoggedInUser] = useState(sessionStorage.getItem("loggedInUser"));

  // update user state when location changes (pagtapos ng login/logout)
  useEffect(() => {
    setLoggedInUser(sessionStorage.getItem("loggedInUser"));
  }, [location]);

  // handle user logout or clear session and redirect to home
  const handleLogout = () => {
    sessionStorage.removeItem("loggedInUser");
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("token");
    
    // Clear localStorage to revoke "Remember Me" access on logout
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("userId");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("token");
    setLoggedInUser(null);
    navigate('/');
  };

  // render different navigation links based on user role
  const renderNavLinks = () => {
    
    // admin user navigation menu
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
    
    // regular logged in client navigation menu
    if (loggedInUser && loggedInUser !== 'admin') {
      return (
        <>
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/client' ? 'active' : ''}`} to="/client">
              Home
            </Link>
          </li>
          
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/order' ? 'active' : ''}`} to="/order">
              Book Order
            </Link>
          </li>
          
          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/orders' ? 'active' : ''}`} to="/orders">
              Ongoing Orders
            </Link>
          </li>

          {/* services dropdown menu for clients */}
          <li className="nav-item dropdown">
            <button 
              className="nav-link dropdown-toggle btn btn-link" 
              id="servicesDropdown"
              data-bs-toggle="dropdown" 
              aria-haspopup="true" 
              aria-expanded="false"
            >
              Our Services
            </button>
            <div className="dropdown-menu" aria-labelledby="servicesDropdown">
              <Link className="dropdown-item" to="/client/services/siphoning-desludging">Siphoning / Desludging</Link>
              <div className="dropdown-divider"></div>
              <Link className="dropdown-item" to="/client/services/deep-cleaning">Deep Cleaning</Link>
              <div className="dropdown-divider"></div>
              <Link className="dropdown-item" to="/client/services/declogging">Declogging</Link>
            </div>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`} to="/about">
              About Us
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${location.pathname === '/resources' ? 'active' : ''}`} to="/resources">
              Resources
            </Link>
          </li>
        </>
      );
    }

    // public navigation menu for non-logged in users
    return (
      <>
        <li className="nav-item">
          <Link className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} to="/">
            Home
          </Link>
        </li>

        {/* services dropdown menu for non-logged in users */}
        <li className="nav-item dropdown">
          <button 
            className="nav-link dropdown-toggle btn btn-link" 
            id="servicesDropdown"
            data-bs-toggle="dropdown" 
            aria-haspopup="true" 
            aria-expanded="false"
          >
            Our Services
          </button>
          <div className="dropdown-menu" aria-labelledby="servicesDropdown">
            <Link className="dropdown-item" to="/services/siphoning-desludging">Siphoning / Desludging</Link>
            <div className="dropdown-divider"></div>
            <Link className="dropdown-item" to="/services/deep-cleaning">Deep Cleaning</Link>
            <div className="dropdown-divider"></div>
            <Link className="dropdown-item" to="/services/declogging">Declogging</Link>
          </div>
        </li>

        <li className="nav-item">
          <Link className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`} to="/about">
            About Us
          </Link>
        </li>

        <li className="nav-item">
          <Link className={`nav-link ${location.pathname === '/resources' ? 'active' : ''}`} to="/resources">
            Resources
          </Link>
        </li>
      </>
    );
  };

  // determine where the logo/brand should link based on user role
  const renderBrandLink = () => {
    if (loggedInUser === 'admin') {
      return '/admin';
    } else if (loggedInUser && loggedInUser !== 'admin') {
      return '/client';
    } else {
      return '/';
    }
  };

  // main header/navigation component
  return (
    <nav className="navbar navbar-expand-lg navbar-cleaneco">
      <div className="container-fluid">
        {/* logo that links to appropriate dashboard based on user role */}
        <Link className="navbar-brand" to={renderBrandLink()}>
          <img src={logo} height="60" width="auto" alt="Cleaneco Logo" />
        </Link>

        {/* mobile menu toggle button */}
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent" 
          aria-expanded="false" 
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* main navigation content */}
        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          {/* left side navigation links */}
          <ul className="navbar-nav me-auto">
            {renderNavLinks()}
          </ul>

          {/* right side auth links (login/register or logout) */}
          <ul className="navbar-nav ms-auto">
            {!loggedInUser ? (
              <>
                <li className="nav-item">
                  <Link className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`} to="/register">
                    Register
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`} to="/login">
                    Login
                  </Link>
                </li>
              </>
            ) : (
              // logout button for logged in users
              <li className="nav-item">
                <button 
                  className="nav-link btn btn-link" 
                  onClick={handleLogout}
                  style={{border: 'none', background: 'none', color: 'inherit'}}
                >
                  Logout
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Header;