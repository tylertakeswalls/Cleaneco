import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';

function AdminSettings() {
  const [termsContent, setTermsContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        setFetching(true);
        const response = await api.get('/tos.php');
        if (response.data.success) {
          setTermsContent(response.data.content);
        }
      } catch (error) {
        console.error('Error fetching TOS:', error);
        showAlert('error', 'Failed to load Terms and Conditions.');
      } finally {
        setFetching(false);
      }
    };
    fetchTerms();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.put('/update_tos.php', { content: termsContent });
      if (response.data.success) {
        showAlert('success', 'Terms and Conditions updated successfully!');
      } else {
        showAlert('error', response.data.message || 'Failed to update Terms and Conditions.');
      }
    } catch (error) {
      console.error('Error updating TOS:', error);
      showAlert('error', 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  return (
    <div className="container-fluid bg-light min-vh-100 py-5">
      <div className="container">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold text-dark mb-1" style={{ letterSpacing: '-1px' }}>Site Settings</h2>
            <p className="text-secondary mb-0">Manage global website configuration and policies.</p>
          </div>
          <Link to="/admin" className="btn btn-outline-secondary shadow-sm rounded-3 px-4 fw-bold">
            <i className="fas fa-arrow-left me-2"></i> Back to Dashboard
          </Link>
        </div>

        {alert.show && (
          <div className={`alert alert-${alert.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show shadow-sm`} role="alert">
            <i className={`fas fa-${alert.type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2`}></i>
            {alert.message}
            <button type="button" className="btn-close" onClick={() => setAlert({ show: false, type: '', message: '' })}></button>
          </div>
        )}

        <div className="card shadow-sm border-0" style={{ borderRadius: '1.25rem' }}>
          <div className="card-body p-5">
            <h4 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>
              <i className="fas fa-file-contract me-2" style={{ color: '#0D8D1E' }}></i> Terms and Conditions
            </h4>
            <p className="text-muted mb-4">Update the terms and conditions that users must agree to before registering. This content will be instantly updated on the live website.</p>

            {fetching ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div className="form-group mb-4">
                  <textarea
                    className="form-control"
                    rows="15"
                    value={termsContent}
                    onChange={(e) => setTermsContent(e.target.value)}
                    placeholder="Enter Terms and Conditions here..."
                    style={{ resize: 'vertical', fontSize: '1rem', lineHeight: '1.6', borderRadius: '0.75rem', padding: '1rem' }}
                    required
                  ></textarea>
                </div>
                <div className="d-flex justify-content-end">
                  <button 
                    type="submit" 
                    className="btn btn-success shadow-sm fw-bold px-5 py-2" 
                    style={{ borderRadius: '0.5rem', background: '#0D8D1E' }}
                    disabled={loading}
                  >
                    {loading ? (
                      <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Saving...</>
                    ) : (
                      <><i className="fas fa-save me-2"></i> Save Changes</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminSettings;
