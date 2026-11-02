import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { PSGC_PROVINCES, formatFullAddress } from '../data/psgcData';
import { formatPhoneNumber } from '../utils/helpers';

function ClientProfile() {
  const [profile, setProfile] = useState({
    username: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    addressLine1: '',
    addressLine2: '',
    province: '',
    city: '',
    barangay: '',
    gender: '',
    date_of_birth: '',
    profile_picture: '',
    clientType: 'residential',
    companyName: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  const userId = sessionStorage.getItem('userId');

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await api.get(`/users/${userId}`);
        if (res.data) {
          const data = res.data;
          let initialProvince = data.province || '';
          let initialCity = data.city || '';
          let initialBarangay = data.barangay || '';
          let initialLine1 = data.addressLine1 || '';
          let initialLine2 = data.addressLine2 || '';

          // If structured fields aren't stored yet, attempt best-effort deduction from legacy address string
          if (!initialProvince && data.address) {
            const addrLower = data.address.toLowerCase();
            for (const prov of Object.keys(PSGC_PROVINCES)) {
              const cleanProv = prov.replace(' (NCR)', '').toLowerCase();
              if (addrLower.includes(cleanProv)) {
                initialProvince = prov;
                const cities = PSGC_PROVINCES[prov] || [];
                for (const c of cities) {
                  const cleanC = c.toLowerCase().replace(' city', '');
                  if (addrLower.includes(cleanC)) {
                    initialCity = c;
                    break;
                  }
                }
                break;
              }
            }
            if (!initialLine1) {
              initialLine1 = data.address;
            }
          }

          let formattedDob = '';
          if (data.date_of_birth) {
            try {
              formattedDob = new Date(data.date_of_birth).toISOString().split('T')[0];
            } catch (e) {
              formattedDob = data.date_of_birth;
            }
          }

          setProfile({
            ...data,
            phone: formatPhoneNumber(data.phone || ''),
            province: initialProvince,
            city: initialCity,
            barangay: initialBarangay,
            addressLine1: initialLine1,
            addressLine2: initialLine2,
            address: data.address || '',
            date_of_birth: formattedDob,
            clientType: data.clientType || 'residential'
          });
        }
      } catch (error) {
        setMessage({ type: 'danger', text: 'Failed to load profile data.' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const finalVal = name === 'phone' ? formatPhoneNumber(value) : value;
    setProfile(prev => ({ ...prev, [name]: finalVal }));
  };

  const handleProvinceChange = (e) => {
    const newProvince = e.target.value;
    setProfile(prev => {
      const updated = {
        ...prev,
        province: newProvince,
        city: '' // Reset city when province changes
      };
      updated.address = formatFullAddress(updated);
      return updated;
    });
  };

  const handleAddressComponentChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => {
      const updated = {
        ...prev,
        [name]: value
      };
      updated.address = formatFullAddress(updated);
      return updated;
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'danger', text: 'Image size must be less than 2MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, profile_picture: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const computedAddress = formatFullAddress(profile) || profile.address;
      const payload = {
        ...profile,
        address: computedAddress
      };
      const res = await api.put(`/users/${userId}`, payload);
      if (res.data.success) {
        setProfile(prev => ({ ...prev, address: computedAddress }));
        if (profile.first_name || profile.last_name) {
          sessionStorage.setItem('userName', `${profile.first_name} ${profile.last_name}`.trim());
        }
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-success me-2" role="status"></div>
        <span className="text-muted fw-semibold">Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="profile-layout" style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 70px)' }}>
      <div className="d-flex flex-column flex-lg-row">
        
        {/* ======================================================== */}
        {/* LEFT DRAWER / SIDEBAR (Red Box in Diagram)              */}
        {/* ======================================================== */}
        <aside 
          className="profile-drawer bg-white border-end"
          style={{ 
            width: '100%', 
            maxWidth: '360px', 
            minWidth: '320px',
            borderRight: '1px solid #e2e8f0',
            flexShrink: 0
          }}
        >
          {/* Drawer Top Header Banner */}
          <div 
            className="p-4 text-center position-relative" 
            style={{ 
              backgroundColor: '#e5f6e8', 
              borderBottom: '1px solid #c8e6c9',
              paddingTop: '2.5rem',
              paddingBottom: '2.5rem'
            }}
          >
            {/* Avatar with Camera Overlay */}
            <div className="position-relative d-inline-block">
              <img 
                src={profile.profile_picture || '/default_profile.jpg'} 
                alt="Profile" 
                className="rounded-circle shadow"
                style={{ 
                  width: '110px', 
                  height: '110px', 
                  objectFit: 'cover', 
                  border: '4px solid #ffffff', 
                  backgroundColor: '#ffffff' 
                }}
              />
              <label 
                htmlFor="drawerPicInput" 
                className="position-absolute bottom-0 end-0 btn btn-sm btn-solid-brand rounded-circle p-2 shadow text-white d-flex align-items-center justify-content-center"
                style={{ width: '34px', height: '34px', cursor: 'pointer' }}
                title="Change Picture"
              >
                <i className="fas fa-camera" style={{ fontSize: '0.85rem' }}></i>
              </label>
              <input 
                type="file" 
                id="drawerPicInput" 
                className="d-none" 
                accept="image/*" 
                onChange={handleImageChange} 
              />
            </div>

            <h5 className="fw-bold mb-1 mt-3 text-dark">
              {profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.username}
            </h5>
            <p className="text-muted small mb-2">@{profile.username}</p>

            <span 
              className="badge rounded-pill text-white fw-semibold px-3 py-2" 
              style={{ backgroundColor: '#0D8D1E', fontSize: '0.75rem' }}
            >
              <i className={`fas ${profile.clientType === 'commercial' ? 'fa-building' : profile.clientType === 'industrial' ? 'fa-industry' : 'fa-home'} me-1`}></i>
              {profile.clientType ? profile.clientType.charAt(0).toUpperCase() + profile.clientType.slice(1) : 'Residential'} Client
            </span>
          </div>

          {/* Drawer Body Info & Shortcuts */}
          <div className="p-4">
            <div className="mb-4">
              <span className="text-uppercase fw-bold text-muted small" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                Account Information
              </span>
              <div className="mt-3">
                <div className="d-flex align-items-center mb-3">
                  <div className="rounded-circle bg-light p-2 me-3 text-success d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                    <i className="fas fa-envelope"></i>
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Email Address</div>
                    <div className="fw-semibold text-dark text-truncate small">{profile.email || 'N/A'}</div>
                  </div>
                </div>

                <div className="d-flex align-items-center mb-3">
                  <div className="rounded-circle bg-light p-2 me-3 text-success d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                    <i className="fas fa-phone"></i>
                  </div>
                  <div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Phone Number</div>
                    <div className="fw-semibold text-dark small">{profile.phone || 'Not provided'}</div>
                  </div>
                </div>

                <div className="d-flex align-items-center mb-2">
                  <div className="rounded-circle bg-light p-2 me-3 text-success d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                    <i className="fas fa-shield-alt"></i>
                  </div>
                  <div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Account Status</div>
                    <div className="fw-semibold text-success small">Verified Client</div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="text-muted opacity-25 my-4" />

            {/* Quick Navigation Shortcuts */}
            <div className="mb-4">
              <span className="text-uppercase fw-bold text-muted small" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                Quick Shortcuts
              </span>
              <div className="list-group list-group-flush mt-2">
                <Link to="/book" className="list-group-item list-group-item-action d-flex align-items-center px-0 py-2 border-0 text-dark small fw-medium">
                  <i className="fas fa-calendar-plus text-success me-3" style={{ width: '16px' }}></i>
                  Book a Service
                  <i className="fas fa-chevron-right ms-auto text-muted small"></i>
                </Link>
                <Link to="/client/ongoing-orders" className="list-group-item list-group-item-action d-flex align-items-center px-0 py-2 border-0 text-dark small fw-medium">
                  <i className="fas fa-truck text-success me-3" style={{ width: '16px' }}></i>
                  Ongoing Orders
                  <i className="fas fa-chevron-right ms-auto text-muted small"></i>
                </Link>
                <Link to="/client/messages" className="list-group-item list-group-item-action d-flex align-items-center px-0 py-2 border-0 text-dark small fw-medium">
                  <i className="fas fa-comments text-success me-3" style={{ width: '16px' }}></i>
                  Messages & Support
                  <i className="fas fa-chevron-right ms-auto text-muted small"></i>
                </Link>
              </div>
            </div>

            {/* Upload Button */}
            <button 
              type="button" 
              className="btn btn-sm btn-solid-light border w-100 fw-semibold text-dark py-2 rounded-2 mt-2"
              onClick={() => document.getElementById('drawerPicInput').click()}
            >
              <i className="fas fa-upload me-2 text-success"></i>Upload New Picture
            </button>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* RIGHT CONTENT PANEL (Blue Box in Diagram)                */}
        {/* ======================================================== */}
        <main className="profile-main-content flex-grow-1 p-3 p-md-4 p-xl-5">
          {/* Top Header */}
          <div className="mb-4 pb-3 border-bottom">
            <h2 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
              Profile Settings
            </h2>
            <p className="text-muted small mb-0">
              Update your account type, contact information, and default service address.
            </p>
          </div>

          {message.text && (
            <div className={`alert alert-${message.type} alert-dismissible fade show rounded-3 shadow-sm mb-4`} role="alert">
              <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2`}></i>
              {message.text}
              <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
            </div>
          )}

          <form onSubmit={handleSave}>
            {/* CARD 1: Account Type */}
            <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div className="card-header bg-white border-bottom py-3 px-4">
                <h6 className="fw-bold mb-0 text-dark">
                  <i className="fas fa-briefcase text-success me-2"></i>Account Type
                </h6>
              </div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-12 col-sm-4">
                    <div
                      className="card h-100 p-3 text-center border-2 shadow-sm"
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderColor: profile.clientType === 'residential' ? '#0D8D1E' : '#e2e8f0',
                        backgroundColor: profile.clientType === 'residential' ? '#f0fdf4' : '#fff',
                        transform: profile.clientType === 'residential' ? 'translateY(-2px)' : 'none'
                      }}
                      onClick={() => setProfile({ ...profile, clientType: 'residential' })}
                    >
                      <i className="fas fa-home mb-2 fs-4" style={{ color: profile.clientType === 'residential' ? '#0D8D1E' : '#94a3b8' }}></i>
                      <div className="fw-bold" style={{ color: profile.clientType === 'residential' ? '#0D8D1E' : '#64748b', fontSize: '0.85rem' }}>
                        Residential
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-4">
                    <div
                      className="card h-100 p-3 text-center border-2 shadow-sm"
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderColor: profile.clientType === 'commercial' ? '#0D8D1E' : '#e2e8f0',
                        backgroundColor: profile.clientType === 'commercial' ? '#f0fdf4' : '#fff',
                        transform: profile.clientType === 'commercial' ? 'translateY(-2px)' : 'none'
                      }}
                      onClick={() => setProfile({ ...profile, clientType: 'commercial' })}
                    >
                      <i className="fas fa-building mb-2 fs-4" style={{ color: profile.clientType === 'commercial' ? '#0D8D1E' : '#94a3b8' }}></i>
                      <div className="fw-bold" style={{ color: profile.clientType === 'commercial' ? '#0D8D1E' : '#64748b', fontSize: '0.85rem' }}>
                        Commercial
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-4">
                    <div
                      className="card h-100 p-3 text-center border-2 shadow-sm"
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderColor: profile.clientType === 'industrial' ? '#0D8D1E' : '#e2e8f0',
                        backgroundColor: profile.clientType === 'industrial' ? '#f0fdf4' : '#fff',
                        transform: profile.clientType === 'industrial' ? 'translateY(-2px)' : 'none'
                      }}
                      onClick={() => setProfile({ ...profile, clientType: 'industrial' })}
                    >
                      <i className="fas fa-industry mb-2 fs-4" style={{ color: profile.clientType === 'industrial' ? '#0D8D1E' : '#94a3b8' }}></i>
                      <div className="fw-bold" style={{ color: profile.clientType === 'industrial' ? '#0D8D1E' : '#64748b', fontSize: '0.85rem' }}>
                        Industrial
                      </div>
                    </div>
                  </div>
                </div>

                {(profile.clientType === 'commercial' || profile.clientType === 'industrial') && (
                  <div className="mt-3 pt-3 border-top">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Company / Establishment Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      className="form-control"
                      placeholder="e.g. Cleaneco Commercial Hub Inc."
                      value={profile.companyName || ''}
                      onChange={handleChange}
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: Personal Details */}
            <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div className="card-header bg-white border-bottom py-3 px-4">
                <h6 className="fw-bold mb-0 text-dark">
                  <i className="fas fa-user-edit text-success me-2"></i>Personal Details
                </h6>
              </div>
              <div className="card-body p-4">
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      First Name <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="first_name" 
                      value={profile.first_name || ''} 
                      onChange={handleChange} 
                      required 
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Middle Name <span className="text-muted fw-normal">(Optional)</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="middle_name" 
                      value={profile.middle_name || ''} 
                      onChange={handleChange} 
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Last Name <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="last_name" 
                      value={profile.last_name || ''} 
                      onChange={handleChange} 
                      required 
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Username <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="username" 
                      value={profile.username || ''} 
                      onChange={handleChange} 
                      required 
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Gender <span className="text-danger">*</span>
                    </label>
                    <select
                      name="gender"
                      className="form-select"
                      value={profile.gender || ''}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Date of Birth <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="date" 
                      className="form-control" 
                      name="date_of_birth" 
                      value={profile.date_of_birth || ''} 
                      onChange={handleChange} 
                      required 
                    />
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label fw-semibold small text-dark mb-0">Email Address</label>
                      <span className="badge bg-light text-secondary border small fw-normal px-2 py-0">
                        <i className="fas fa-lock me-1 text-muted"></i>Read-only
                      </span>
                    </div>
                    <input 
                      type="email" 
                      className="form-control bg-light text-muted" 
                      style={{ cursor: 'not-allowed' }}
                      name="email" 
                      value={profile.email || ''} 
                      readOnly 
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Phone Number <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      name="phone" 
                      placeholder="(+63) 9xx-xxx-xxxx"
                      maxLength={18}
                      value={profile.phone || ''} 
                      onChange={handleChange} 
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: Service Address */}
            <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div className="card-header bg-white border-bottom py-3 px-4">
                <h6 className="fw-bold mb-0 text-dark">
                  <i className="fas fa-map-marker-alt text-success me-2"></i>Service Address
                </h6>
              </div>
              <div className="card-body p-4">
                <div className="row g-3 mb-3">
                  <div className="col-md-7">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Street Address / House No. / Building <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="addressLine1" 
                      placeholder="e.g. Blk 12 Lot 4, Emerald St." 
                      value={profile.addressLine1 || ''} 
                      onChange={handleAddressComponentChange} 
                      required 
                    />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Subdivision / Village / Unit <span className="text-muted fw-normal">(Optional)</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="addressLine2" 
                      placeholder="e.g. Greenbreeze Subdivision" 
                      value={profile.addressLine2 || ''} 
                      onChange={handleAddressComponentChange} 
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Province <span className="text-danger">*</span>
                    </label>
                    <select 
                      className="form-select" 
                      name="province" 
                      value={profile.province || ''} 
                      onChange={handleProvinceChange} 
                      required
                    >
                      <option value="">Select Province</option>
                      {Object.keys(PSGC_PROVINCES).map(prov => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      City / Municipality <span className="text-danger">*</span>
                    </label>
                    <select 
                      className="form-select" 
                      name="city" 
                      value={profile.city || ''} 
                      onChange={handleAddressComponentChange} 
                      disabled={!profile.province} 
                      required
                    >
                      <option value="">{profile.province ? 'Select City / Municipality' : 'Select Province First'}</option>
                      {(PSGC_PROVINCES[profile.province] || []).map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small text-dark mb-1">
                      Barangay <span className="text-danger">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="barangay" 
                      placeholder="e.g. San Agustin" 
                      value={profile.barangay || ''} 
                      onChange={handleAddressComponentChange} 
                      required 
                    />
                  </div>
                </div>

                {/* Combined Address Preview Pill */}
                <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-2 mt-2" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <i className="fas fa-check-circle text-success fs-6"></i>
                  <span className="fw-semibold text-dark small text-nowrap">Combined Address:</span>
                  <span className="text-secondary small fw-medium text-truncate">
                    {profile.address || 'Select your province, city, and street address above to preview the complete address.'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Save Action Bar */}
            <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 p-3 bg-white rounded-3 shadow-sm border mb-4">
              <span className="text-muted small">
                <i className="fas fa-shield-alt text-success me-1"></i>
                Changes are saved to your profile and reflected in upcoming bookings.
              </span>
              <button 
                type="submit" 
                className="btn btn-solid-brand px-5 py-2 fw-semibold text-white shadow-sm"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save me-2"></i>Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </main>

      </div>
    </div>
  );
}

export default ClientProfile;
