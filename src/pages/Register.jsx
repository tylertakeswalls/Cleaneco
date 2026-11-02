import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import '../assets/styles/auth.css';
import logocontainer from '../assets/styles/images/logo_container.png';
import { PSGC_PROVINCES } from '../data/psgcData';
import { formatPhoneNumber } from '../utils/helpers';

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
    confirmPassword: '',
    clientType: 'residential',
    companyName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const navigate = useNavigate();

  // Field-level validator for onBlur and onChange
  const validateField = (name, value, allData = formData) => {
    const val = (value || '').trim();
    const nameRegex = /^[a-zA-ZÀ-ſ\s.\-']+$/;

    switch (name) {
      case 'firstName':
        if (!val) return 'First name is required.';
        if (!nameRegex.test(val)) return 'First name contains invalid characters.';
        return '';
      case 'middleName':
        if (val && !nameRegex.test(val)) return 'Middle name contains invalid characters.';
        return '';
      case 'lastName':
        if (!val) return 'Last name is required.';
        if (!nameRegex.test(val)) return 'Last name contains invalid characters.';
        return '';
      case 'gender':
        if (!value) return 'Please select your gender.';
        return '';
      case 'dateOfBirth': {
        if (!value) return 'Date of birth is required.';
        const dobDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dobDate > today) return 'Date of birth cannot be in the future.';
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
        if (age < 18) return 'You must be at least 18 years old to register.';
        return '';
      }
      case 'email':
        if (!val) return 'Email address is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Please enter a valid email address.';
        return '';
      case 'phone': {
        if (!val) return 'Phone number is required.';
        const phoneRegex = /^\(\+63\) \d{3}-\d{3}-\d{4}$/;
        if (!phoneRegex.test(val)) return 'Format must be (+63) xxx-xxx-xxxx.';
        return '';
      }
      case 'addressLine1':
        if (!val) return 'Street address / house number is required.';
        return '';
      case 'barangay':
        if (!val) return 'Barangay is required.';
        return '';
      case 'city':
        if (!val) return 'City or municipality is required.';
        return '';
      case 'province':
        if (!val) return 'Province is required.';
        return '';
      case 'username':
        if (!val) return 'Username is required.';
        if (val.length < 3) return 'Username must be at least 3 characters.';
        return '';
      case 'password':
        if (!value) return 'Password is required.';
        if (value.length < 6) return 'Password must be at least 6 characters.';
        return '';
      case 'confirmPassword':
        if (!value) return 'Please confirm your password.';
        if (value !== allData.password) return 'Passwords do not match.';
        return '';
      case 'companyName':
        if ((allData.clientType === 'commercial' || allData.clientType === 'industrial') && !val) {
          return 'Company name is required for business accounts.';
        }
        return '';
      default:
        return '';
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const errorMsg = validateField(name, value, formData);
    setErrors(prev => ({ ...prev, [name]: errorMsg }));
  };

  // Terms of Service state
  const [isTosModalOpen, setIsTosModalOpen] = useState(false);
  const [isTosAccepted, setIsTosAccepted] = useState(false);

  const handleChange = (e) => {
    let { name, value } = e.target;

    if (name === 'province') {
      const updated = {
        ...formData,
        province: value,
        city: ''
      };
      setFormData(updated);
      if (touched.province) {
        setErrors(prev => ({
          ...prev,
          province: validateField('province', value, updated),
          city: ''
        }));
      }
      return;
    }

    if (name === 'phone') {
      value = formatPhoneNumber(value);
    }

    const updated = {
      ...formData,
      [name]: value
    };
    setFormData(updated);

    if (touched[name]) {
      const errorMsg = validateField(name, value, updated);
      setErrors(prev => ({ ...prev, [name]: errorMsg }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Trigger full validation for all fields
    const fieldsToValidate = [
      'firstName', 'middleName', 'lastName', 'gender', 'dateOfBirth',
      'email', 'phone', 'addressLine1', 'barangay', 'city', 'province',
      'username', 'password', 'confirmPassword'
    ];
    if (formData.clientType === 'commercial' || formData.clientType === 'industrial') {
      fieldsToValidate.push('companyName');
    }

    const newErrors = {};
    const newTouched = {};
    fieldsToValidate.forEach(field => {
      newTouched[field] = true;
      const err = validateField(field, formData[field], formData);
      if (err) newErrors[field] = err;
    });

    setTouched(newTouched);
    setErrors(newErrors);

    const firstError = Object.values(newErrors).find(msg => Boolean(msg));
    if (firstError) {
      setMessage(firstError);
      setLoading(false);
      return;
    }

    if (!isTosAccepted) {
      setMessage("You must read and accept the Terms of Service.");
      setLoading(false);
      return;
    }

    try {
      // Concatenate address categories
      const fullAddress = `${formData.addressLine1}${formData.addressLine2 ? ', ' + formData.addressLine2 : ''}, Barangay ${formData.barangay}, ${formData.city}, ${formData.province}`;

      // Create payload with combined address and explicit gender
      const payload = {
        username: formData.username,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: fullAddress,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2,
        province: formData.province,
        city: formData.city,
        barangay: formData.barangay,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        password: formData.password,
        clientType: formData.clientType,
        companyName: formData.companyName
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
        {/* --- Account Type --- */}
        <h5 className="mb-3 mt-2 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-briefcase me-2"></i>Account Type
        </h5>
        <div className="row mb-3">
          <div className="col-md-12">
            <div className="row g-2">
              <div className="col-12 col-sm-4">
                <div
                  className="card h-100 p-3 text-center border-2 shadow-sm"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderColor: formData.clientType === 'residential' ? '#0D8D1E' : '#e2e8f0',
                    backgroundColor: formData.clientType === 'residential' ? '#f0fdf4' : '#fff',
                    transform: formData.clientType === 'residential' ? 'translateY(-2px)' : 'none'
                  }}
                  onClick={() => setFormData({ ...formData, clientType: 'residential' })}
                >
                  <i className="fas fa-home mb-2 fs-3" style={{ color: formData.clientType === 'residential' ? '#0D8D1E' : '#94a3b8' }}></i>
                  <div className="fw-bold text-nowrap" style={{ color: formData.clientType === 'residential' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem' }}>Residential</div>
                </div>
              </div>

              <div className="col-12 col-sm-4">
                <div
                  className="card h-100 p-3 text-center border-2 shadow-sm"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderColor: formData.clientType === 'commercial' ? '#0D8D1E' : '#e2e8f0',
                    backgroundColor: formData.clientType === 'commercial' ? '#f0fdf4' : '#fff',
                    transform: formData.clientType === 'commercial' ? 'translateY(-2px)' : 'none'
                  }}
                  onClick={() => setFormData({ ...formData, clientType: 'commercial' })}
                >
                  <i className="fas fa-building mb-2 fs-3" style={{ color: formData.clientType === 'commercial' ? '#0D8D1E' : '#94a3b8' }}></i>
                  <div className="fw-bold text-nowrap" style={{ color: formData.clientType === 'commercial' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem' }}>Commercial</div>
                </div>
              </div>

              <div className="col-12 col-sm-4">
                <div
                  className="card h-100 p-3 text-center border-2 shadow-sm"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderColor: formData.clientType === 'industrial' ? '#0D8D1E' : '#e2e8f0',
                    backgroundColor: formData.clientType === 'industrial' ? '#f0fdf4' : '#fff',
                    transform: formData.clientType === 'industrial' ? 'translateY(-2px)' : 'none'
                  }}
                  onClick={() => setFormData({ ...formData, clientType: 'industrial' })}
                >
                  <i className="fas fa-industry mb-2 fs-3" style={{ color: formData.clientType === 'industrial' ? '#0D8D1E' : '#94a3b8' }}></i>
                  <div className="fw-bold text-nowrap" style={{ color: formData.clientType === 'industrial' ? '#0D8D1E' : '#64748b', fontSize: '0.9rem' }}>Industrial</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(formData.clientType === 'commercial' || formData.clientType === 'industrial') && (
          <div className="row mb-3">
            <div className="col-md-12">
              <div className="form-group text-start">
                <label htmlFor="reg-companyName" className="form-label fw-semibold small text-dark mb-1">
                  Company / Establishment Name <span className="text-danger">*</span>
                </label>
                <input
                  id="reg-companyName"
                  type="text"
                  name="companyName"
                  className={`form-control ${touched.companyName && errors.companyName ? 'is-invalid border-danger' : ''}`}
                  placeholder="e.g. Cleaneco Commercial Hub Inc."
                  value={formData.companyName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                />
                {touched.companyName && errors.companyName && (
                  <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                    {errors.companyName}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- Personal Information --- */}
        <h5 className="mb-3 mt-4 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-user-circle me-2"></i>{formData.clientType === 'residential' ? 'Personal Information' : 'Representative Information'}
        </h5>
        <div className="row">
          <div className="col-md-4">
            <div className="form-group text-start">
              <label htmlFor="reg-firstName" className="form-label fw-semibold small text-dark mb-1">
                First Name <span className="text-danger">*</span>
              </label>
              <input
                id="reg-firstName"
                type="text"
                name="firstName"
                className={`form-control ${touched.firstName && errors.firstName ? 'is-invalid border-danger' : ''}`}
                placeholder="e.g. Juan"
                value={formData.firstName}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              {touched.firstName && errors.firstName && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.firstName}
                </div>
              )}
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group text-start">
              <label htmlFor="reg-middleName" className="form-label fw-semibold small text-dark mb-1">
                Middle Name <span className="text-muted fw-normal">(Optional)</span>
              </label>
              <input
                id="reg-middleName"
                type="text"
                name="middleName"
                className={`form-control ${touched.middleName && errors.middleName ? 'is-invalid border-danger' : ''}`}
                placeholder="e.g. Santos"
                value={formData.middleName}
                onChange={handleChange}
                onBlur={handleBlur}
              />
              {touched.middleName && errors.middleName && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.middleName}
                </div>
              )}
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-group text-start">
              <label htmlFor="reg-lastName" className="form-label fw-semibold small text-dark mb-1">
                Last Name <span className="text-danger">*</span>
              </label>
              <input
                id="reg-lastName"
                type="text"
                name="lastName"
                className={`form-control ${touched.lastName && errors.lastName ? 'is-invalid border-danger' : ''}`}
                placeholder="e.g. Dela Cruz"
                value={formData.lastName}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              {touched.lastName && errors.lastName && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.lastName}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="form-group text-start">
              <label htmlFor="reg-gender" className="form-label fw-semibold small text-dark mb-1">
                Gender <span className="text-danger">*</span>
              </label>
              <select
                id="reg-gender"
                name="gender"
                className={`form-select ${touched.gender && errors.gender ? 'is-invalid border-danger' : ''}`}
                value={formData.gender}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                style={{
                  color: formData.gender ? '#333' : '#6c757d',
                  borderRadius: '0',
                  border: '1px solid #ccc',
                  height: '45px',
                  fontSize: '0.9rem',
                  paddingTop: '0.375rem',
                  paddingBottom: '0.375rem'
                }}
              >
                <option value="" disabled>Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {touched.gender && errors.gender && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.25rem' }}>
                  {errors.gender}
                </div>
              )}
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group text-start">
              <label htmlFor="reg-dateOfBirth" className="form-label fw-semibold small text-dark mb-1">
                Date of Birth <span className="text-danger">*</span>
              </label>
              <input
                id="reg-dateOfBirth"
                type="date"
                name="dateOfBirth"
                className={`form-control ${touched.dateOfBirth && errors.dateOfBirth ? 'is-invalid border-danger' : ''}`}
                value={formData.dateOfBirth}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                style={{ color: formData.dateOfBirth ? '#333' : '#6c757d' }}
              />
              {touched.dateOfBirth && errors.dateOfBirth && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.dateOfBirth}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Contact Information --- */}
        <h5 className="mb-3 mt-4 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-address-book me-2"></i>Contact Information
        </h5>
        <div className="row">
          <div className="col-md-6">
            <div className="form-group text-start">
              <label htmlFor="reg-email" className="form-label fw-semibold small text-dark mb-1">
                Email Address <span className="text-danger">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                name="email"
                className={`form-control ${touched.email && errors.email ? 'is-invalid border-danger' : ''}`}
                placeholder="e.g. juan.delacruz@example.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              {touched.email && errors.email && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.email}
                </div>
              )}
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group text-start">
              <label htmlFor="reg-phone" className="form-label fw-semibold small text-dark mb-1">
                Phone Number <span className="text-danger">*</span>
              </label>
              <input
                id="reg-phone"
                type="tel"
                name="phone"
                className={`form-control ${touched.phone && errors.phone ? 'is-invalid border-danger' : ''}`}
                placeholder="(+63) 9xx-xxx-xxxx"
                maxLength={18}
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              {touched.phone && errors.phone && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.phone}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Address Details --- */}
        <h5 className="mb-3 mt-4 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-map-marker-alt me-2"></i>Address Details
        </h5>
        <div className="row">
          <div className="col-md-6">
            <div className="form-group text-start">
              <label htmlFor="reg-addressLine1" className="form-label fw-semibold small text-dark mb-1">
                Street Address / House No. / Building <span className="text-danger">*</span>
              </label>
              <input
                id="reg-addressLine1"
                type="text"
                name="addressLine1"
                className={`form-control ${touched.addressLine1 && errors.addressLine1 ? 'is-invalid border-danger' : ''}`}
                placeholder="e.g. Blk 12 Lot 4, Emerald St."
                value={formData.addressLine1}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              {touched.addressLine1 && errors.addressLine1 && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.addressLine1}
                </div>
              )}
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group text-start">
              <label htmlFor="reg-addressLine2" className="form-label fw-semibold small text-dark mb-1">
                Subdivision / Village / Unit <span className="text-muted fw-normal">(Optional)</span>
              </label>
              <input
                id="reg-addressLine2"
                type="text"
                name="addressLine2"
                className="form-control"
                placeholder="e.g. Greenbreeze Subdivision"
                value={formData.addressLine2}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </div>
          </div>
        </div>

        <div className="row">
          {/* Linked PSGC Dropdown: Province First */}
          <div className="col-md-4">
            <div className="form-group text-start">
              <label htmlFor="reg-province" className="form-label fw-semibold small text-dark mb-1">
                Province <span className="text-danger">*</span>
              </label>
              <select
                id="reg-province"
                name="province"
                className={`form-select ${touched.province && errors.province ? 'is-invalid border-danger' : ''}`}
                value={formData.province}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                style={{
                  color: formData.province ? '#333' : '#6c757d',
                  borderRadius: '0',
                  border: '1px solid #ccc',
                  height: '45px',
                  fontSize: '0.9rem',
                  paddingTop: '0.375rem',
                  paddingBottom: '0.375rem'
                }}
              >
                <option value="" disabled>Select Province</option>
                {Object.keys(PSGC_PROVINCES).map(prov => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
              {touched.province && errors.province && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.25rem' }}>
                  {errors.province}
                </div>
              )}
            </div>
          </div>

          {/* Linked PSGC Dropdown: City/Municipality dynamically populated from selected Province */}
          <div className="col-md-4">
            <div className="form-group text-start">
              <label htmlFor="reg-city" className="form-label fw-semibold small text-dark mb-1">
                City / Municipality <span className="text-danger">*</span>
              </label>
              <select
                id="reg-city"
                name="city"
                className={`form-select ${touched.city && errors.city ? 'is-invalid border-danger' : ''}`}
                value={formData.city}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={!formData.province}
                required
                style={{
                  color: formData.city ? '#333' : '#6c757d',
                  borderRadius: '0',
                  border: '1px solid #ccc',
                  height: '45px',
                  fontSize: '0.9rem',
                  paddingTop: '0.375rem',
                  paddingBottom: '0.375rem',
                  backgroundColor: !formData.province ? '#f8fafc' : '#fff'
                }}
              >
                <option value="" disabled>
                  {formData.province ? 'Select City / Municipality' : 'Select Province First'}
                </option>
                {(PSGC_PROVINCES[formData.province] || []).map(cityName => (
                  <option key={cityName} value={cityName}>{cityName}</option>
                ))}
              </select>
              {touched.city && errors.city && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.25rem' }}>
                  {errors.city}
                </div>
              )}
            </div>
          </div>

          {/* Barangay */}
          <div className="col-md-4">
            <div className="form-group text-start">
              <label htmlFor="reg-barangay" className="form-label fw-semibold small text-dark mb-1">
                Barangay <span className="text-danger">*</span>
              </label>
              <input
                id="reg-barangay"
                type="text"
                name="barangay"
                className={`form-control ${touched.barangay && errors.barangay ? 'is-invalid border-danger' : ''}`}
                placeholder="e.g. Brgy. San Agustin"
                value={formData.barangay}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              {touched.barangay && errors.barangay && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.barangay}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Account Security --- */}
        <h5 className="mb-3 mt-4 fw-bold border-bottom pb-2" style={{ color: '#0D8D1E' }}>
          <i className="fas fa-shield-alt me-2"></i>Account Security
        </h5>
        <div className="form-group text-start">
          <label htmlFor="reg-username" className="form-label fw-semibold small text-dark mb-1">
            Create Username <span className="text-danger">*</span>
          </label>
          <input
            id="reg-username"
            type="text"
            name="username"
            className={`form-control ${touched.username && errors.username ? 'is-invalid border-danger' : ''}`}
            placeholder="e.g. jdelacruz"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleBlur}
            required
          />
          {touched.username && errors.username && (
            <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
              {errors.username}
            </div>
          )}
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="form-group text-start">
              <label htmlFor="reg-password" className="form-label fw-semibold small text-dark mb-1">
                Password <span className="text-danger">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className={`form-control ${touched.password && errors.password ? 'is-invalid border-danger' : ''}`}
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                  required
                  minLength="6"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  className="btn btn-link p-0"
                  aria-label="Toggle password visibility"
                  style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', zIndex: 10, textDecoration: 'none' }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"} style={{ color: '#0D8D1E' }}></i>
                </button>
              </div>
              {touched.password && errors.password && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.password}
                </div>
              )}
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-group text-start">
              <label htmlFor="reg-confirmPassword" className="form-label fw-semibold small text-dark mb-1">
                Confirm Password <span className="text-danger">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  className={`form-control ${touched.confirmPassword && errors.confirmPassword ? 'is-invalid border-danger' : ''}`}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                  required
                  minLength="6"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  className="btn btn-link p-0"
                  aria-label="Toggle confirm password visibility"
                  style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', zIndex: 10, textDecoration: 'none' }}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"} style={{ color: '#0D8D1E' }}></i>
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <div className="invalid-feedback d-block text-start small mb-2" style={{ marginTop: '-0.5rem' }}>
                  {errors.confirmPassword}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Terms of Service Section */}
        <div className="form-group text-center mb-3">
          <button
            type="button"
            className="btn rounded-pill fw-bold text-white shadow-sm"
            onClick={() => { setIsTosModalOpen(true); }}
            style={{
              transition: 'all 0.3s ease',
              minWidth: '250px',
              backgroundColor: isTosAccepted ? '#0A6F17' : '#0D8D1E',
              border: 'none',
              padding: '10px 24px',
              boxShadow: '0 2px 6px rgba(13, 141, 30, 0.25)'
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
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '680px', width: '92%' }} role="document">
          <div className="modal-content shadow-lg" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
            <div className="modal-header" style={{ backgroundColor: '#0D8D1E', borderBottom: 'none' }}>
              <h5 className="modal-title fw-bold text-white">Terms of Service</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setIsTosModalOpen(false)} aria-label="Close"></button>
            </div>
            <div className="modal-body p-0 bg-light" style={{ height: '74vh', maxHeight: '720px' }}>
              <iframe
                src={`${api.defaults.baseURL}/settings/tos/pdf#view=FitH&toolbar=0&navpanes=0`}
                title="Terms of Service"
                width="100%"
                height="100%"
                style={{ border: 'none', display: 'block' }}
              >
                <div className="p-5 text-center">
                  <p>Your browser does not support inline PDFs.</p>
                  <a href={`${api.defaults.baseURL}/settings/tos/pdf`} target="_blank" rel="noreferrer" className="btn-custom">
                    Click here to view the Terms of Service
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