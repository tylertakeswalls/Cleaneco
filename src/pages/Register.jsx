import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/auth.css';
import logocontainer from '../assets/styles/images/logo_container.png';

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    barangay: '',
    city: '',
    province: '',
    gender: '',
    dateOfBirth: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate();

  // Terms of Service state
  const [isTosModalOpen, setIsTosModalOpen] = useState(false);
  const [isTosAccepted, setIsTosAccepted] = useState(false);

  const handleChange = (e) => {
    let { name, value } = e.target;
    
    if (name === 'phone') {
      let digits = value.replace(/\D/g, '');
      if (digits.startsWith('63')) digits = digits.substring(2);
      else if (digits.startsWith('0')) digits = digits.substring(1);

      if (digits.length > 0) {
        if (digits.length <= 3) {
          value = `(+63) ${digits}`;
        } else if (digits.length <= 6) {
          value = `(+63) ${digits.slice(0, 3)}-${digits.slice(3)}`;
        } else {
          value = `(+63) ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
        }
      } else {
        value = '';
      }
    }

    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validations: Name must be string only
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(formData.firstName)) {
      setMessage("First name must contain letters and spaces only.");
      setLoading(false);
      return;
    }
    if (!nameRegex.test(formData.lastName)) {
      setMessage("Last name must contain letters and spaces only.");
      setLoading(false);
      return;
    }

    // Validations: Phone number must match (+63) xxx-xxx-xxxx
    const phoneRegex = /^\(\+63\) \d{3}-\d{3}-\d{4}$/;
    if (!phoneRegex.test(formData.phone)) {
      setMessage("Phone number must be in the format (+63) xxx-xxx-xxxx.");
      setLoading(false);
      return;
    }

    // Validations: Birthday cannot be in the future
    if (formData.dateOfBirth) {
      const dobDate = new Date(formData.dateOfBirth);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // reset time

      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }

      if (dobDate > today) {
        setMessage("Date of birth cannot be in the future.");
        setLoading(false);
        return;
      }
      
      if (age < 18) {
        setMessage("You must be at least 18 years old to register.");
        setLoading(false);
        return;
      }
    }

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
      // Concatenate address categories
      const fullAddress = `${formData.addressLine1}${formData.addressLine2 ? ', ' + formData.addressLine2 : ''}, Barangay ${formData.barangay}, ${formData.city}, ${formData.province}`;

      // Create payload with combined address
      const payload = {
        username: formData.username,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: fullAddress,
        dateOfBirth: formData.dateOfBirth,
        password: formData.password
      };
      const response = await api.post('/auth/register', payload);
      const data = response.data;
      
      if (data.success) {
        setShowSuccessModal(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setMessage(data.message || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(error.response?.data?.message || "Registration failed. Please check your connection and try again.");
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
        {/* --- Personal Information --- */}
        <h5 className="mb-3 mt-2 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-user-circle me-2"></i>Personal Information
        </h5>
        <div className="row">
          <div className="col-md-4">
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
          <div className="col-md-4">
            <div className="form-group">
              <input
                type="text"
                name="middleName"
                className="form-control"
                placeholder="Middle Name (Optional)"
                value={formData.middleName}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="col-md-4">
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
              <select
                name="gender"
                className="form-control"
                value={formData.gender}
                onChange={handleChange}
                required
                style={{ color: formData.gender ? '#333' : '#6c757d' }}
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
                style={{ color: formData.dateOfBirth ? '#333' : '#6c757d' }}
              />
            </div>
          </div>
        </div>

        {/* --- Contact Information --- */}
        <h5 className="mb-3 mt-4 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-address-book me-2"></i>Contact Information
        </h5>
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

        {/* --- Address Details --- */}
        <h5 className="mb-3 mt-4 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-map-marker-alt me-2"></i>Address Details
        </h5>
        <div className="row">
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="text"
                name="addressLine1"
                className="form-control"
                placeholder="Address Line 1 (Street, House No.)"
                value={formData.addressLine1}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group">
              <input
                type="text"
                name="addressLine2"
                className="form-control"
                placeholder="Address Line 2 (Subdivision - Optional)"
                value={formData.addressLine2}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-md-4">
            <div className="form-group">
              <input
                type="text"
                name="barangay"
                className="form-control"
                placeholder="Barangay"
                value={formData.barangay}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <input
                type="text"
                name="city"
                className="form-control"
                placeholder="City/Municipality"
                value={formData.city}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group">
              <input
                type="text"
                name="province"
                className="form-control"
                placeholder="Province"
                value={formData.province}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        {/* --- Account Security --- */}
        <h5 className="mb-3 mt-4 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-shield-alt me-2"></i>Account Security
        </h5>
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

        <div className="row">
          <div className="col-md-6">
            <div className="form-group">
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-control"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                  minLength="6"
                  style={{ paddingRight: '2.5rem' }}
                />
                <span 
                  style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', zIndex: 10 }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"} style={{ color: '#0D8D1E' }}></i>
                </span>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group">
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  className="form-control"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                  minLength="6"
                  style={{ paddingRight: '2.5rem' }}
                />
                <span 
                  style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', zIndex: 10 }}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"} style={{ color: '#0D8D1E' }}></i>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms of Service Section */}
        <div className="form-group text-center mb-3">
          <button 
            type="button" 
            className="btn rounded-pill fw-bold"
            onClick={() => { setIsTosModalOpen(true); }}
            style={{ 
              transition: 'all 0.3s ease', 
              minWidth: '250px',
              backgroundColor: isTosAccepted ? '#0D8D1E' : 'transparent',
              color: isTosAccepted ? 'white' : '#0D8D1E',
              border: '2px solid #0D8D1E'
            }}
          >
            {isTosAccepted ? <><i className="fas fa-check-circle me-2"></i>Terms of Service Accepted</> : <><i className="fas fa-file-contract me-2"></i>Review & Accept Terms of Service</>}
          </button>
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
        className={`modal fade ${isTosModalOpen ? 'show d-block' : ''} glass-modal`} 
        style={{ zIndex: 1050 }} 
        tabIndex="-1"
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content shadow-lg" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
            <div className="modal-header" style={{ backgroundColor: '#0D8D1E', borderBottom: 'none' }}>
              <h5 className="modal-title fw-bold text-white">Terms and Conditions</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsTosModalOpen(false)} aria-label="Close"></button>
            </div>
            <div className="modal-body p-0 bg-light" style={{ height: '60vh' }}>
              <iframe 
                src={`${api.defaults.baseURL}/settings/tos/pdf`} 
                title="Terms and Conditions"
                width="100%" 
                height="100%" 
                style={{ border: 'none' }}
              >
                <div className="p-5 text-center">
                  <p>Your browser does not support inline PDFs.</p>
                  <a href={`${api.defaults.baseURL}/settings/tos/pdf`} target="_blank" rel="noreferrer" className="btn-custom">
                    Click here to view the Terms and Conditions
                  </a>
                </div>
              </iframe>
            </div>
            <div className="modal-footer bg-light d-flex flex-column align-items-stretch" style={{ borderTop: 'none', gap: '1rem' }}>
              <div className="d-flex justify-content-center gap-4 py-2 border rounded" style={{ backgroundColor: '#fff', borderColor: '#e2e8f0' }}>
                <div className="form-check form-check-inline m-0">
                  <input 
                    className="form-check-input" 
                    type="radio" 
                    name="tosAgreement" 
                    id="tosAgreeYes" 
                    value="yes"
                    checked={isTosAccepted === true}
                    onChange={() => {
                        setIsTosAccepted(true);
                        setIsTosModalOpen(false);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label fw-bold text-success" htmlFor="tosAgreeYes" style={{ cursor: 'pointer' }}>
                    Yes, I agree
                  </label>
                </div>
                <div className="form-check form-check-inline m-0">
                  <input 
                    className="form-check-input" 
                    type="radio" 
                    name="tosAgreement" 
                    id="tosAgreeNo" 
                    value="no"
                    checked={isTosAccepted === false}
                    onChange={() => setIsTosAccepted(false)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label fw-bold text-danger" htmlFor="tosAgreeNo" style={{ cursor: 'pointer' }}>
                    No, I do not agree
                  </label>
                </div>
              </div>
              <div className="d-flex justify-content-end">
                <button type="button" className="btn text-white fw-bold px-4" style={{ backgroundColor: '#0D8D1E', borderRadius: '0.5rem' }} onClick={() => setIsTosModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <div 
        className={`modal fade ${showSuccessModal ? 'show d-block' : ''} glass-modal`} 
        style={{ zIndex: 1050 }} 
        tabIndex="-1"
      >
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content shadow-lg" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
            <div className="modal-header" style={{ backgroundColor: '#0D8D1E', borderBottom: 'none' }}>
              <h5 className="modal-title fw-bold text-white">Registration Successful!</h5>
            </div>
            <div className="modal-body p-4 bg-light text-center">
              <i className="fas fa-check-circle text-success mb-3" style={{ fontSize: '4rem' }}></i>
              <p className="fs-5 text-dark">Welcome to Cleaneco!</p>
              <p className="text-muted">Please check your email inbox (and spam folder) for a verification link to activate your account.</p>
              <p className="text-muted small mt-3">Redirecting to login...</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Register;