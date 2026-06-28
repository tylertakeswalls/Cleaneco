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

    // Validations: Phone number must be int only (digits only)
    const phoneRegex = /^[0-9]+$/;
    if (!phoneRegex.test(formData.phone)) {
      setMessage("Phone number must contain digits only.");
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
      const { addressLine1, addressLine2, barangay, city, province, ...otherData } = formData;
      const payload = {
        type: 'register',
        address: fullAddress,
        ...otherData
      };

      const response = await api.post('/submit.php', payload);
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