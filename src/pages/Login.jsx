import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/auth.css';
import logocontainer from '../assets/styles/images/logo_container.png';
import AlertModal from '../components/AlertModal';

function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [message, setMessage] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStatus, setForgotStatus] = useState('idle'); // idle | success | error
  const [forgotMessage, setForgotMessage] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [lockdownTimer, setLockdownTimer] = useState(0);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", type: "info" });
  const navigate = useNavigate();

  const handleOpenForgotPassword = () => {
    setForgotUsername(formData.username || '');
    setForgotStatus('idle');
    setForgotMessage('');
    setMaskedEmail('');
    setShowForgotPasswordModal(true);
  };

  const handleForgotPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!forgotUsername || !forgotUsername.trim()) {
      setForgotStatus('error');
      setForgotMessage('Please enter your username.');
      return;
    }

    setForgotLoading(true);
    setForgotStatus('idle');
    setForgotMessage('');

    try {
      const response = await api.post('/auth/forgot-password', {
        username: forgotUsername.trim()
      });

      if (response.data.success) {
        setForgotStatus('success');
        setMaskedEmail(response.data.maskedEmail || '');
        setForgotMessage(response.data.message || 'Password reset link sent.');
      } else {
        setForgotStatus('error');
        setForgotMessage(response.data.message || 'Failed to send password reset link.');
      }
    } catch (err) {
      setForgotStatus('error');
      setForgotMessage(err.response?.data?.message || 'Failed to process request. Please check your username.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeAlert = () => {
    setModalConfig({ ...modalConfig, isOpen: false });
  };

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
        // Store exactly as before, but with no boilerplate
        const userKeys = {
          loggedInUser: data.user.username,
          userId: data.user.id,
          userRole: data.user.role,
          userEmail: data.user.email,
          userName: `${data.user.first_name} ${data.user.last_name}`,
          ...(data.user.date_of_birth && { userDob: data.user.date_of_birth }),
          ...(data.token && { token: data.token })
        };

        Object.entries(userKeys).forEach(([key, value]) => {
          sessionStorage.setItem(key, value);
          localStorage.setItem(key, value);
        });
        
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
      if (error.response?.data?.inactive) {
        setModalConfig({
          isOpen: true,
          title: "Account Inactive",
          message: "Your account has been marked as inactive due to 1 year of inactivity. Please contact or email the company to reactivate your account.",
          type: "info"
        });
      } else if (error.response?.data?.locked) {
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
      <AlertModal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        type={modalConfig.type} 
        onClose={closeAlert} 
      />
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

        <div className="form-group d-flex justify-content-end align-items-center">
          <button 
            type="button" 
            className="btn btn-link p-0"
            onClick={handleOpenForgotPassword}
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
                  Reset Password
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowForgotPasswordModal(false)} 
                  aria-label="Close"
                ></button>
              </div>

              {forgotStatus === 'success' ? (
                /* Success View: Masked email confirmation */
                <>
                  <div className="modal-body text-center p-4">
                    <div className="mb-3">
                      <div className="rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px', background: '#dcfce7', color: '#0D8D1E' }}>
                        <i className="fas fa-envelope-open-text" style={{ fontSize: '2rem' }}></i>
                      </div>
                    </div>
                    <h5 className="fw-bold text-dark mb-2">Check Your Email</h5>
                    <p className="text-muted small mb-3">
                      A link to create a new password has been sent to:
                    </p>
                    <div className="p-2 px-3 d-inline-flex align-items-center fw-bold mb-3" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                      <i className="far fa-envelope me-2 text-success"></i>{maskedEmail}
                    </div>
                    <p className="text-muted small mb-0" style={{ fontSize: '0.85rem' }}>
                      Please check your inbox and spam folder. Click the link in the email to set your new password (valid for 1 hour).
                    </p>
                  </div>
                  <div className="modal-footer border-0 d-flex justify-content-between align-items-center px-4 pb-4 pt-2" style={{ flexWrap: 'nowrap' }}>
                    <div className="small text-muted text-start pe-2" style={{ fontSize: '0.85rem', lineHeight: '1.35' }}>
                      Didn't receive email?{' '}
                      <button
                        type="button"
                        onClick={handleForgotPasswordSubmit}
                        disabled={forgotLoading}
                        style={{ 
                          color: '#6c757d', 
                          fontSize: 'inherit', 
                          textDecoration: 'none',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          margin: 0,
                          boxShadow: 'none',
                          cursor: 'pointer',
                          display: 'inline',
                          verticalAlign: 'baseline',
                          fontFamily: 'inherit',
                          textTransform: 'none'
                        }}
                      >
                        {forgotLoading ? (
                          <span style={{ color: '#0D8D1E', fontWeight: 'bold' }}>Resending...</span>
                        ) : (
                          <>
                            Click <span style={{ color: '#0D8D1E', fontWeight: 'bold', textDecoration: 'underline' }}>here</span> to resend.
                          </>
                        )}
                      </button>
                    </div>
                    <button 
                      type="button" 
                      className="modal-btn-primary ms-auto" 
                      onClick={() => setShowForgotPasswordModal(false)}
                      style={{ minWidth: '110px', flexShrink: 0 }}
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                /* Input Form View */
                <form onSubmit={handleForgotPasswordSubmit}>
                  <div className="modal-body text-start mt-2 mb-2 p-4">
                    <p className="text-muted small mb-3">
                      Lost your password? Please enter your username. We will automatically send a link to create a new password to your registered email address.
                    </p>

                    {forgotStatus === 'error' && forgotMessage && (
                      <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
                        <i className="fas fa-exclamation-circle me-2"></i>{forgotMessage}
                      </div>
                    )}

                    <div className="form-group mb-0">
                      <label className="form-label small fw-bold text-dark mb-2">Username</label>
                      <div className="modal-reset-input-wrapper">
                        <i className="fas fa-user"></i>
                        <input
                          type="text"
                          className="form-control modal-reset-input"
                          placeholder="Enter your username"
                          value={forgotUsername}
                          onChange={(e) => setForgotUsername(e.target.value)}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer border-0 px-4 pb-4 pt-2">
                    <button 
                      type="button" 
                      className="modal-btn-secondary" 
                      onClick={() => setShowForgotPasswordModal(false)}
                      disabled={forgotLoading}
                      style={{ minWidth: '120px' }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="modal-btn-primary"
                      disabled={forgotLoading}
                      style={{ minWidth: '160px' }}
                    >
                      {forgotLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Sending Link...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-paper-plane me-2"></i>Send Reset Link
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Login;