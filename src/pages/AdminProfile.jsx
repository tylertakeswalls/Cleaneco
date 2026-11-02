import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { formatPhoneNumber } from '../utils/helpers';

function AdminProfile() {
  const [profile, setProfile] = useState({
    username: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '',
    date_of_birth: '',
    profile_picture: '',
    role: 'admin'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  const userId = sessionStorage.getItem('userId');
  const userRole = sessionStorage.getItem('userRole');

  useEffect(() => {
    if (!userId || userRole !== 'admin') {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await api.get(`/users/${userId}`);
        if (res.data) {
          const data = res.data;
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
            date_of_birth: formattedDob,
            role: data.role || 'admin'
          });
        }
      } catch (error) {
        setMessage({ type: 'danger', text: 'Failed to load profile data.' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, userRole, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const finalVal = name === 'phone' ? formatPhoneNumber(value) : value;
    setProfile(prev => ({ ...prev, [name]: finalVal }));
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
      const res = await api.put(`/users/${userId}`, profile);
      if (res.data.success) {
        if (profile.first_name || profile.last_name) {
          sessionStorage.setItem('userName', `${profile.first_name} ${profile.last_name}`.trim());
        }
        setMessage({ type: 'success', text: 'Admin profile updated successfully!' });
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
        <span className="text-muted fw-semibold">Loading administrator profile...</span>
      </div>
    );
  }

  return (
    <div className="admin-profile-page py-4 px-3 px-md-4 px-xl-5" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Page Title */}
        <div className="mb-4 pb-2 border-bottom">
          <h2 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>
            <i className="fas fa-user-shield text-success me-2"></i>Administrator Profile
          </h2>
          <p className="text-muted small mb-0">
            Manage your administrator credentials, contact information, and personal settings.
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
          {/* HERO IDENTITY BANNER CARD (Clean Single Surface with Accent Border) */}
          <div 
            className="card shadow-sm border-0 mb-4" 
            style={{ 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0', 
              backgroundColor: '#ffffff',
              borderLeft: '4px solid #0D8D1E'
            }}
          >
            <div className="card-body p-4">
              <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
                <div className="d-flex flex-column flex-md-row align-items-center gap-3 text-center text-md-start">
                  {/* Avatar with Camera badge */}
                  <div className="position-relative flex-shrink-0">
                    <img 
                      src={profile.profile_picture || '/default_profile.jpg'} 
                      alt="Profile" 
                      className="rounded-circle shadow-sm"
                      style={{ 
                        width: '85px', 
                        height: '85px', 
                        objectFit: 'cover', 
                        border: '3px solid #0D8D1E',
                        backgroundColor: '#ffffff'
                      }}
                    />
                    <label 
                      htmlFor="adminPicInput" 
                      className="position-absolute bottom-0 end-0 btn btn-sm btn-solid-brand rounded-circle p-1 shadow text-white d-flex align-items-center justify-content-center"
                      style={{ width: '28px', height: '28px', cursor: 'pointer' }}
                      title="Change Picture"
                    >
                      <i className="fas fa-camera" style={{ fontSize: '0.75rem' }}></i>
                    </label>
                    <input 
                      type="file" 
                      id="adminPicInput" 
                      className="d-none" 
                      accept="image/*" 
                      onChange={handleImageChange} 
                    />
                  </div>

                  <div>
                    <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-md-start gap-2 mb-1">
                      <h4 className="fw-bold mb-0 text-dark">
                        {profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}` : profile.username}
                      </h4>
                    </div>
                    <p className="text-muted small mb-0">
                      @{profile.username} &bull; <i className="fas fa-envelope ms-1 me-1 text-secondary"></i>{profile.email}
                    </p>
                  </div>
                </div>

                <button 
                  type="button" 
                  className="btn btn-sm btn-solid-light border text-dark fw-semibold px-3 py-2 rounded-2 shadow-sm"
                  onClick={() => document.getElementById('adminPicInput').click()}
                >
                  <i className="fas fa-image me-1 text-success"></i>Update Photo
                </button>
              </div>
            </div>
          </div>

          {/* MODULAR CARD 1: Personal Details */}
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

              <div className="row g-3">
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
                    Gender <span className="text-muted fw-normal">(Optional)</span>
                  </label>
                  <select
                    name="gender"
                    className="form-select"
                    value={profile.gender || ''}
                    onChange={handleChange}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other / Prefer not to say</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small text-dark mb-1">
                    Date of Birth <span className="text-muted fw-normal">(Optional)</span>
                  </label>
                  <input 
                    type="date" 
                    className="form-control" 
                    name="date_of_birth" 
                    value={profile.date_of_birth || ''} 
                    onChange={handleChange} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MODULAR CARD 2: Contact Information */}
          <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div className="card-header bg-white border-bottom py-3 px-4">
              <h6 className="fw-bold mb-0 text-dark">
                <i className="fas fa-address-book text-success me-2"></i>Contact Information
              </h6>
            </div>
            <div className="card-body p-4">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label fw-semibold small text-dark mb-0">Official Email Address</label>
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
                    Contact Phone Number <span className="text-danger">*</span>
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

          {/* BOTTOM ACTION BAR */}
          <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 p-3 bg-white rounded-3 shadow-sm border mb-4">
            <span className="text-muted small">
              <i className="fas fa-shield-alt text-success me-1"></i>
              Changes are safely saved and immediately updated across the admin portal.
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

      </div>
    </div>
  );
}

export default AdminProfile;
