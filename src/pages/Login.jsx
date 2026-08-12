import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import '../assets/styles/auth.css';
import logocontainer from '../assets/styles/images/logo_container.png';

function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [lockdownTimer, setLockdownTimer] = useState(0);
  const navigate = useNavigate();

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    setMessage('');
    try {
      const response = await api.post('/auth/resend-verification', { email: unverifiedEmail });
      if (response.data.success) {
        setMessage('Verification email resent! Please check your inbox.');
        setUnverifiedEmail(null);
      } else {
        setMessage(response.data.message || 'Failed to resend email.');
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'An error occurred while resending.');
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (lockdownTimer > 0) {
      const timerId = setInterval(() => {
        setLockdownTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timerId);
    } else if (lockdownTimer === 0 && message && message.includes('locked')) {
      setMessage('');
    }
  }, [lockdownTimer, message]);

  useEffect(() => {
    const loggedInUser = localStorage.getItem("loggedInUser") || sessionStorage.getItem("loggedInUser");
    const userRole = localStorage.getItem("userRole") || sessionStorage.getItem("userRole");
    
    if (loggedInUser) {
      if (userRole === "admin") {
        navigate('/admin');
      } else {
        navigate('/client');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await api.post('/auth/login', {
        email: formData.username,
        password: formData.password
      });
      
      const data = response.data;
      
      if (data.success) {
        // ALWAYS store in sessionStorage so current tab/process works exactly as expected
        sessionStorage.setItem("loggedInUser", data.user.username);
        sessionStorage.setItem("userId", data.user.id);
        sessionStorage.setItem("userRole", data.user.role);
        sessionStorage.setItem("userEmail", data.user.email);
        sessionStorage.setItem("userName", `${data.user.first_name} ${data.user.last_name}`);
        if (data.user.date_of_birth) {
          sessionStorage.setItem("userDob", data.user.date_of_birth);
        }
        
        if (data.token) {
          sessionStorage.setItem("token", data.token);
        }

        // Conditionally store in localStorage if Remember Me was selected
        if (rememberMe) {
          localStorage.setItem("loggedInUser", data.user.username);
          localStorage.setItem("userId", data.user.id);
          localStorage.setItem("userRole", data.user.role);
          localStorage.setItem("userEmail", data.user.email);
          localStorage.setItem("userName", `${data.user.first_name} ${data.user.last_name}`);
          if (data.user.date_of_birth) {
            localStorage.setItem("userDob", data.user.date_of_birth);
          }
          
          if (data.token) {
            localStorage.setItem("token", data.token);
          }
        }
        
        setMessage("Login successful! Redirecting...");
        
        setTimeout(() => {
          if (data.user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/client');
          }
        }, 1000);
        
      } else {
        setMessage(data.message || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error.response?.data?.locked) {
        setLockdownTimer(error.response.data.remainingSeconds || 60);
        setMessage(error.response.data.message);
      } else {
        if (error.response?.data?.notVerified) {
          setUnverifiedEmail(error.response.data.email);
        } else {
          setUnverifiedEmail(null);
        }
        setMessage(error.response?.data?.message || "Login failed. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <>
      <div className="form-wrapper">
      <div className="form-header">
        <h3>Login</h3>
      </div>

      <div className="form-top-title">
        <img src={logocontainer} alt="logocontainer" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <div className="input-group">
            <i className="fas fa-user"></i>
            <input 
              type="text" 
              className="form-control" 
              name="username"
              placeholder="Username" 
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
              required 
            />
          </div>
        </div>

        <div className="form-group">
          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input 
              type="password" 
              className="form-control" 
              name="password"
              placeholder="Password" 
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required 
            />
          </div>
        </div>

        <div className="form-group d-flex justify-content-between align-items-center">
          <div className="form-check">
            <input 
              type="checkbox" 
              className="form-check-input" 
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="rememberMe">
              Remember me
            </label>
          </div>
          <button 
            type="button" 
            className="btn btn-link p-0"
            onClick={() => setShowForgotPasswordModal(true)}
          >
            Forgot password?
          </button>
        </div>

        {lockdownTimer > 0 && (
          <div className="alert alert-danger text-center">
            Account temporarily locked. Please try again in {lockdownTimer} seconds.
          </div>
        )}

        {message && !lockdownTimer && (
          <div className={`alert ${message.includes('successful') || message.includes('resent') ? 'alert-success' : 'alert-danger'} text-center`}>
            {message}
            {unverifiedEmail && (
              <div className="mt-3">
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-danger fw-bold" 
                  onClick={handleResendVerification}
                  disabled={resending}
                >
                  {resending ? 'Resending...' : 'Resend Verification Email'}
                </button>
              </div>
            )}
          </div>
        )}

        <button 
          type="submit" 
          className="btn-register-custom"
          disabled={loading || lockdownTimer > 0}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Logging in...
            </>
          ) : 'Login'}
        </button>
      </form>

      <div className="support-text">
        <p>
          For assistance, please contact us at <br />
          <a href="mailto:cleaneco-it@cwms.com.ph">cleaneco-it@cwms.com.ph</a>
        </p>
      </div>

      <div className="support-text">
        <p>
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>

      {showForgotPasswordModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'transparent', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ backgroundColor: '#0D8D1E', color: 'white' }}>
                <h5 className="modal-title text-white">
                  Password Reset
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowForgotPasswordModal(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body text-start mt-3 mb-3">
                <div className="text-center mb-3">
                  <i className="fas fa-envelope-open-text" style={{ fontSize: '3rem', color: '#0D8D1E' }}></i>
                </div>
                <h6 className="fw-normal mb-2 text-center">For security reasons, password resets are handled manually by our IT support team.</h6>
                <h6 className="fw-bold mb-1 text-center">Please contact:</h6>
                <div className="text-center">
                  <a href="mailto:cleaneco-it@cwms.com.ph" className="fs-5 text-decoration-none" style={{ color: '#0D8D1E', fontWeight: '700' }}>cleaneco-it@cwms.com.ph</a>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setShowForgotPasswordModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Login;