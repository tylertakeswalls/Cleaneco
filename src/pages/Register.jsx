import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import '../assets/styles/auth.css';
import logocontainer from '../assets/styles/images/logo_container.png';

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    gender: '',
    dateOfBirth: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Terms of Service state
  const [tosContent, setTosContent] = useState('');
  const [isTosModalOpen, setIsTosModalOpen] = useState(false);
  const [hasOpenedTos, setHasOpenedTos] = useState(false);
  const [isTosAccepted, setIsTosAccepted] = useState(false);

  useEffect(() => {
    const fetchTos = async () => {
      try {
        const response = await api.get('/tos.php');
        if (response.data.success) {
          setTosContent(response.data.content);
        }
      } catch (error) {
        console.error("Error fetching TOS:", error);
      }
    };
    fetchTos();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setMessage("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    if (!isTosAccepted) {
      setMessage("You must read and accept the Terms and Conditions.");
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/submit.php', {
        type: 'register',
        ...formData
      });
      
      const data = response.data;
      
      if (data.success) {
        setMessage("Registration successful! Redirecting to login...");
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setMessage(data.message || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setMessage("Registration failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <h3>Registration</h3>
      </div>

      <div className="form-top-title">
        <img src={logocontainer} alt="logocontainer" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row">
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="text"
                name="firstName"
                className="form-control"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="text"
                name="lastName"
                className="form-control"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="tel"
                name="phone"
                className="form-control"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <input
            type="text"
            name="address"
            className="form-control"
            placeholder="Full Address"
            value={formData.address}
            onChange={handleChange}
            required
          />
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="form-group">
              <select
                name="gender"
                className="form-control"
                value={formData.gender}
                onChange={handleChange}
                required
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="date"
                name="dateOfBirth"
                className="form-control"
                value={formData.dateOfBirth}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="text"
                name="username"
                className="form-control"
                placeholder="Create Username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="password"
                name="password"
                className="form-control"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="6"
              />
            </div>
          </div>
        </div>
        <div className="form-group">
          <input
            type="password"
            name="confirmPassword"
            className="form-control"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            minLength="6"
          />
        </div>

        {/* Terms of Service Section */}
        <div className="form-group d-flex align-items-center justify-content-center mb-3">
          <input
            type="checkbox"
            id="tosCheckbox"
            checked={isTosAccepted}
            onChange={(e) => setIsTosAccepted(e.target.checked)}
            disabled={!hasOpenedTos}
            className="form-check-input mt-0 me-2"
            style={{ width: '1.2rem', height: '1.2rem', cursor: hasOpenedTos ? 'pointer' : 'not-allowed' }}
          />
          <label htmlFor="tosCheckbox" className="form-check-label d-flex align-items-center m-0" style={{ color: hasOpenedTos ? '#333' : '#888' }}>
            Have you read the&nbsp;
            <span 
              className="fw-bold" 
              style={{ cursor: 'pointer', color: '#0D8D1E', textDecoration: 'none' }} 
              onClick={() => { setIsTosModalOpen(true); setHasOpenedTos(true); }}
            >
              Terms and Conditions
            </span>?
          </label>
        </div>

        {message && (
          <div className={`alert ${message.includes('successful') ? 'alert-success' : 'alert-danger'} text-center`}>
            {message}
          </div>
        )}

        <button 
          type="submit" 
          className="btn-register-custom"
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="support-text">
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>

      {/* Terms of Service Modal */}
      <div 
        className={`modal fade ${isTosModalOpen ? 'show d-block' : ''}`} 
        style={{ zIndex: 1050, backgroundColor: 'transparent', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} 
        tabIndex="-1"
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content shadow-lg" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
            <div className="modal-header" style={{ backgroundColor: '#0D8D1E', borderBottom: 'none' }}>
              <h5 className="modal-title fw-bold text-white">Terms and Conditions</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsTosModalOpen(false)} aria-label="Close"></button>
            </div>
            <div className="modal-body p-4 bg-light" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#333' }}>
                {tosContent || "Loading Terms and Conditions..."}
              </div>
            </div>
            <div className="modal-footer bg-light" style={{ borderTop: 'none' }}>
              <button type="button" className="btn text-white fw-bold px-4" style={{ backgroundColor: '#0D8D1E', borderRadius: '0.5rem' }} onClick={() => setIsTosModalOpen(false)}>I have read the terms</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Register;