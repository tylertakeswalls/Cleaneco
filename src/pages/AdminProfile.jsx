import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useRef } from 'react';

function AdminProfile() {
  const container = useRef();
  const [profile, setProfile] = useState({
    username: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    profile_picture: ''
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
          setProfile(res.data);
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
    setProfile({ ...profile, [name]: value });
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
        setProfile({ ...profile, profile_picture: reader.result });
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
        setMessage({ type: 'success', text: 'Admin profile updated successfully!' });
      }
    } catch (error) {
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center mt-5">Loading profile...</div>;
  }

  return (
    <div ref={container} className="container-fluid py-4 px-lg-5" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '3rem' }}>
      <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
            <div>
              <h2 className="fw-bolder mb-1 text-dark" style={{ letterSpacing: '-0.5px' }}>Admin Profile</h2>
              <p className="text-muted mb-0 fw-medium">Manage your administrator account details.</p>
            </div>
          </div>
          <div className="card glass-panel shadow-sm border-0 glass-panel" style={{ borderRadius: '1rem' }}>
            <div className="card-body p-4">
              
              {message.text && (
                <div className={`alert alert-${message.type} alert-dismissible fade show`} role="alert">
                  {message.text}
                  <button type="button" className="btn-close" onClick={() => setMessage({ type: '', text: '' })}></button>
                </div>
              )}

              <form onSubmit={handleSave}>
                <div className="text-center mb-4">
                  <div className="position-relative d-inline-block">
                    <img 
                      src={profile.profile_picture || '/default_profile.jpg'} 
                      alt="Profile" 
                      className="rounded-circle img-thumbnail"
                      style={{ width: '150px', height: '150px', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => document.getElementById('profilePicInput').click()}
                    />
                    <div className="mt-2">
                      <label htmlFor="profilePicInput" className="btn btn-sm btn-cleaneco rounded-pill px-3">
                        <i className="fas fa-camera me-1"></i> Change Picture
                      </label>
                      <input 
                        type="file" 
                        id="profilePicInput" 
                        className="d-none" 
                        accept="image/*" 
                        onChange={handleImageChange} 
                      />
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label">First Name</label>
                    <input type="text" className="form-control" name="first_name" value={profile.first_name || ''} onChange={handleChange} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Middle Name</label>
                    <input type="text" className="form-control" name="middle_name" value={profile.middle_name || ''} onChange={handleChange} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Last Name</label>
                    <input type="text" className="form-control" name="last_name" value={profile.last_name || ''} onChange={handleChange} required />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label">Username</label>
                    <input type="text" className="form-control" name="username" value={profile.username || ''} onChange={handleChange} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control bg-light" name="email" value={profile.email || ''} readOnly />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Phone</label>
                    <input type="text" className="form-control" name="phone" value={profile.phone || ''} onChange={handleChange} />
                  </div>
                </div>

                <div className="d-flex justify-content-end mt-4 pt-3 border-top">
                  <button type="submit" className="btn btn-success px-4" disabled={saving}>
                    {saving ? 'Saving...' : <><i className="fas fa-save me-2"></i> Save Changes</>}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default AdminProfile;
